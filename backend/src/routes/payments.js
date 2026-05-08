const express   = require('express')
const Razorpay  = require('razorpay')
const crypto    = require('crypto')
const { query, queryOne } = require('../db/pool')
const { requireAuth }     = require('../middleware/auth')

const router = express.Router()

// ── Razorpay instance (lazy init so missing keys don't crash the router) ─────
let _razorpay = null
function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env')
    }
    _razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  }
  return _razorpay
}

// ── Platform fee: Dynamic logic based on item amount ───────────────────────────
function getPlatformFeePercent(amount) {
  return parseFloat(amount) > 200 ? 5 : 8;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-order
// Creates a Razorpay order when borrower clicks "Pay Now" on a selected request.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.body

    if (!requestId)
      return res.status(400).json({ error: 'requestId is required.' })

    const borrowReq = await queryOne(
      'SELECT * FROM borrow_requests WHERE id=$1',
      [requestId]
    )

    if (!borrowReq)
      return res.status(404).json({ error: 'Borrow request not found.' })

    if (borrowReq.borrower_id !== req.userId)
      return res.status(403).json({ error: 'Not your request.' })

    if (borrowReq.status !== 'selected')
      return res.status(409).json({ error: 'Payment only allowed in selected state.' })

    if (!borrowReq.total_amount || parseFloat(borrowReq.total_amount) <= 0)
      return res.status(400).json({ error: 'This is a free item — no payment required.' })

    // Reuse existing order if one was already created and not yet paid
    if (borrowReq.razorpay_order_id && !borrowReq.payment_confirmed) {
      try {
        const existingOrder = await getRazorpay().orders.fetch(borrowReq.razorpay_order_id)
        if (existingOrder.status !== 'paid') {
          return res.json({
            orderId:  existingOrder.id,
            amount:   existingOrder.amount,
            currency: existingOrder.currency,
            keyId:    process.env.RAZORPAY_KEY_ID,
            platformFeePercent: getPlatformFeePercent(borrowReq.total_amount),
          })
        }
      } catch (_) { /* order fetch failed — fall through and create fresh */ }
    }

    // Amount in paise (1 INR = 100 paise)
    const amountPaise = Math.round(parseFloat(borrowReq.total_amount) * 100)

    const order = await getRazorpay().orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `cs_${requestId.slice(0, 20)}`,
      notes: {
        request_id:  requestId,
        borrower_id: borrowReq.borrower_id,
        owner_id:    borrowReq.owner_id,
        item_id:     borrowReq.item_id,
      },
    })

    await query(
      'UPDATE borrow_requests SET razorpay_order_id=$1 WHERE id=$2',
      [order.id, requestId]
    )

    return res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
      platformFeePercent: getPlatformFeePercent(borrowReq.total_amount),
    })

  } catch (err) {
    console.error('create-order error:', err)
    return res.status(500).json({ error: 'Failed to create payment order.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify
// Verifies Razorpay signature after checkout succeeds, marks payment_confirmed.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', requireAuth, async (req, res) => {
  try {
    const {
      requestId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body

    if (!requestId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ error: 'Missing payment verification fields.' })

    const borrowReq = await queryOne(
      'SELECT * FROM borrow_requests WHERE id=$1',
      [requestId]
    )

    if (!borrowReq)
      return res.status(404).json({ error: 'Borrow request not found.' })

    if (borrowReq.borrower_id !== req.userId)
      return res.status(403).json({ error: 'Not your request.' })

    if (borrowReq.razorpay_order_id !== razorpay_order_id)
      return res.status(409).json({ error: 'Order ID mismatch.' })

    // Cryptographic signature verification — prevents tampered payment claims
    const body     = razorpay_order_id + '|' + razorpay_payment_id
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (expected !== razorpay_signature) {
      console.error('Signature mismatch — possible tampered request')
      return res.status(400).json({ error: 'Payment verification failed. Signature invalid.' })
    }

    // Mark payment confirmed, store payment ID, and set payout_status to
    // 'manual_pending' so the admin payouts tab shows it immediately.
    await query(
      `UPDATE borrow_requests
         SET payment_confirmed   = TRUE,
             razorpay_payment_id = $1,
             payout_status       = 'manual_pending'
       WHERE id = $2`,
      [razorpay_payment_id, requestId]
    )

    return res.json({ success: true, paymentId: razorpay_payment_id })

  } catch (err) {
    console.error('verify error:', err)
    return res.status(500).json({ error: 'Payment verification failed.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// triggerLenderPayout(requestId)
//
// PHASE 1 (current): Logs the payout details to console and marks status
// 'manual_pending' so you know to pay the lender yourself via UPI.
//
// PHASE 2 (after RazorpayX business account): Replace the body of this
// function with the Razorpay Payouts API call. Everything else stays the same.
// ─────────────────────────────────────────────────────────────────────────────
async function triggerLenderPayout(requestId) {
  try {
    const borrowReq = await queryOne(
      `SELECT br.*, 
              u.upi_id  AS lender_upi_id,
              u.name    AS lender_name,
              u.email   AS lender_email,
              i.title   AS item_title
         FROM borrow_requests br
         JOIN users u ON u.id = br.owner_id
         JOIN items i ON i.id = br.item_id
        WHERE br.id = $1`,
      [requestId]
    )

    if (!borrowReq) {
      console.error(`[Payout] Request ${requestId} not found`)
      return
    }

    // Free items — no payout needed
    if (!borrowReq.total_amount || parseFloat(borrowReq.total_amount) <= 0) {
      await query(
        "UPDATE borrow_requests SET payout_status='na' WHERE id=$1",
        [requestId]
      )
      return
    }

    // rental_amount is what lender gets (total_amount - platform_fee)
    // These are stored at request creation time so they never drift
    const total        = parseFloat(borrowReq.total_amount)
    const feePercent   = getPlatformFeePercent(total)
    const lenderAmount = borrowReq.rental_amount
                           ? parseFloat(borrowReq.rental_amount)
                           : parseFloat((total * (100 - feePercent) / 100).toFixed(2))
    const platformCut  = parseFloat((total - lenderAmount).toFixed(2))

    // Mark as manual_pending so admin panel can track unpaid payouts
    await query(
      "UPDATE borrow_requests SET payout_status='manual_pending' WHERE id=$1",
      [requestId]
    )

    // ── PAYOUT DUE — log clearly so you never miss it ────────────────────────
    console.log('='.repeat(60))
    console.log('[PAYOUT DUE] Manual transfer required')
    console.log(`  Request ID   : ${requestId}`)
    console.log(`  Item         : ${borrowReq.item_title}`)
    console.log(`  Lender       : ${borrowReq.lender_name} (${borrowReq.lender_email})`)
    console.log(`  Lender UPI   : ${borrowReq.lender_upi_id || 'NOT SET — contact lender'}`)
    console.log(`  Total paid   : ₹${total}`)
    console.log(`  Platform fee : ₹${platformCut} (${feePercent}%)`)
    console.log(`  Pay lender   : ₹${lenderAmount}`)
    console.log('='.repeat(60))

    // ── PHASE 2 PLACEHOLDER ──────────────────────────────────────────────────
    // When you have a RazorpayX business account, replace everything above
    // the console.log block with the Payouts API call:
    //
    // const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
    // const response = await axios.post('https://api.getRazorpay().com/v1/payouts', {
    //   account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
    //   amount: Math.round(lenderAmount * 100),  // paise
    //   currency: 'INR',
    //   mode: 'UPI',
    //   purpose: 'payout',
    //   fund_account: {
    //     account_type: 'vpa',
    //     vpa: { address: borrowReq.lender_upi_id },
    //     contact: { name: borrowReq.lender_name, type: 'vendor', reference_id: borrowReq.owner_id },
    //   },
    //   notes: { request_id: requestId, platform_fee_percent: PLATFORM_FEE_PERCENT },
    // }, { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', 'X-Payout-Idempotency': requestId } })
    // await query("UPDATE borrow_requests SET payout_id=$1, payout_status='done' WHERE id=$2", [response.data.id, requestId])

  } catch (err) {
    console.error(`[Payout] Failed for request ${requestId}:`, err.message)
    await query(
      "UPDATE borrow_requests SET payout_status='failed' WHERE id=$1",
      [requestId]
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/admin-stats   (admin use — add ?key=YOUR_ADMIN_SECRET)
// Gets true total earnings from completed transactions.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin-stats', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Unauthorized.' })

  try {
    const { queryOne } = require('../db/pool')
    const row = await queryOne(`SELECT SUM(platform_fee) as total_earnings FROM borrow_requests WHERE payout_status = 'done'`);
    res.json({ totalEarnings: parseFloat(row?.total_earnings || 0) });
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/pending-payouts   (admin use — add ?key=YOUR_ADMIN_SECRET)
// Lists all returned paid rentals where payout is still pending.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending-payouts', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Unauthorized.' })

  try {
    const rows = await query(
      `SELECT br.id, br.total_amount, br.rental_amount, br.platform_fee,
              br.payout_status, br.returned_at, br.status AS borrow_status,
              br.razorpay_payment_id, br.payment_confirmed,
              br.pickup_details, br.item_given, br.borrower_received,
              br.borrower_complaint, br.admin_nudged_lender,
              u.name AS lender_name, u.email AS lender_email, u.upi_id AS lender_upi,
              b.name AS borrower_name, b.email AS borrower_email, b.upi_id AS borrower_upi,
              i.title AS item_title, br.admin_utr
         FROM borrow_requests br
         JOIN users u ON u.id = br.owner_id
         JOIN users b ON b.id = br.borrower_id
         JOIN items i ON i.id = br.item_id
        WHERE br.payment_confirmed = TRUE
          AND br.total_amount > 0
          AND br.payout_status IN ('manual_pending','admin_paid','disputed','refunded')
        ORDER BY br.updated_at DESC NULLS LAST, br.id DESC`,
      []
    )

    const result = rows.map(r => {
      // Use stored rental_amount/platform_fee if available (new requests),
      // fall back to recalculating for old requests that predate these columns
      const totalCollected = parseFloat(r.total_amount)
      const feePercent     = getPlatformFeePercent(totalCollected)
      const platformFee    = r.platform_fee
                               ? parseFloat(r.platform_fee)
                               : parseFloat((totalCollected * feePercent / 100).toFixed(2))
      const payLender      = r.rental_amount
                               ? parseFloat(r.rental_amount)
                               : parseFloat((totalCollected - platformFee).toFixed(2))
      return {
        requestId:       r.id,
        itemTitle:       r.item_title,
        lenderName:      r.lender_name,
        lenderEmail:     r.lender_email,
        lenderUpi:       r.lender_upi || 'NOT SET',
        payoutStatus:    r.payout_status,
        borrowStatus:    r.borrow_status,
        borrowerReceived: r.borrower_received,
        itemGiven:       r.item_given,
        borrowerComplaint: r.borrower_complaint,
        adminNudged:     r.admin_nudged_lender,
        borrowerName:    r.borrower_name,
        borrowerEmail:   r.borrower_email,
        borrowerUpi:     r.borrower_upi || 'NOT SET',
        totalCollected,
        platformFee,
        payLender,
        returnedAt:      r.returned_at,
        razorpayPayment: r.razorpay_payment_id,
        adminUtr:        r.admin_utr,
      }
    })

    res.json({ pendingPayouts: result, count: result.length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/mark-paid   (admin use — add ?key=YOUR_ADMIN_SECRET)
// After you manually pay a lender, call this to mark payout done.
// Body: { requestId }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/mark-paid', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Unauthorized.' })

  try {
    const { requestId, adminUtr } = req.body
    if (!requestId) return res.status(400).json({ error: 'requestId required.' })

    // Fetch request + lender details for notification
    const borrowReq = await queryOne(
      `SELECT br.*, br.rental_amount, br.platform_fee,
              u.name AS lender_name, u.email AS lender_email, u.upi_id AS lender_upi,
              i.title AS item_title
         FROM borrow_requests br
         JOIN users u ON u.id = br.owner_id
         JOIN items i ON i.id = br.item_id
        WHERE br.id = $1`,
      [requestId]
    )
    if (!borrowReq) return res.status(404).json({ error: 'Request not found.' })

    // Mark as admin_paid (lender needs to confirm receipt)
    await query(
      "UPDATE borrow_requests SET payout_status='admin_paid', admin_utr=$1 WHERE id=$2",
      [adminUtr || null, requestId]
    )

    // Calculate amounts for notification
    const total       = parseFloat(borrowReq.total_amount)
    const feePercent  = getPlatformFeePercent(total)
    const payLender   = borrowReq.rental_amount
                          ? parseFloat(borrowReq.rental_amount)
                          : parseFloat((total * (100 - feePercent) / 100).toFixed(2))

    // Send lender a notification email via Resend
    try {
      const { Resend } = require('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from:    'CampusShare <onboarding@resend.dev>',
        to:      borrowReq.lender_email,
        subject: `₹${payLender} sent to your UPI — ${borrowReq.item_title}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1a1a1a">Hi ${borrowReq.lender_name} 👋</h2>
            <p>We've sent your rental earnings to your UPI account.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9f9f9;border-radius:8px">
              <tr><td style="padding:10px 14px;color:#666;font-size:13px">Item</td><td style="padding:10px 14px;font-weight:600">${borrowReq.item_title}</td></tr>
              <tr><td style="padding:10px 14px;color:#666;font-size:13px">Amount sent</td><td style="padding:10px 14px;font-weight:600;color:#2e7d32">₹${payLender}</td></tr>
              <tr><td style="padding:10px 14px;color:#666;font-size:13px">Sent to UPI</td><td style="padding:10px 14px;font-family:monospace">${borrowReq.lender_upi || 'your registered UPI'}</td></tr>
              ${adminUtr ? `<tr><td style="padding:10px 14px;color:#666;font-size:13px">Bank UTR Ref No.</td><td style="padding:10px 14px;font-family:monospace;font-weight:700;color:#1d4ed8">${adminUtr}</td></tr>` : ''}
            </table>
            <p style="font-size:13px;color:#555">
              Please check your UPI app. Once you receive the payment, open the <strong>Activity tab</strong>
              in CampusShare and click <strong>"Payment Received ✓"</strong> on this rental.
            </p>
            <p style="font-size:13px;color:#555">
              If you don't receive the payment within 24 hours, click <strong>"Raise Dispute"</strong>
              and we'll look into it right away.
            </p>
            <p style="font-size:12px;color:#999;margin-top:24px">— CampusShare Team</p>
          </div>
        `
      })
      console.log(`[mark-paid] Notification email sent to ${borrowReq.lender_email}`)
    } catch (emailErr) {
      // Email failure should NOT block the mark-paid response
      console.error('[mark-paid] Email failed:', emailErr.message)
    }

    res.json({ success: true, payLender, lenderEmail: borrowReq.lender_email })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/dismiss-dispute   (admin use — add ?key=YOUR_ADMIN_SECRET)
// Force close a fraudulent dispute from a lender.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/dismiss-dispute', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Unauthorized.' })

  try {
    const { requestId } = req.body
    if (!requestId) return res.status(400).json({ error: 'requestId required.' })

    const { query } = require('../db/pool')
    // Set back to admin_paid or done. Since it's dismissed and we already paid, mark it done.
    await query("UPDATE borrow_requests SET payout_status='done' WHERE id=$1", [requestId])
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/nudge-lender   (admin use — add ?key=YOUR_ADMIN_SECRET)
// Nudge a lender because the borrower complained about lack of response.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/nudge-lender', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Unauthorized.' })

  try {
    const { requestId } = req.body
    if (!requestId) return res.status(400).json({ error: 'requestId required.' })

    const borrowReq = await queryOne(
      `SELECT br.*, u.name AS lender_name, u.email AS lender_email, i.title AS item_title
         FROM borrow_requests br
         JOIN users u ON u.id = br.owner_id
         JOIN items i ON i.id = br.item_id
        WHERE br.id = $1`,
      [requestId]
    )
    if (!borrowReq) return res.status(404).json({ error: 'Request not found.' })

    await query("UPDATE borrow_requests SET admin_nudged_lender=TRUE WHERE id=$1", [requestId])

    try {
      const { Resend } = require('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from:    'CampusShare <noreply@campusshare.co.in>',
        to:      borrowReq.lender_email,
        subject: `ACTION REQUIRED: Borrower is waiting for ${borrowReq.item_title}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#c0392b">Hi ${borrowReq.lender_name},</h2>
            <p>The borrower of <strong>${borrowReq.item_title}</strong> has reported that they are still waiting for you to hand over the item.</p>
            <p>They have already paid for this transaction. Please log in to CampusShare and send your pickup details or confirm the handover.</p>
            <p>If the item is not handed over soon, we may have to cancel the transaction and refund the borrower.</p>
            <p style="font-size:12px;color:#999;margin-top:24px">— CampusShare Admin</p>
          </div>
        `
      })
      console.log(`[nudge-lender] Notification email sent to ${borrowReq.lender_email}`)
    } catch (emailErr) {
      console.error('[nudge-lender] Email failed:', emailErr.message)
    }

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/refund-borrower   (admin use — add ?key=YOUR_ADMIN_SECRET)
// Refund the borrower, mark payout as refunded, free the slot.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refund-borrower', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: 'Unauthorized.' })

  try {
    const { requestId } = req.body
    if (!requestId) return res.status(400).json({ error: 'requestId required.' })

    const borrowReq = await queryOne('SELECT * FROM borrow_requests WHERE id=$1', [requestId])
    if (!borrowReq) return res.status(404).json({ error: 'Request not found.' })

    // Mark refunded, closed
    await query(
      "UPDATE borrow_requests SET payout_status='refunded', status='returned', returned_at=NOW() WHERE id=$1",
      [requestId]
    )
    
    // Set item back to available, since the transaction is cancelled
    await query("UPDATE items SET status='available' WHERE id=$1", [borrowReq.item_id])

    const { promoteIfEligible } = require('../services/trust')
    // Free the borrower's slot by incrementing return_count
    await query('UPDATE users SET return_count=return_count+1 WHERE id=$1', [borrowReq.borrower_id])
    await promoteIfEligible(borrowReq.borrower_id)

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

module.exports = router
module.exports.triggerLenderPayout = triggerLenderPayout
