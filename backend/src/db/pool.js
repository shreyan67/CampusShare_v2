require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Keep connections alive — prevents "Connection terminated unexpectedly"
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
})

// Catch pool-level errors so they never crash the process
pool.on('error', (err, client) => {
  console.error('DB pool error (non-fatal):', err.message)
})

async function query(sql, params) {
  let client
  try {
    client = await pool.connect()
    const result = await client.query(sql, params)
    return result.rows
  } catch (err) {
    console.error('DB query error:', err.message, '|', sql.slice(0, 80))
    throw err
  } finally {
    if (client) client.release()
  }
}

async function queryOne(sql, params) {
  const rows = await query(sql, params)
  return rows[0] || null
}

module.exports = { pool, query, queryOne }
