const express = require('express')
const { query, queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const { BORROW_LIMITS, getActiveBorrowCount, promoteIfEligible } = require('../services/trust')

const router = express.Router()

const REQUEST_JOIN = `
  SELECT
    br.*,
    i.title AS item_title, i.category AS item_category,i.listing_type,
    i.is_paid, i.price_per_day, i.images AS item_images,
    borrower.name AS borrower_name, borrower.avatar AS borrower_avatar, borrower.color AS borrower_color,
    owner.name AS owner_name
  FROM borrow_requests br
  JOIN items   i        ON br.item_id    = i.id
  JOIN users   borrower ON br.borrower_id= borrower.id
  JOIN users   owner    ON br.owner_id   = owner.id
`

// GET /api/requests/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const reqs = await query(
      REQUEST_JOIN + ' WHERE (br.borrower_id=$1 OR br.owner_id=$1) ORDER BY br.requested_at DESC',
      [req.userId]
    )
    res.json({ requests: reqs })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// POST /api/requests  — create a borrow request
router.post('/', requireAuth, async (req, res) => {
  try {
    const { itemId, requestedDays, message } = req.body
    const borrower = await queryOne('SELECT * FROM users WHERE id=$1', [req.userId])
    const item     = await queryOne('SELECT * FROM items WHERE id=$1', [itemId])

    if (!item)                        return res.status(404).json({ error: 'Item not found.' })
    if (!borrower.is_verified)        return res.status(403).json({ error: 'Verify your account first.' })
    if (item.status !== 'available')  return res.status(409).json({ error: 'Item is not available.' })
    if (item.owner_id === req.userId) return res.status(400).json({ error: 'Cannot borrow your own item.' })
    if (item.college_id !== req.collegeId) return res.status(403).json({ error: 'Item belongs to another college.' })

    const days  = Math.min(parseInt(requestedDays), item.max_borrow_days)
    const limit = BORROW_LIMITS[borrower.trust_tier] || 1
    const active= await getActiveBorrowCount(req.userId)
    if (active >= limit)
      return res.status(429).json({ error: `Borrow limit reached (${limit} for ${borrower.trust_tier} tier).` })

    // Platform fee (3%) added ON TOP of rental — lender always gets full price_per_day
    const PLATFORM_FEE_PERCENT = 3
    const rentalAmount = item.is_paid ? parseFloat((parseFloat(item.price_per_day) * days).toFixed(2)) : 0
    const platformFee  = item.is_paid ? parseFloat((rentalAmount * PLATFORM_FEE_PERCENT / 100).toFixed(2)) : 0
    const total        = parseFloat((rentalAmount + platformFee).toFixed(2))
    const status = 'pending'

    const req_ = await queryOne(`
      INSERT INTO borrow_requests(item_id,borrower_id,owner_id,requested_days,message,status,total_amount,rental_amount,platform_fee)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [itemId, req.userId, item.owner_id, days, message||'', status, total, rentalAmount, platformFee])

    res.status(201).json({ request: req_, totalAmount: total, rentalAmount, platformFee, isPaid: item.is_paid })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to send request.' }) }
})

// PATCH /api/requests/:id/confirm-payment  — borrower marks payment as sent
router.patch('/:id/confirm-payment', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])

    if (!r) return res.status(404).json({ error: 'Not found.' })

    // 🔥 ONLY selected borrower can confirm payment
    if (r.status !== 'selected') {
      return res.status(409).json({ error: 'Not in selected state.' })
    }

    await query(
      "UPDATE borrow_requests SET payment_confirmed=TRUE WHERE id=$1",
      [r.id]
    )

    res.json({ success: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})
// PATCH /api/requests/:id/activate-after-payment
// Called by BORROWER immediately after Razorpay payment is verified.
// Moves the request from 'selected' → 'active' so the lender is notified
// and can send pickup details. No lender action required for paid items —
// Razorpay signature verification is sufficient proof of payment.
router.patch('/:id/activate-after-payment', requireAuth, async (req, res) => {
  try {
    const r    = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])

    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (r.borrower_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (r.status !== 'selected') return res.status(409).json({ error: 'Request not in selected state.' })
    if (!r.payment_confirmed) return res.status(409).json({ error: 'Payment not confirmed yet.' })

    const dueAt = new Date(Date.now() + r.requested_days * 864e5)

    await query(
      "UPDATE borrow_requests SET status='active', due_at=$1 WHERE id=$2",
      [dueAt, r.id]
    )

    // Decline all other pending/selected requests for this item — payment is committed
    if (!item.allow_multiple) {
      await query("UPDATE items SET status='borrowed' WHERE id=$1", [item.id])
      await query(
        "UPDATE borrow_requests SET status='declined' WHERE item_id=$1 AND id<>$2 AND status IN ('pending','selected')",
        [item.id, r.id]
      )
    }

    res.json({ success: true, dueAt })
  } catch (err) {
    console.error('[activate-after-payment] error:', err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// PATCH /api/requests/:id/finalize
// For PAID items: owner confirms payment received → goes active (pickup flow starts)
// For NON-PAID items: owner just confirms selection → goes active (pickup flow starts)
router.patch('/:id/finalize', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])

    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (r.status !== 'selected') return res.status(409).json({ error: 'Request not in selected state.' })

    // For paid items, payment must be confirmed before finalizing
    if (item.is_paid && !r.payment_confirmed) {
      return res.status(409).json({ error: 'Payment not confirmed yet.' })
    }

    const dueAt = new Date(Date.now() + r.requested_days * 864e5)

    // Mark this request active — pickup details flow begins
    await query(
      "UPDATE borrow_requests SET status='active', due_at=$1 WHERE id=$2",
      [dueAt, r.id]
    )

    // For PAID single-borrower items: decline all other requests immediately
    // (payment = commitment, no going back)
    // For NON-PAID items: do NOT decline others here — lender may still switch
    // if selected borrower doesn't show up. Others get declined at item-given.
    if (item.is_paid && !item.allow_multiple) {
      await query("UPDATE items SET status='borrowed' WHERE id=$1", [item.id])
      await query(
        "UPDATE borrow_requests SET status='declined' WHERE item_id=$1 AND id<>$2 AND status IN ('pending','selected')",
        [item.id, r.id]
      )
    }
    // For multi-borrower items, item stays 'available' so other selected borrowers can also finalize

    res.json({ success: true, dueAt })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

router.patch('/:id/approve', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])

    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })

    if (r.status !== 'pending') {
      return res.status(409).json({ error: 'Request not in pending state.' })
    }

    // If item does NOT allow multiple borrowers, de-select any previously selected request first
    if (!item.allow_multiple) {
      await query(
        "UPDATE borrow_requests SET status='pending' WHERE item_id=$1 AND status='selected' AND id<>$2",
        [item.id, r.id]
      )
    }

    await query(
      "UPDATE borrow_requests SET status='selected', approved_at=NOW() WHERE id=$1",
      [r.id]
    )

    return res.json({ success: true, stage: 'selected', allowMultiple: item.allow_multiple })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})
// PATCH /api/requests/:id/decline
router.patch('/:id/decline', requireAuth, async (req, res) => {
  try {
    const r    = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])
    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    await query("UPDATE borrow_requests SET status='declined' WHERE id=$1", [r.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/return  — owner confirms return
router.patch('/:id/return', requireAuth, async (req, res) => {
  try {
    const r    = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])
    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (!['active','overdue'].includes(r.status)) return res.status(409).json({ error: 'Item not currently borrowed.' })

    const onTime = new Date() <= new Date(r.due_at)
    await query("UPDATE borrow_requests SET status='returned',returned_at=NOW() WHERE id=$1", [r.id])
    await query("UPDATE items SET status='available', is_deleted=TRUE WHERE id=$1", [item.id])
    if (onTime) {
      await query('UPDATE users SET return_count=return_count+1 WHERE id=$1', [r.borrower_id])
      await promoteIfEligible(r.borrower_id)
    }

    res.json({ success: true, onTime })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// ── LOST & FOUND HANDOVER ROUTES ─────────────────────────────────────────────
// Uses a JOIN to get listing_type from items table (not stored on borrow_requests)

const LF_JOIN = `
  SELECT br.*, i.listing_type, i.title AS _item_title
  FROM borrow_requests br JOIN items i ON i.id = br.item_id
  WHERE br.id=$1
`

// PATCH /api/requests/:id/pickup-message — claimer submits pickup location message
router.patch('/:id/pickup-message', requireAuth, async (req, res) => {
  try {
    const { message } = req.body
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required.' })

    const r = await queryOne(LF_JOIN, [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.borrower_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (r.listing_type !== 'lost_found') return res.status(400).json({ error: 'Only for lost & found items.' })
    if (r.status !== 'selected') return res.status(409).json({ error: 'Item must be in selected state.' })

    await query('UPDATE borrow_requests SET pickup_message=$1 WHERE id=$2', [message.trim(), req.params.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/handover — lender confirms they handed item to claimer
router.patch('/:id/handover', requireAuth, async (req, res) => {
  try {
    const r = await queryOne(LF_JOIN, [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (r.listing_type !== 'lost_found') return res.status(400).json({ error: 'Only for lost & found items.' })
    if (r.status !== 'selected') return res.status(409).json({ error: 'Item must be in selected state.' })
    if (!r.pickup_message) return res.status(409).json({ error: 'Claimer has not sent a pickup message yet.' })

    await query("UPDATE borrow_requests SET handed_over=TRUE, status='active' WHERE id=$1", [req.params.id])

    // LF item is handed over — decline all other pending/selected claims for this item
    await query(
      "UPDATE borrow_requests SET status='declined' WHERE item_id=$1 AND id<>$2 AND status IN ('pending','selected')",
      [r.item_id, req.params.id]
    )

    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/lf-received — claimer confirms they received the LF item
// Ends the LF lifecycle: marks request returned, hides item from marketplace,
// closes the lost_found post, and frees the borrow slot.
router.patch('/:id/lf-received', requireAuth, async (req, res) => {
  try {
    const r = await queryOne(LF_JOIN, [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.borrower_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (r.listing_type !== 'lost_found') return res.status(400).json({ error: 'Only for lost & found items.' })
    if (r.status !== 'active') return res.status(409).json({ error: 'Item must be in active state.' })

    // 1. Mark borrow request as returned
    await query(
      "UPDATE borrow_requests SET status='returned', returned_at=NOW() WHERE id=$1",
      [req.params.id]
    )

    // 2. Hide item from marketplace using is_deleted flag
    //    (items.status stays 'available' to satisfy DB constraint — is_deleted hides it)
    await query(
      'UPDATE items SET is_deleted=TRUE WHERE id=$1',
      [r.item_id]
    )

    // 3. Close the lost_found post so it no longer appears in LF marketplace
    //    Find the lost_found post via the accepted lf_claim for this borrower
    const lfClaim = await queryOne(
      `SELECT lfc.lf_id FROM lf_claims lfc
         JOIN lost_found lf ON lf.id = lfc.lf_id
        WHERE lfc.claimer_id=$1
          AND lfc.status='accepted'
          AND lf.status IN ('open','claimed')
        ORDER BY lfc.created_at DESC LIMIT 1`,
      [req.userId]
    )
    if (lfClaim?.lf_id) {
      await query(
        "UPDATE lost_found SET status='closed' WHERE id=$1",
        [lfClaim.lf_id]
      )
    }

    // 4. Increment return count for trust tier progression
    await query(
      'UPDATE users SET return_count=return_count+1 WHERE id=$1',
      [r.borrower_id]
    )
    await promoteIfEligible(r.borrower_id)

    res.json({ success: true })
  } catch (err) {
    console.error('[lf-received] error:', err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// ── MARKETPLACE PHYSICAL HANDOVER ROUTES ─────────────────────────────────────
// After borrower pays, lender sends pickup details, then confirms item given,
// then borrower confirms receipt. Only then does item go fully active for return tracking.

// PATCH /api/requests/:id/pickup-details — lender tells borrower where to collect
router.patch('/:id/pickup-details', requireAuth, async (req, res) => {
  try {
    const { details } = req.body
    if (!details || !details.trim()) return res.status(400).json({ error: 'Pickup details are required.' })

    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (r.status !== 'active') return res.status(409).json({ error: 'Item must be active (payment confirmed).' })

    await query('UPDATE borrow_requests SET pickup_details=$1 WHERE id=$2', [details.trim(), req.params.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/item-given — lender confirms they physically handed item to borrower
router.patch('/:id/item-given', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (r.status !== 'active') return res.status(409).json({ error: 'Item must be active.' })
    if (!r.pickup_details) return res.status(409).json({ error: 'Please send pickup details to borrower first.' })

    await query('UPDATE borrow_requests SET item_given=TRUE WHERE id=$1', [req.params.id])

    // Decline all other pending/selected requests for this item now —
    // item is physically handed over, lender is committed to this borrower
    await query(
      "UPDATE borrow_requests SET status='declined' WHERE item_id=$1 AND id<>$2 AND status IN ('pending','selected')",
      [r.item_id, req.params.id]
    )
    // Mark item as borrowed
    await query("UPDATE items SET status='borrowed' WHERE id=$1", [r.item_id])

    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/borrower-received — borrower confirms they collected the item
router.patch('/:id/borrower-received', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.borrower_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (r.status !== 'active') return res.status(409).json({ error: 'Item must be active.' })
    if (!r.item_given) return res.status(409).json({ error: 'Lender has not confirmed handover yet.' })

    await query('UPDATE borrow_requests SET borrower_received=TRUE WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/revoke — borrower cancels their own pending request
// Only allowed while status is 'pending' — once selected, borrower cannot revoke
router.patch('/:id/revoke', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.borrower_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (r.status !== 'pending') {
      return res.status(409).json({ error: 'You can only revoke a pending request. Once selected, contact the lender.' })
    }
    await query("UPDATE borrow_requests SET status='declined' WHERE id=$1", [r.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/payment-received — lender confirms they got paid by admin
router.patch('/:id/payment-received', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (r.payout_status !== 'admin_paid') return res.status(409).json({ error: 'No pending payout to confirm.' })

    await query(
      "UPDATE borrow_requests SET payout_status='done' WHERE id=$1",
      [req.params.id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// PATCH /api/requests/:id/dispute — lender raises dispute (didn't receive payment)
router.patch('/:id/dispute', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (r.payout_status !== 'admin_paid') return res.status(409).json({ error: 'No payout to dispute.' })

    await query(
      "UPDATE borrow_requests SET payout_status='disputed' WHERE id=$1",
      [req.params.id]
    )

    // Notify admin about the dispute — always log loudly to server console
    // so even if email fails the dispute is never silently lost
    const lender = await queryOne('SELECT name, email FROM users WHERE id=$1', [r.owner_id])
    const item   = await queryOne('SELECT title FROM items WHERE id=$1', [r.item_id])

    console.log('='.repeat(60))
    console.log('⚠️  DISPUTE RAISED — ACTION REQUIRED')
    console.log(`   Lender  : ${lender?.name} (${lender?.email})`)
    console.log(`   Item    : ${item?.title}`)
    console.log(`   Request : ${r.id}`)
    console.log(`   Amount  : ₹${r.rental_amount || r.total_amount}`)
    console.log('='.repeat(60))

    try {
      const adminEmail = process.env.ADMIN_EMAIL
      if (!adminEmail || adminEmail === 'your@email.com') {
        console.error('[dispute] ADMIN_EMAIL not set in .env — email skipped')
      } else {
        const { Resend } = require('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from:    'onboarding@resend.dev',
          to:      adminEmail,
          subject: `⚠️ DISPUTE raised — ${item?.title} — ${lender?.name}`,
          html: `
            <div style="font-family:sans-serif;padding:24px;max-width:480px">
              <h2 style="color:#c0392b">⚠️ Payment Dispute Raised</h2>
              <p><strong>${lender?.name}</strong> (${lender?.email}) says they did NOT receive their payout.</p>
              <table style="width:100%;border-collapse:collapse;background:#fef9f9;border-radius:8px;margin:16px 0">
                <tr><td style="padding:10px 14px;color:#666;font-size:13px">Item</td><td style="padding:10px 14px;font-weight:600">${item?.title}</td></tr>
                <tr><td style="padding:10px 14px;color:#666;font-size:13px">Request ID</td><td style="padding:10px 14px;font-family:monospace;font-size:12px">${r.id}</td></tr>
                <tr><td style="padding:10px 14px;color:#666;font-size:13px">Amount owed</td><td style="padding:10px 14px;font-weight:600;color:#c0392b">₹${r.rental_amount || r.total_amount}</td></tr>
              </table>
              <p style="font-size:13px;color:#555">Please investigate and resolve this via the admin panel.</p>
              <p style="font-size:11px;color:#999">Note: onboarding@resend.dev only delivers to the Resend account owner's email. Add your custom domain in Resend dashboard for full email delivery.</p>
            </div>
          `
        })
        console.log(`[dispute] Dispute email sent to ${adminEmail}`)
      }
    } catch (emailErr) {
      console.error('[dispute] Email send failed:', emailErr.message)
      // Dispute is still saved in DB as 'disputed' — visible in admin panel
    }

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

module.exports = router
