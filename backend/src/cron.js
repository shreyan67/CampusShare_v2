const cron = require('node-cron');
const { query } = require('./db/pool');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function initCronJobs() {
  console.log('[Cron] Initializing daily background jobs...');

  // Run every day at midnight (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running daily automation tasks...');

    try {
      // 1. AUTO-FLAG OVERDUE BORROWERS (> 3 days late)
      // Flag the user so they cannot borrow anything else until resolved
      const flagRes = await query(`
        UPDATE users 
        SET is_flagged = TRUE 
        WHERE id IN (
          SELECT borrower_id 
          FROM borrow_requests 
          WHERE status = 'active' 
            AND due_date < NOW() - INTERVAL '3 days'
        )
        RETURNING id, name, email
      `);
      if (flagRes.length > 0) {
        console.log(`[Cron] Auto-flagged ${flagRes.length} users for being >3 days overdue.`);
      }

      // 2. AUTO-CLOSE STALE REQUESTS (pending > 7 days)
      const closeRes = await query(`
        UPDATE borrow_requests 
        SET status = 'closed' 
        WHERE status = 'pending' 
          AND created_at < NOW() - INTERVAL '7 days'
        RETURNING id
      `);
      if (closeRes.length > 0) {
        console.log(`[Cron] Auto-closed ${closeRes.length} stale pending requests.`);
      }

      // 3. AUTO-NUDGE OVERDUE BORROWERS (1 to 3 days late)
      // Get active requests that are past due but not yet flagged
      const overdueReqs = await query(`
        SELECT br.id, br.due_date, i.title, u.name, u.email
        FROM borrow_requests br
        JOIN items i ON i.id = br.item_id
        JOIN users u ON u.id = br.borrower_id
        WHERE br.status = 'active' 
          AND br.due_date < NOW() 
          AND u.is_flagged = FALSE
      `);

      for (const req of overdueReqs) {
        try {
          await resend.emails.send({
            from: 'CampusShare <noreply@campusshare.co.in>',
            to: req.email,
            subject: `⚠️ Overdue Reminder: ${req.title}`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <h2 style="color:#c0392b">Hi ${req.name},</h2>
                <p>This is an automated reminder that you are overdue to return <strong>${req.title}</strong>.</p>
                <p>The due date was <strong>${new Date(req.due_date).toLocaleDateString()}</strong>.</p>
                <p>Please contact the lender immediately to arrange the return. If the item is not returned within 3 days of the due date, your account will be automatically flagged and locked from further borrowing.</p>
                <p style="font-size:12px;color:#999;margin-top:24px">— CampusShare Automated System</p>
              </div>
            `
          });
          console.log(`[Cron] Sent overdue nudge to ${req.email} for item ${req.title}`);
        } catch (emailErr) {
          console.error(`[Cron] Failed to send email to ${req.email}:`, emailErr);
        }
      }

      console.log('[Cron] Daily automation tasks completed successfully.');
    } catch (err) {
      console.error('[Cron] Error running daily tasks:', err);
    }
  });
}

module.exports = { initCronJobs };
