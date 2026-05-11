const { pool } = require('./db/pool');
pool.query("UPDATE borrow_requests SET due_at = NULL WHERE item_id IN (SELECT id FROM items WHERE transaction_type IN ('sell', 'donate'))")
  .then(() => pool.query("UPDATE borrow_requests SET status = 'active' WHERE status = 'overdue' AND due_at IS NULL"))
  .then(() => console.log('Fixed DB'))
  .catch(console.error)
  .finally(() => process.exit(0));
