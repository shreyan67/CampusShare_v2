require('dotenv').config();
const { Client } = require('pg');

const oldUrl = 'postgresql://campussharedb_yu7r_user:6j2vkTlwQURj2TSENSTKuOQ43Mk2VoLl@dpg-d7a624edqaus73aqd25g-a.singapore-postgres.render.com/campusshare_db';
const newUrl = 'postgresql://postgres.wihogwztyiewqblcdfcp:Sa5459s%40*12340987*@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres';

const tables = [
  'item_requests',
  'item_request_offers'
];

async function run() {
  const oldClient = new Client({ connectionString: oldUrl, ssl: { rejectUnauthorized: false } });
  const newClient = new Client({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  await oldClient.connect();
  console.log('Connected to Render DB');

  await newClient.connect();
  console.log('Connected to Supabase DB');

  console.log('Migrating item_requests and item_request_offers...');

  for (const table of tables) {
    console.log(`Migrating table: ${table}`);
    const { rows } = await oldClient.query(`SELECT * FROM ${table}`);
    if (rows.length === 0) {
      console.log(`  No rows found in ${table}`);
      continue;
    }
    
    const keys = Object.keys(rows[0]);
    const safeKeys = keys.map(k => `"${k}"`);
    const valuesParams = keys.map((_, i) => '$' + (i + 1)).join(', ');
    const insertSQL = `INSERT INTO ${table} (${safeKeys.join(', ')}) VALUES (${valuesParams})`;

    let successCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const vals = keys.map(k => rows[i][k]);
      try {
        await newClient.query(insertSQL, vals);
        successCount++;
      } catch (e) {
        console.error(`Failed to insert row ${i} into ${table}: `, e.message);
      }
    }
    console.log(`  Successfully migrated ${successCount}/${rows.length} rows to ${table}`);
  }

  console.log('Migration Complete!');
  process.exit(0);
}
run().catch(console.error);
