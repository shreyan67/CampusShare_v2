require('dotenv').config();
const { Client } = require('pg');

const oldUrl = 'postgresql://campussharedb_yu7r_user:6j2vkTlwQURj2TSENSTKuOQ43Mk2VoLl@dpg-d7a624edqaus73aqd25g-a.singapore-postgres.render.com/campusshare_db';
const newUrl = 'postgresql://postgres.wihogwztyiewqblcdfcp:Sa5459s%40*12340987*@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres';

const tables = [
  'colleges',
  'users',
  'otps',
  'items',
  'lost_found',
  'borrow_requests',
  'lf_claims'
];

async function run() {
  const oldClient = new Client({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newClient = new Client({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  await oldClient.connect();
  console.log('Connected to Render DB');

  await newClient.connect();
  console.log('Connected to Supabase DB');

  // 1. Run setup SQL on new client
  console.log('Setting up schema on Supabase...');
  const setupSQL = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS colleges (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL UNIQUE,
      domain      TEXT NOT NULL UNIQUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id    UUID NOT NULL REFERENCES colleges(id),
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      roll_number   TEXT NOT NULL,
      is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
      trust_tier    TEXT NOT NULL DEFAULT 'newcomer' CHECK (trust_tier IN ('newcomer','regular','trusted','rep')),
      return_count  INT NOT NULL DEFAULT 0,
      avatar        TEXT,
      color         TEXT DEFAULT '#185FA5',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      balance       NUMERIC(10,2) DEFAULT 0,
      stripe_account_id TEXT,
      upi_id        TEXT
    );

    CREATE TABLE IF NOT EXISTS otps (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash   TEXT NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      used        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS items (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id       UUID NOT NULL REFERENCES colleges(id),
      owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title            TEXT NOT NULL,
      category         TEXT NOT NULL,
      condition_notes  TEXT DEFAULT '',
      max_borrow_days  SMALLINT NOT NULL DEFAULT 7,
      status           TEXT NOT NULL DEFAULT 'available',
      is_paid          BOOLEAN NOT NULL DEFAULT FALSE,
      price_per_day    NUMERIC(10,2) DEFAULT 0,
      images           TEXT[] DEFAULT '{}',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      listing_type     TEXT DEFAULT 'borrow',
      transaction_type TEXT DEFAULT 'borrow',
      allow_multiple   BOOLEAN NOT NULL DEFAULT FALSE,
      is_deleted       BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS lost_found (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id   UUID NOT NULL REFERENCES colleges(id),
      poster_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title        TEXT NOT NULL,
      description  TEXT NOT NULL,
      lost_by      TEXT NOT NULL CHECK (lost_by IN ('me','someone_else')),
      location     TEXT DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','closed')),
      images       TEXT[] DEFAULT '{}',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS borrow_requests (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      borrower_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_days  SMALLINT NOT NULL,
      message         TEXT DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'pending',
      total_amount    NUMERIC(10,2) DEFAULT 0,
      payment_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at     TIMESTAMPTZ,
      due_at          TIMESTAMPTZ,
      returned_at     TIMESTAMPTZ,
      pickup_details  TEXT,
      item_given      BOOLEAN DEFAULT FALSE,
      rental_amount   NUMERIC(10,2) DEFAULT 0,
      platform_fee    NUMERIC(10,2) DEFAULT 0,
      is_disputed     BOOLEAN NOT NULL DEFAULT FALSE,
      dispute_reason  TEXT,
      pickup_message  TEXT,
      handed_over     BOOLEAN NOT NULL DEFAULT FALSE,
      borrower_received BOOLEAN NOT NULL DEFAULT FALSE,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      payout_id TEXT,
      payout_status TEXT DEFAULT 'pending',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lf_claims (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lf_id        UUID NOT NULL REFERENCES lost_found(id) ON DELETE CASCADE,
      claimer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message      TEXT DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await newClient.query(`
    DROP TABLE IF EXISTS lf_claims CASCADE;
    DROP TABLE IF EXISTS borrow_requests CASCADE;
    DROP TABLE IF EXISTS lost_found CASCADE;
    DROP TABLE IF EXISTS items CASCADE;
    DROP TABLE IF EXISTS otps CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS colleges CASCADE;
  `);

  await newClient.query(setupSQL);
  console.log('Schema created successfully');

  for (const table of tables) {
    console.log(`Migrating table: ${table}`);
    const { rows } = await oldClient.query(`SELECT * FROM ${table}`);
    if (rows.length === 0) {
      console.log(`  No rows found in ${table}`);
      continue;
    }
    
    // Construct insert
    const keys = Object.keys(rows[0]);
    // escape keys just in case
    const safeKeys = keys.map(k => `"${k}"`);
    const valuesParams = keys.map((_, i) => '$' + (i + 1)).join(', ');
    const insertSQL = `INSERT INTO ${table} (${safeKeys.join(', ')}) VALUES (${valuesParams})`;

    for (let i = 0; i < rows.length; i++) {
      const vals = keys.map(k => rows[i][k]);
      try {
        await newClient.query(insertSQL, vals);
      } catch (e) {
        console.error(`Failed to insert row ${i} into ${table}: `, e.message);
      }
    }
    console.log(`  Migrated ${rows.length} rows to ${table}`);
  }

  console.log('Migration Complete!');
  process.exit(0);
}
run().catch(console.error);
