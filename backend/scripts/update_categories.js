const { pool } = require('../src/db/pool');

async function update() {
  try {
    await pool.query('ALTER TABLE items DROP CONSTRAINT items_category_check;');
    await pool.query("ALTER TABLE items ADD CONSTRAINT items_category_check CHECK (category IN ('Books','Lab Equipment','Electronics','Notes & Guides','Accessories','Other','Food','Books & Notes'));");
    console.log('Successfully updated category constraint!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}
update();
