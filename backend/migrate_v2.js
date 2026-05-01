/**
 * CampusShare — v2 Migration
 * Run once: node migrate_v2.js
 *
 * Safe to re-run — uses ADD COLUMN IF NOT EXISTS and CREATE TABLE IF NOT EXISTS.
 *
 * Adds:
 *   items.transaction_type          — 'rent' | 'sell' | 'donate' | 'lend'
 *   item_requests table             — borrower posts "I need X"
 *   item_request_offers table       — lenders respond with offers
 */
require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Render/Railway/Supabase
})

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running CampusShare v2 migration...')

    // 1. Add transaction_type to items
    await client.query(`
      ALTER TABLE items
        ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'lend'
    `)
    console.log('  ✅ items.transaction_type added')

    // Add CHECK constraint safely (ignore if already exists)
    try {
      await client.query(`
        ALTER TABLE items
          ADD CONSTRAINT items_transaction_type_check
          CHECK (transaction_type IN ('rent','sell','donate','lend'))
      `)
    } catch (e) {
      if (!e.message.includes('already exists')) throw e
    }

    // Backfill: existing paid items → 'rent', free → 'lend'
    await client.query(`
      UPDATE items
      SET transaction_type = CASE WHEN is_paid THEN 'rent' ELSE 'lend' END
      WHERE transaction_type = 'lend'
    `)
    console.log('  ✅ Backfilled existing items with transaction_type')

    // 2. Ensure listing_type column exists (may already be there)
    await client.query(`
      ALTER TABLE items
        ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'borrow'
    `)
    console.log('  ✅ items.listing_type ensured')

    // 3. Ensure allow_multiple exists
    await client.query(`
      ALTER TABLE items
        ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN NOT NULL DEFAULT FALSE
    `)
    console.log('  ✅ items.allow_multiple ensured')

    // 4. Ensure is_deleted exists
    await client.query(`
      ALTER TABLE items
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE
    `)
    console.log('  ✅ items.is_deleted ensured')

    // 5. Create item_requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS item_requests (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        college_id        UUID NOT NULL REFERENCES colleges(id),
        requester_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title             TEXT NOT NULL,
        description       TEXT DEFAULT '',
        category          TEXT NOT NULL DEFAULT 'Any',
        urgency           TEXT NOT NULL DEFAULT 'medium',
        status            TEXT NOT NULL DEFAULT 'open',
        accepted_offer_id UUID,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    console.log('  ✅ item_requests table created')

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_item_requests_college
        ON item_requests(college_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_item_requests_requester
        ON item_requests(requester_id)
    `)

    // 6. Create item_request_offers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS item_request_offers (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id       UUID NOT NULL REFERENCES item_requests(id) ON DELETE CASCADE,
        offerer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transaction_type TEXT NOT NULL DEFAULT 'lend',
        note             TEXT DEFAULT '',
        price            NUMERIC(10,2) DEFAULT 0,
        status           TEXT NOT NULL DEFAULT 'pending',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    console.log('  ✅ item_request_offers table created')

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_offers_request
        ON item_request_offers(request_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_offers_offerer
        ON item_request_offers(offerer_id)
    `)

    // 7. Ensure borrow_requests has all needed columns (safe if already exist)
    await client.query(`
      ALTER TABLE borrow_requests
        ADD COLUMN IF NOT EXISTS rental_amount     NUMERIC(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS platform_fee      NUMERIC(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payout_status     TEXT DEFAULT 'na',
        ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
        ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
        ADD COLUMN IF NOT EXISTS pickup_details    TEXT,
        ADD COLUMN IF NOT EXISTS pickup_message    TEXT,
        ADD COLUMN IF NOT EXISTS item_given        BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS borrower_received BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS handed_over       BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW()
    `)
    console.log('  ✅ borrow_requests columns ensured')

    // 8. Ensure users.upi_id exists
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS upi_id TEXT
    `)
    console.log('  ✅ users.upi_id ensured')

    console.log('\n🎉 Migration complete! You can now restart your server.')

  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    console.error(err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
