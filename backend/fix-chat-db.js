require('dotenv').config()
const { pool } = require('./src/db/pool')

const SQL = `
CREATE TABLE IF NOT EXISTS transaction_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES borrow_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_request ON transaction_messages(request_id);
`

async function migrate() {
  console.log('Setting up Chat table...')
  try {
    await pool.query(SQL)
    console.log('✅ transaction_messages table created.')
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
  } finally {
    await pool.end()
  }
}

migrate()
