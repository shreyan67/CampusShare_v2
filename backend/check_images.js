const { query } = require('./src/db/pool.js');
async function run() {
  const rows = await query(
    `SELECT title, octet_length(images::text) as size_bytes, array_length(images, 1) as num_images
     FROM items
     WHERE title IN ('Cup noodles', '2 College Trousers', 'Casio FX 82 ms calculator', 'Customised Portrait (pencil sketch) by Artist')`
  );
  rows.forEach(r => {
    const kb = r.size_bytes ? (r.size_bytes / 1024).toFixed(1) : '0';
    console.log(`${r.title}: ${kb} KB | ${r.num_images || 0} image(s)`);
  });
  process.exit(0);
}
run().catch(console.error);
