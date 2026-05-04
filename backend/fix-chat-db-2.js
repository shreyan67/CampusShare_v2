require('dotenv').config()
const { pool } = require('./src/db/pool')

async function migrate() {
  console.log('Adding is_read column...')
  try {
    await pool.query(`
      ALTER TABLE transaction_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;
    `)
    console.log('✅ is_read column added to transaction_messages.')
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
  } finally {
    await pool.end()
  }
}

migrate()
