/**
 * CampusShare — Razorpay Migration
 * Run once: node migrate-razorpay.js
 *
 * Safe to re-run — uses ADD COLUMN IF NOT EXISTS throughout.
 *
 * Adds:
 *   borrow_requests.razorpay_order_id    — Razorpay order created at checkout
 *   borrow_requests.razorpay_payment_id  — Razorpay payment ID after capture
 *   borrow_requests.payout_id            — Razorpay Payout ID after lender payout
 *   borrow_requests.payout_status        — 'pending'|'processing'|'done'|'failed'|'na'
 *   users.upi_id                         — Lender's UPI ID for receiving payouts
 */
require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running CampusShare Razorpay migration...')

    await client.query(`
      ALTER TABLE borrow_requests
        ADD COLUMN IF NOT EXISTS razorpay_order_id   TEXT,
        ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
        ADD COLUMN IF NOT EXISTS payout_id           TEXT,
        ADD COLUMN IF NOT EXISTS payout_status       TEXT DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS rental_amount       NUMERIC(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS platform_fee        NUMERIC(10,2) DEFAULT 0;
    `)

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS upi_id TEXT;
    `)

    // Lost & Found handover flow + marketplace handover
    await client.query(`
      ALTER TABLE borrow_requests
        ADD COLUMN IF NOT EXISTS pickup_message    TEXT,
        ADD COLUMN IF NOT EXISTS handed_over       BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS pickup_details    TEXT,
        ADD COLUMN IF NOT EXISTS item_given        BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS borrower_received BOOLEAN DEFAULT FALSE;
    `)

    // Multiple borrowers support on items
    await client.query(`
      ALTER TABLE items
        ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN DEFAULT FALSE;
    `)

    // updated_at for ordering payouts by most recently updated
    await client.query(`
      ALTER TABLE borrow_requests
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `)

    // Create trigger to auto-update updated_at on every row change
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ language 'plpgsql';
    `)
    await client.query(`
      DROP TRIGGER IF EXISTS borrow_requests_updated_at ON borrow_requests;
      CREATE TRIGGER borrow_requests_updated_at
        BEFORE UPDATE ON borrow_requests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `)

    console.log('Migration complete.')
    console.log('  borrow_requests: razorpay_order_id, razorpay_payment_id, payout_id, payout_status')
    console.log('  users: upi_id')
  } catch (err) {
    console.error('Migration failed:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()

// Run this part if upgrading from a previous version
async function migrateLostFound(client) {
  await client.query(`
    ALTER TABLE borrow_requests
      ADD COLUMN IF NOT EXISTS pickup_message TEXT,
      ADD COLUMN IF NOT EXISTS handed_over    BOOLEAN DEFAULT FALSE;
  `)
  console.log('  borrow_requests: pickup_message, handed_over')
}
