const express = require('express')
const { query, queryOne, pool } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const { BORROW_LIMITS, getActiveBorrowCount, promoteIfEligible } = require('../services/trust')
const { sendPushNotification } = require('./push')
const { emitToUser } = require('../socket')

const router = express.Router()

const REQUEST_JOIN = `
  SELECT
    br.*,
    i.title AS item_title, i.category AS item_category, i.listing_type,
    i.is_paid, i.price_per_day, i.images AS item_images,
    i.transaction_type,
    borrower.name AS borrower_name, borrower.avatar AS borrower_avatar, borrower.color AS borrower_color,
    owner.name AS owner_name,
    -- flag borrow_requests that came from item_request offers (keep in Requests tab only)
    (i.listing_type = 'request_offer') AS from_item_request
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
    if (borrower.is_flagged)          return res.status(403).json({ error: 'Your account is flagged. Please contact admin.' })
    if (item.status !== 'available')  return res.status(409).json({ error: 'Item is not available.' })
    if (item.owner_id === req.userId) return res.status(400).json({ error: 'Cannot borrow your own item.' })
    if (item.college_id !== req.collegeId) return res.status(403).json({ error: 'Item belongs to another college.' })

    const days  = Math.min(parseInt(requestedDays), item.max_borrow_days)
    const limit = BORROW_LIMITS[borrower.trust_tier] || 1
    const active= await getActiveBorrowCount(req.userId)
    if (active >= limit)
      return res.status(429).json({ error: `Borrow limit reached (${limit} for ${borrower.trust_tier} tier).` })

    // Platform fee: 8% for amounts ≤ ₹200, 5% for amounts > ₹200
    // Fee is added ON TOP of rental — borrower pays rental + fee
    const rentalAmount = item.is_paid ? parseFloat((parseFloat(item.price_per_day) * days).toFixed(2)) : 0
    const PLATFORM_FEE_PERCENT = rentalAmount > 200 ? 5 : 8
    const platformFee  = item.is_paid ? parseFloat((rentalAmount * PLATFORM_FEE_PERCENT / 100).toFixed(2)) : 0
    const total        = parseFloat((rentalAmount + platformFee).toFixed(2))
    const status = 'pending'

    const req_ = await queryOne(`
      INSERT INTO borrow_requests(item_id,borrower_id,owner_id,requested_days,message,status,total_amount,rental_amount,platform_fee)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [itemId, req.userId, item.owner_id, days, message||'', status, total, rentalAmount, platformFee])

    res.status(201).json({ request: req_, totalAmount: total, rentalAmount, platformFee, isPaid: item.is_paid })

    // Notify lender: new borrow request (push + socket)
    sendPushNotification(item.owner_id, {
      title: '📦 New Borrow Request!',
      body: `${borrower.name} wants to borrow "${item.title}"`,
      url: '/'
    }).catch(() => {})
    emitToUser(item.owner_id, 'refresh:requests')
    emitToUser(item.owner_id, 'refresh:item-requests')

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
    const pin = Math.floor(1000 + Math.random() * 9000).toString()

    await query(
      "UPDATE borrow_requests SET status='active', due_at=$1, handover_pin=$2 WHERE id=$3",
      [dueAt, pin, r.id]
    )

    // Decline all other pending/selected requests for this item — payment is committed
    if (!item.allow_multiple) {
      await query("UPDATE items SET status='borrowed' WHERE id=$1", [item.id])
      await query(
        "UPDATE borrow_requests SET status='declined' WHERE item_id=$1 AND id<>$2 AND status IN ('pending','selected')",
        [item.id, r.id]
      )
    }

    emitToUser(r.owner_id, 'refresh:requests')
    emitToUser(r.borrower_id, 'refresh:requests')
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
    const pin = Math.floor(1000 + Math.random() * 9000).toString()

    // Mark this request active — pickup details flow begins
    await query(
      "UPDATE borrow_requests SET status='active', due_at=$1, handover_pin=$2 WHERE id=$3",
      [dueAt, pin, r.id]
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

    // Notify borrower
    sendPushNotification(r.borrower_id, {
      title: '✅ Request Finalized!',
      body: `The lender finalized your request for "${item.title}".`,
      url: '/?activity=borrowing'
    }).catch(() => {})
    emitToUser(r.borrower_id, 'refresh:requests')
    emitToUser(req.userId, 'refresh:requests')

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

    // Notify borrower: request approved
    sendPushNotification(r.borrower_id, {
      title: '✅ Request Approved!',
      body: `Your request for "${item.title}" was approved. ${item.is_paid ? 'Please complete payment.' : 'Arrange pickup with the lender.'}`,
      url: '/'
    }).catch(() => {})
    emitToUser(r.borrower_id, 'refresh:requests')
    emitToUser(req.userId, 'refresh:requests')

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

    // Notify borrower: request declined
    sendPushNotification(r.borrower_id, {
      title: '❌ Request Declined',
      body: `Your request for "${item.title}" was declined by the lender.`,
      url: '/'
    }).catch(() => {})
    emitToUser(r.borrower_id, 'refresh:requests')
    emitToUser(req.userId, 'refresh:requests')

    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/return  — owner confirms return
// For sell/donate items: this route is not used (lifecycle ends at borrower-received)
// Exception: force_closed items can always be confirmed returned to free borrower slots
router.patch('/:id/return', requireAuth, async (req, res) => {
  try {
    const r    = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])
    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })

    const isForceClosedReturn = r.status === 'returned' && r.force_closed
    const isNormalReturn = ['active','overdue'].includes(r.status)

    if (!isNormalReturn && !isForceClosedReturn)
      return res.status(409).json({ error: 'Item not currently borrowed.' })

    // Sell/donate items don't expect return — only lend/rent do
    // Exception: if force_closed, allow confirming return to free borrower slots
    if (['sell','donate'].includes(item.transaction_type) && !isForceClosedReturn) {
      return res.status(400).json({ error: 'This item was sold/donated — no return expected.' })
    }

    const onTime = r.due_at ? new Date() <= new Date(r.due_at) : false
    await query("UPDATE borrow_requests SET status='returned', returned_at=NOW(), force_closed=FALSE WHERE id=$1", [r.id])
    await query("UPDATE items SET status='available', is_deleted=TRUE WHERE id=$1", [item.id])

    if (isForceClosedReturn) {
      // Lender confirmed physical return after force-close
      // Only unflag the borrower if they have returned EVERYTHING
      const pendingCount = await queryOne(`
        SELECT COUNT(*) as n FROM borrow_requests 
        WHERE borrower_id=$1 
          AND (status IN ('pending','selected','payment_pending','active','overdue') 
               OR (status='returned' AND force_closed=TRUE))
      `, [r.borrower_id])
      
      if (parseInt(pendingCount?.n || 0) === 0) {
        await query("UPDATE users SET is_flagged=FALSE WHERE id=$1", [r.borrower_id])
      }
    } else if (onTime) {
      await query('UPDATE users SET return_count=return_count+1 WHERE id=$1', [r.borrower_id])
      await promoteIfEligible(r.borrower_id)
    }

    sendPushNotification(r.borrower_id, {
      title: '✅ Return Confirmed!',
      body: `The lender confirmed the return of "${item.title}". Thank you!`,
      url: '/?activity=borrowing'
    }).catch(() => {})
    emitToUser(r.borrower_id, 'refresh:requests')
    emitToUser(req.userId, 'refresh:requests')

    res.json({ success: true, onTime, wasForceClose: isForceClosedReturn })
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

    emitToUser(r.borrower_id, 'refresh:requests')
    emitToUser(r.owner_id, 'refresh:requests')
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

    sendPushNotification(r.owner_id, {
      title: '🎉 Item Received!',
      body: `The claimer received "${r._item_title}".`,
      url: '/?activity=lending'
    }).catch(() => {})

    emitToUser(r.owner_id, 'refresh:requests')
    emitToUser(r.borrower_id, 'refresh:requests')
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

    // Notify borrower: lender sent pickup details
    sendPushNotification(r.borrower_id, {
      title: '📍 Pickup Details Ready!',
      body: 'The lender has sent you the pickup location. Tap to view.',
      url: '/'
    }).catch(() => {})
    emitToUser(r.borrower_id, 'refresh:requests')

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

    emitToUser(r.borrower_id, 'refresh:requests')
    emitToUser(r.owner_id, 'refresh:requests')
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/borrower-received — borrower confirms they collected the item
router.patch('/:id/borrower-received', requireAuth, async (req, res) => {
  try {
    const r    = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])
    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (r.borrower_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (r.status !== 'active') return res.status(409).json({ error: 'Item must be active.' })
    if (!r.item_given) return res.status(409).json({ error: 'Lender has not confirmed handover yet.' })

    await query('UPDATE borrow_requests SET borrower_received=TRUE WHERE id=$1', [req.params.id])

    // For sell/donate: lifecycle ends here — mark returned immediately, free borrower slot
    const noReturn = ['sell','donate'].includes(item.transaction_type)
    if (noReturn) {
      await query("UPDATE borrow_requests SET status='returned', returned_at=NOW() WHERE id=$1", [req.params.id])
      await query("UPDATE items SET status='available', is_deleted=TRUE WHERE id=$1", [item.id])
      // increment return_count to free trust slot
      await query('UPDATE users SET return_count=return_count+1 WHERE id=$1', [r.borrower_id])
      await promoteIfEligible(r.borrower_id)
    }

    emitToUser(r.owner_id, 'refresh:requests')
    emitToUser(r.borrower_id, 'refresh:requests')
    res.json({ success: true, lifecycleComplete: noReturn })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/requests/:id/verify-handover - lender enters PIN to confirm handover
router.patch('/:id/verify-handover', requireAuth, async (req, res) => {
  try {
    const { pin } = req.body
    if (!pin) return res.status(400).json({ error: 'PIN required.' })

    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])

    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (r.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (r.status !== 'active') return res.status(409).json({ error: 'Item must be active.' })
    
    // In case older requests don't have a PIN, fail gracefully or allow
    if (r.handover_pin && r.handover_pin !== pin) {
      return res.status(400).json({ error: 'Incorrect PIN.' })
    }

    // Atomic update
    await query('UPDATE borrow_requests SET item_given=TRUE, borrower_received=TRUE WHERE id=$1', [r.id])

    // item-given logic: decline others, mark borrowed
    await query(
      "UPDATE borrow_requests SET status='declined' WHERE item_id=$1 AND id<>$2 AND status IN ('pending','selected')",
      [r.item_id, r.id]
    )
    await query("UPDATE items SET status='borrowed' WHERE id=$1", [r.item_id])

    // borrower-received logic: handle sell/donate instantly
    const noReturn = ['sell','donate'].includes(item.transaction_type)
    if (noReturn) {
      await query("UPDATE borrow_requests SET status='returned', returned_at=NOW() WHERE id=$1", [r.id])
      await query("UPDATE items SET status='available', is_deleted=TRUE WHERE id=$1", [item.id])
      await query('UPDATE users SET return_count=return_count+1 WHERE id=$1', [r.borrower_id])
      await promoteIfEligible(r.borrower_id)
    }

    // If paid, set payout_status='manual_pending' so it appears in admin payouts tab.
    // It only moves to 'done' after the lender confirms they received the payment.
    if (item.is_paid && r.payout_status !== 'done' && r.payout_status !== 'admin_paid') {
      await query("UPDATE borrow_requests SET payout_status='manual_pending' WHERE id=$1", [r.id])
    }

    sendPushNotification(r.borrower_id, {
      title: '🤝 Handover Verified!',
      body: `You received "${item.title}". ${noReturn ? 'Enjoy!' : 'Please return it on time.'}`,
      url: '/?activity=borrowing'
    })

    emitToUser(r.borrower_id, 'refresh:requests')
    emitToUser(r.owner_id, 'refresh:requests')
    res.json({ success: true, lifecycleComplete: noReturn })
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

// PATCH /api/requests/:id/complaint — borrower reports unresponsive lender
router.patch('/:id/complaint', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.borrower_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (r.status !== 'active') return res.status(409).json({ error: 'Complaint is only available during the active phase.' })
    
    await query("UPDATE borrow_requests SET borrower_complaint=TRUE WHERE id=$1", [req.params.id])
    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to submit complaint.' }) }
})

// PATCH /api/requests/:id/payment-received — lender confirms they got paid by admin
router.patch('/:id/payment-received', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (!['admin_paid', 'disputed'].includes(r.payout_status)) return res.status(409).json({ error: 'No pending payout to confirm.' })

    await query(
      "UPDATE borrow_requests SET payout_status='done' WHERE id=$1",
      [req.params.id]
    )
    emitToUser(r.borrower_id, 'refresh:requests')
    emitToUser(r.owner_id, 'refresh:requests')
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
    if (!['admin_paid', 'manual_pending'].includes(r.payout_status)) return res.status(409).json({ error: 'No payout to dispute.' })

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
        resend.emails.send({
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

    // Push notify admin on their phone
    sendPushNotification('admin', {
      title: '🚨 New Dispute Raised!',
      body: `${lender?.name} disputes payment for "${item?.title}". Tap to review in admin panel.`,
      url: '/'
    }).catch(() => {})

    emitToUser(r.owner_id, 'refresh:requests')
    emitToUser(r.borrower_id, 'refresh:requests')
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:id/nudge-return — lender sends borrower an email to return the item
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/nudge-return', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.owner_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (!['active', 'overdue'].includes(r.status))
      return res.status(409).json({ error: 'Item not currently borrowed.' })

    await query("UPDATE borrow_requests SET lender_nudged_borrower=TRUE WHERE id=$1", [r.id])

    const lender   = await queryOne('SELECT name FROM users WHERE id=$1', [r.owner_id])
    const borrower = await queryOne('SELECT name, email FROM users WHERE id=$1', [r.borrower_id])
    const item     = await queryOne('SELECT title FROM items WHERE id=$1', [r.item_id])

    // Send email to borrower
    try {
      const { Resend } = require('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      resend.emails.send({
        from:    'CampusShare <noreply@campusshare.co.in>',
        to:      borrower.email,
        subject: `⏰ Please return "${item?.title}" ASAP — ${lender?.name} is waiting`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1a1a1a">Hi ${borrower?.name} 👋</h2>
            <p>A gentle reminder — <strong>${lender?.name}</strong> is waiting for you to return
            <strong>"${item?.title}"</strong>. Please return it as soon as possible.</p>
            <p style="font-size:13px;color:#555">
              If you need more time or have any questions, please contact the lender directly via the
              <strong>Chat</strong> button on the transaction in the CampusShare app.
            </p>
            <p style="font-size:13px;color:#c0392b;font-weight:600">
              Delays in returning items may affect your trust score and borrowing privileges.
            </p>
            <p style="font-size:12px;color:#999;margin-top:24px">— CampusShare Team</p>
          </div>
        `
      })
    } catch (emailErr) {
      console.error('[nudge-return] Email failed:', emailErr.message)
    }

    // Push notify borrower
    sendPushNotification(r.borrower_id, {
      title: '⏰ Please return the item!',
      body: `${lender?.name} is waiting for "${item?.title}". Return it ASAP.`,
      url: '/'
    }).catch(() => {})

    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /:id/force-close — lender force-closes the transaction (no borrower
// confirmation needed). Marks borrower as flagged. Item goes to history.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/force-close', requireAuth, async (req, res) => {
  try {
    const r    = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [req.params.id])
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [r?.item_id])
    if (!r || !item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (!['active', 'overdue'].includes(r.status))
      return res.status(409).json({ error: 'Cannot force-close in current state.' })

    // Close transaction without borrower confirmation
    await query(
      "UPDATE borrow_requests SET status='returned', returned_at=NOW(), force_closed=TRUE WHERE id=$1",
      [r.id]
    )
    await query("UPDATE items SET status='available', is_deleted=TRUE WHERE id=$1", [item.id])

    // Flag the borrower — admin can review later
    await query("UPDATE users SET is_flagged=TRUE WHERE id=$1", [r.borrower_id])

    const lender   = await queryOne('SELECT name FROM users WHERE id=$1', [r.owner_id])
    const borrower = await queryOne('SELECT name, email FROM users WHERE id=$1', [r.borrower_id])

    // Notify admin
    try {
      const { Resend } = require('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail) {
        resend.emails.send({
          from:    'CampusShare <noreply@campusshare.co.in>',
          to:      adminEmail,
          subject: `🚨 Force-close: "${item?.title}" — ${borrower?.name} flagged`,
          html: `
            <div style="font-family:sans-serif;padding:24px;max-width:480px">
              <h2 style="color:#c0392b">🚨 Transaction Force-Closed</h2>
              <p><strong>${lender?.name}</strong> has force-closed the transaction for
              <strong>"${item?.title}"</strong>.</p>
              <p><strong>${borrower?.name}</strong> (${borrower?.email}) has been flagged
              for review. They failed to return the item.</p>
              <p style="font-size:13px;color:#555">Please review and take action in the admin panel.</p>
            </div>
          `
        })
      }
    } catch (emailErr) {
      console.error('[force-close] Admin email failed:', emailErr.message)
    }

    // Push admin
    sendPushNotification('admin', {
      title: '🚨 Transaction Force-Closed',
      body: `${lender?.name} closed "${item?.title}" — ${borrower?.name} has been flagged.`,
      url: '/'
    }).catch(() => {})

    res.json({ success: true })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

module.exports = router
