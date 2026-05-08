require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Adding admin_utr to borrow_requests...");
    await pool.query(`ALTER TABLE borrow_requests ADD COLUMN IF NOT EXISTS admin_utr VARCHAR(255)`);
    console.log("Success: added admin_utr");

    console.log("Resetting old platform_fees to 0...");
    const res = await pool.query(`UPDATE borrow_requests SET platform_fee = 0 WHERE payout_status = 'done'`);
    console.log(`Success: reset platform_fee for ${res.rowCount} completed payouts.`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

run();
