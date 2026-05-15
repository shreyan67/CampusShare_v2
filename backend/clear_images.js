const {query} = require('./src/db/pool.js');
async function run() {
  try {
    const res = await query("UPDATE items SET images = '{}'::text[] WHERE octet_length(images::text) > 100000");
    console.log("Cleared large images for", res.rowCount, "items");
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
