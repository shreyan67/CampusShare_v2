const express = require('express')
const { query, queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const { sendPushNotification, notifyCollege } = require('./push')
const { emitToUser, broadcast } = require('../socket')

const router = express.Router()

// ── ITEM REQUESTS (borrower posts "I need X") ────────────────────────────────

// GET /api/item-requests  — list all open requests for this college
router.get('/', requireAuth, async (req, res) => {
  try {
    const { search } = req.query
    const conds  = ['ir.college_id=$1']
    const params = [req.collegeId]

    if (search) {
      params.push(`%${search}%`)
      conds.push(`(ir.title ILIKE $${params.length} OR ir.description ILIKE $${params.length})`)
    }

    // Include open requests, OR requests that are closed but the current user is either the requester or the accepted offerer
    params.push(req.userId)
    conds.push(`(ir.status='open' OR ir.requester_id=$${params.length} OR EXISTS (SELECT 1 FROM item_request_offers o WHERE o.request_id = ir.id AND o.offerer_id=$${params.length} AND o.status='accepted'))`)

    const rows = await query(`
      SELECT ir.*,
             u.name AS requester_name, u.avatar AS requester_avatar,
             u.color AS requester_color, u.trust_tier AS requester_tier,
             (SELECT COUNT(*) FROM item_request_offers o WHERE o.request_id = ir.id AND o.status = 'pending') AS offer_count
        FROM item_requests ir
        JOIN users u ON u.id = ir.requester_id
       WHERE ${conds.join(' AND ')}
       ORDER BY ir.created_at DESC
       LIMIT 50
    `, params)

    res.json({ requests: rows })
  } catch (err) {
    console.error('[item-requests GET]', err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// GET /api/item-requests/mine — requests I posted + offers I made
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const myRequests = await query(`
        SELECT ir.*,
               (SELECT COUNT(*) FROM item_request_offers o WHERE o.request_id = ir.id AND o.status='pending') AS offer_count,
               (SELECT COUNT(*) FROM item_request_offers o WHERE o.request_id = ir.id AND o.status='accepted') AS accepted_count
          FROM item_requests ir WHERE ir.requester_id=$1 ORDER BY ir.created_at DESC
      `, [req.userId])
      
    const myOffers = await query(`
        SELECT o.*, ir.title AS request_title, ir.description AS request_description,
               u.name AS requester_name
          FROM item_request_offers o
          JOIN item_requests ir ON ir.id = o.request_id
          JOIN users u ON u.id = ir.requester_id
         WHERE o.offerer_id=$1
         ORDER BY o.created_at DESC
      `, [req.userId])

    res.json({ myRequests, myOffers })
  } catch (err) {
    console.error('[item-requests/mine]', err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// POST /api/item-requests  — borrower posts a need
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, category, urgency } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' })

    const u = await queryOne('SELECT id, name, is_verified, is_flagged FROM users WHERE id=$1', [req.userId])
    if (!u?.is_verified) return res.status(403).json({ error: 'Verify your account first.' })
    if (u.is_flagged)    return res.status(403).json({ error: 'Your account is flagged. Please contact admin.' })

    const validUrgency = ['low', 'medium', 'high']
    const validCats = ['Books & Notes', 'Lab Equipment', 'Electronics', 'Accessories', 'Stationary', 'Food', 'Other', 'Any']

    const row = await queryOne(`
      INSERT INTO item_requests(college_id, requester_id, title, description, category, urgency)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *
    `, [
      req.collegeId,
      req.userId,
      title.trim(),
      (description || '').trim(),
      validCats.includes(category) ? category : 'Any',
      validUrgency.includes(urgency) ? urgency : 'medium',
    ])

    res.status(201).json({ request: row })
    broadcast('refresh:item-requests')
    // Notify all other users in this college about the new request
    notifyCollege(req.collegeId, req.userId, {
      title: `🔍 ${u.name} needs something!`,
      body: `"${title.trim()}" — Can you help?`,
      url: '/?requests=all'
    })
  } catch (err) {
    console.error('[item-requests POST]', err)
    res.status(500).json({ error: 'Failed to post request.' })
  }
})

// PATCH /api/item-requests/:id/close — requester closes their request
router.patch('/:id/close', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM item_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.requester_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    await query("UPDATE item_requests SET status='closed' WHERE id=$1", [req.params.id])
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// PATCH /api/item-requests/:id — edit an open request
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM item_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Not found.' })
    if (r.requester_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (r.status !== 'open') return res.status(409).json({ error: 'Cannot edit a closed request.' })

    const { title, description, category, urgency } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' })

    const validUrgency = ['low', 'medium', 'high']
    const validCats = ['Books & Notes','Lab Equipment','Electronics','Accessories','Food','Stationary','Other','Any']

    const updated = await queryOne(`
      UPDATE item_requests
      SET title=$1, description=$2, category=$3, urgency=$4
      WHERE id=$5 RETURNING *
    `, [
      title.trim(),
      (description || '').trim(),
      validCats.includes(category) ? category : 'Any',
      validUrgency.includes(urgency) ? urgency : 'medium',
      req.params.id
    ])

    res.json({ request: updated })
  } catch (err) {
    console.error('[item-requests PATCH]', err)
    res.status(500).json({ error: 'Failed to edit request.' })
  }
})

// ── OFFERS on item requests ───────────────────────────────────────────────────

// GET /api/item-requests/:id/offers — get all offers on a request
router.get('/:id/offers', requireAuth, async (req, res) => {
  try {
    const offers = await query(`
      SELECT o.*, u.name AS offerer_name, u.avatar AS offerer_avatar,
             u.color AS offerer_color, u.trust_tier AS offerer_tier
        FROM item_request_offers o
        JOIN users u ON u.id = o.offerer_id
       WHERE o.request_id=$1
       ORDER BY o.created_at ASC
    `, [req.params.id])
    res.json({ offers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

// POST /api/item-requests/:id/offers — lender makes an offer
// offer includes: transaction_type (rent|sell|donate|lend), note, price (if rent/sell)
router.post('/:id/offers', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM item_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Request not found.' })
    if (r.requester_id === req.userId) return res.status(400).json({ error: 'Cannot offer on your own request.' })
    if (r.status !== 'open') return res.status(409).json({ error: 'Request is no longer open.' })
    if (r.college_id !== req.collegeId) return res.status(403).json({ error: 'Different college.' })

    const { transactionType, note, price } = req.body
    const validTypes = ['rent', 'sell', 'donate', 'lend']
    if (!validTypes.includes(transactionType)) return res.status(400).json({ error: 'Invalid transaction type.' })

    const u = await queryOne('SELECT is_flagged FROM users WHERE id=$1', [req.userId])
    if (u?.is_flagged) return res.status(403).json({ error: 'Your account is flagged. Please contact admin.' })

    const isPaid = ['rent', 'sell'].includes(transactionType)
    if (isPaid && (!price || parseFloat(price) <= 0)) {
      return res.status(400).json({ error: 'Price is required for rent/sell offers.' })
    }

    // Check for existing offer from this user
    const existing = await queryOne(
      'SELECT id FROM item_request_offers WHERE request_id=$1 AND offerer_id=$2 AND status=$3',
      [req.params.id, req.userId, 'pending']
    )
    if (existing) return res.status(409).json({ error: 'You already have a pending offer on this request.' })

    const offer = await queryOne(`
      INSERT INTO item_request_offers(request_id, offerer_id, transaction_type, note, price)
      VALUES($1,$2,$3,$4,$5) RETURNING *
    `, [
      req.params.id,
      req.userId,
      transactionType,
      (note || '').trim(),
      isPaid ? parseFloat(price) : 0,
    ])
    // Notify requester
    sendPushNotification(r.requester_id, {
      title: '🎁 New Offer Received!',
      body: `Someone offered to ${transactionType} you "${r.title}". Tap to view.`,
      url: '/?requests=mine'
    })
    emitToUser(r.requester_id, 'refresh:item-requests')
    broadcast('refresh:item-requests')

    res.status(201).json({ offer })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to make offer.' })
  }
})

// PATCH /api/item-requests/:id/offers/:offerId/accept
// Requester accepts an offer → creates an item + borrow_request automatically
router.patch('/:id/offers/:offerId/accept', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM item_requests WHERE id=$1', [req.params.id])
    if (!r) return res.status(404).json({ error: 'Request not found.' })
    if (r.requester_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    if (r.status !== 'open') return res.status(409).json({ error: 'Request already closed.' })

    const offer = await queryOne(`
      SELECT o.*, u.upi_id AS offerer_upi FROM item_request_offers o
      JOIN users u ON u.id = o.offerer_id WHERE o.id=$1
    `, [req.params.offerId])
    if (!offer) return res.status(404).json({ error: 'Offer not found.' })
    if (offer.request_id !== req.params.id) return res.status(400).json({ error: 'Offer does not match request.' })

    const isPaid = ['rent', 'sell'].includes(offer.transaction_type)

    // 1. Create a virtual item for this offer
    const PLATFORM_FEE_PERCENT = 3
    const price = parseFloat(offer.price || 0)

    const item = await queryOne(`
      INSERT INTO items(college_id, owner_id, title, category, condition_notes,
                        max_borrow_days, is_paid, price_per_day, listing_type,
                        transaction_type, allow_multiple)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'request_offer',$9,false) RETURNING *
    `, [
      r.college_id,
      offer.offerer_id,
      r.title,
      r.category !== 'Any' ? r.category : 'Other',
      offer.note || '',
      offer.transaction_type === 'sell' ? 1 : 7, // sell = 1 day duration
      isPaid,
      isPaid ? price : 0,
      offer.transaction_type,
    ])

    // 2. Create borrow_request in 'selected' state (both parties agreed)
    const rentalAmount = isPaid ? price : 0
    const platformFee  = isPaid ? parseFloat((rentalAmount * PLATFORM_FEE_PERCENT / 100).toFixed(2)) : 0
    const total        = parseFloat((rentalAmount + platformFee).toFixed(2))

    const requestedDays = offer.transaction_type === 'sell' ? 1 : 7
    const status = isPaid ? 'selected' : 'active'
    const dueAt = isPaid ? null : new Date(Date.now() + requestedDays * 864e5)
    const pin = status === 'active' ? Math.floor(1000 + Math.random() * 9000).toString() : null

    const borrowReq = await queryOne(`
      INSERT INTO borrow_requests(
        item_id, borrower_id, owner_id, requested_days, message, status,
        total_amount, rental_amount, platform_fee, payment_confirmed, due_at, handover_pin
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [
      item.id,
      req.userId,          // requester becomes borrower
      offer.offerer_id,    // offerer becomes lender/seller
      requestedDays,
      r.description || '',
      status,
      total,
      rentalAmount,
      platformFee,
      !isPaid,             // non-paid = auto payment_confirmed
      dueAt,
      pin
    ])

    // 3. Mark request as closed, decline other offers
    await query("UPDATE item_requests SET status='closed', accepted_offer_id=$1 WHERE id=$2", [offer.id, r.id])
    await query(
      "UPDATE item_request_offers SET status='declined' WHERE request_id=$1 AND id<>$2 AND status='pending'",
      [r.id, offer.id]
    )
    await query("UPDATE item_request_offers SET status='accepted' WHERE id=$1", [offer.id])

    // Notify offerer that their offer was accepted
    sendPushNotification(offer.offerer_id, {
      title: '✅ Offer Accepted!',
      body: `Your offer for "${r.title}" was accepted!`,
      url: '/?activity=lending'
    })
    emitToUser(offer.offerer_id, 'refresh:requests')
    emitToUser(req.userId, 'refresh:item-requests')
    broadcast('refresh:item-requests')

    res.json({ success: true, borrowRequestId: borrowReq.id, itemId: item.id })
  } catch (err) {
    console.error('[accept offer]', err)
    res.status(500).json({ error: 'Failed to accept offer.' })
  }
})

// PATCH /api/item-requests/:id/offers/:offerId/decline
router.patch('/:id/offers/:offerId/decline', requireAuth, async (req, res) => {
  try {
    const r = await queryOne('SELECT * FROM item_requests WHERE id=$1', [req.params.id])
    if (!r || r.requester_id !== req.userId) return res.status(403).json({ error: 'Not your request.' })
    await query("UPDATE item_request_offers SET status='declined' WHERE id=$1", [req.params.offerId])

    const offer = await queryOne('SELECT offerer_id, request_id FROM item_request_offers WHERE id=$1', [req.params.offerId])
    const reqItem = await queryOne('SELECT title FROM item_requests WHERE id=$1', [offer.request_id])
    
    sendPushNotification(offer.offerer_id, {
      title: '❌ Offer Declined',
      body: `Your offer for "${reqItem.title}" was declined.`,
      url: '/'
    })
    emitToUser(offer.offerer_id, 'refresh:requests')
    emitToUser(req.userId, 'refresh:item-requests')

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed.' })
  }
})

module.exports = router
