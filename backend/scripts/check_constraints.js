const { pool } = require('../src/db/pool');

async function check() {
  try {
    const res = await pool.query("SELECT conname FROM pg_constraint WHERE conrelid = 'items'::regclass;");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
check();
