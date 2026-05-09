const express = require('express')
const { query, queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// GET /api/users/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.*, c.name AS college_name, c.domain AS college_domain
       FROM users u JOIN colleges c ON u.college_id=c.id WHERE u.id=$1`,
      [req.userId]
    )
    if (!user) return res.status(404).json({ error: 'User not found.' })

    // Self-heal: if is_flagged is set but no force_closed request exists, clear it
    if (user.is_flagged) {
      const locked = await query(
        'SELECT id FROM borrow_requests WHERE borrower_id=$1 AND force_closed=TRUE LIMIT 1',
        [req.userId]
      )
      if (!locked || locked.length === 0) {
        await query('UPDATE users SET is_flagged=FALSE WHERE id=$1', [req.userId])
        user.is_flagged = false
      }
    }

    res.json({ user })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/users/me/upi
// Body: { upiId: "name@bank" }
// Lets a lender save their UPI ID so payouts can be sent after return.
router.patch('/me/upi', requireAuth, async (req, res) => {
  try {
    const { upiId } = req.body

    if (!upiId || typeof upiId !== 'string') {
      return res.status(400).json({ error: 'upiId is required.' })
    }

    const trimmed = upiId.trim()

    // Basic UPI ID format check: something@something
    const UPI_RE = /^[a-zA-Z0-9._\-+]+@[a-zA-Z0-9]+$/
    if (!UPI_RE.test(trimmed)) {
      return res.status(400).json({ error: 'Invalid UPI ID format. Expected format: name@bank' })
    }

    await query('UPDATE users SET upi_id=$1 WHERE id=$2', [trimmed, req.userId])

    const user = await queryOne(
      `SELECT u.*, c.name AS college_name, c.domain AS college_domain
       FROM users u JOIN colleges c ON u.college_id=c.id WHERE u.id=$1`,
      [req.userId]
    )

    res.json({ success: true, user })
  } catch (err) {
    console.error('UPI update error:', err)
    res.status(500).json({ error: 'Failed to save UPI ID.' })
  }
})

// PATCH /api/users/me/inform-admin-slots
router.patch('/me/inform-admin-slots', requireAuth, async (req, res) => {
  try {
    const user = await queryOne('SELECT * FROM users WHERE id=$1', [req.userId]);
    const fcReqs = await query(
      `SELECT br.id, i.title, u.name as lender_name, u.email as lender_email 
       FROM borrow_requests br 
       JOIN items i ON i.id = br.item_id 
       JOIN users u ON u.id = br.owner_id 
       WHERE br.borrower_id=$1 AND br.force_closed=TRUE`, 
      [req.userId]
    );

    if (fcReqs.length === 0) {
      if (user.is_flagged) {
        await query("UPDATE users SET is_flagged=FALSE WHERE id=$1", [req.userId]);
        return res.json({ success: true, autoFixed: true });
      }
      return res.status(400).json({ error: 'No locked slots found.' });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      let htmlBody = `<p>Borrower <strong>${user.name}</strong> (${user.email}) has requested to free their slots.</p>
                      <p>They claim they have returned the item(s) late, but the lender(s) forgot to press confirm return.</p>
                      <h3>Force-closed items:</h3><ul>`;
      fcReqs.forEach(r => {
        htmlBody += `<li>Item: <strong>${r.title}</strong> | Lender: ${r.lender_name} (${r.lender_email})</li>`;
      });
      htmlBody += `</ul><p>Please manually email the lender(s) to verify, and then free the borrower's slots if confirmed.</p>`;

      resend.emails.send({
        from: 'CampusShare <noreply@campusshare.co.in>',
        to: adminEmail,
        subject: `⚠️ Slot Unlock Request — ${user.name}`,
        html: htmlBody
      }).catch(console.error);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Inform admin error:', err);
    res.status(500).json({ error: 'Failed to inform admin.' });
  }
});

module.exports = router
