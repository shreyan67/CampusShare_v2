const express  = require('express')
const multer   = require('multer')
const { query, queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const { broadcast } = require('../socket')
const { notifyCollege } = require('./push')

const router  = express.Router()

// No longer using multer, images are uploaded directly to Cloudinary from the frontend

// GET /api/items/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const cid = req.collegeId
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM items WHERE college_id=$1 AND status='available' AND is_deleted=FALSE) as avail,
        (SELECT COUNT(*) FROM items WHERE college_id=$1 AND is_deleted=FALSE) as total,
        (SELECT COUNT(*) FROM users WHERE college_id=$1 AND is_verified=TRUE) as students,
        (SELECT COUNT(*) FROM borrow_requests br JOIN items i ON br.item_id=i.id WHERE i.college_id=$1 AND br.status='returned') as borrows,
        (SELECT COUNT(*) FROM borrow_requests br JOIN items i ON br.item_id=i.id WHERE i.college_id=$1 AND br.status='pending') as pending
    `, [cid])
    const row = stats[0] || { avail: 0, total: 0, students: 0, borrows: 0, pending: 0 }
    res.json({
      available: +row.avail, total: +row.total,
      students: +row.students, borrows: +row.borrows, pending: +row.pending,
    })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, status, search, listingType } = req.query

    const conds  = ['i.college_id=$1', "i.is_deleted = FALSE"]
    const params = [req.collegeId]
   

    // ✅ listing type filter (IMPORTANT)
    if (listingType) {
      params.push(listingType)
      conds.push(`i.listing_type=$${params.length}`)
    }

    if (category && category !== 'all') {
      params.push(category)
      conds.push(`i.category=$${params.length}`)
    }

    // For marketplace listings, always exclude 'borrowed' items unless a specific status is requested
    if (status && status !== 'closed') {
      params.push(status)
      conds.push(`i.status=$${params.length}`)
    } else if (listingType === 'borrow' || !listingType) {
      // Default: only show available items in marketplace
      conds.push(`i.status='available'`)
    }

    if (search) {
      params.push(`%${search}%`)
      conds.push(`(i.title ILIKE $${params.length} OR i.category ILIKE $${params.length})`)
    }

    const items = await query(`
      SELECT i.*,
             u.name AS owner_name, u.trust_tier AS owner_tier,
             u.avatar AS owner_avatar, u.color AS owner_color
      FROM items i 
      JOIN users u ON i.owner_id=u.id
      WHERE ${conds.join(' AND ')}
      ORDER BY i.created_at DESC 
      LIMIT 100
    `, params)

    res.json({ items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load items.' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, category, conditionNotes, maxBorrowDays, isPaid, pricePerDay, allowMultiple, transactionType, photos } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' })

    const validCats = ['Books & Notes', 'Lab Equipment', 'Electronics', 'Accessories', 'Stationary', 'Food', 'Other']
    if (!validCats.includes(category)) return res.status(400).json({ error: 'Invalid category.' })

    // Check user is verified
    const u = await queryOne('SELECT id, is_verified, is_flagged FROM users WHERE id=$1', [req.userId])
    if (!u?.is_verified) return res.status(403).json({ error: 'Verify your account first.' })
    if (u.is_flagged) return res.status(403).json({ error: 'Your account is flagged. Please contact admin.' })

    // URLs from Cloudinary
    const images = Array.isArray(photos) ? photos : (photos ? [photos] : [])

    const paid  = isPaid === 'true' || isPaid === true
    const price = paid ? parseFloat(pricePerDay || 0) : 0

    // Derive transaction_type from explicit param, or fall back to paid/free detection
    const validTxTypes = ['rent','sell','donate','lend']
    const txType = validTxTypes.includes(transactionType) ? transactionType
                 : paid ? 'rent' : 'lend'

    const item = await queryOne(`
      INSERT INTO items(
  college_id,owner_id,title,category,
  condition_notes,max_borrow_days,
  is_paid,price_per_day,images,listing_type,allow_multiple,transaction_type
)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [
  req.collegeId,
  req.userId,
  title.trim(),
  category,
  (conditionNotes||'').trim(),
  +maxBorrowDays||7,
  paid,
  price,
  images,
  req.body.listingType || 'borrow',
  allowMultiple === 'true' || allowMultiple === true,
  txType,
])

    res.status(201).json({ item })
    broadcast('refresh:items')

    // If it's a Lost & Found post, notify all college users so they can claim it
    if ((req.body.listingType || 'borrow') === 'lost_found') {
      const poster = await queryOne('SELECT name FROM users WHERE id=$1', [req.userId])
      notifyCollege(req.collegeId, req.userId, {
        title: '🔍 Lost & Found — Item Reported!',
        body: `${poster?.name || 'Someone'} found "${title.trim()}" — is it yours?`,
        url: '/'
      }).catch(() => {})
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to list item.' }) }
})

// DELETE /api/items/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [req.params.id])
    if (!item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (item.status === 'borrowed') return res.status(409).json({ error: 'Cannot delete while borrowed.' })
    await query('DELETE FROM items WHERE id=$1', [req.params.id])
    res.json({ success: true })
    broadcast('refresh:items')
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

// PATCH /api/items/:id
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const item = await queryOne('SELECT * FROM items WHERE id=$1', [req.params.id])
    if (!item) return res.status(404).json({ error: 'Not found.' })
    if (item.owner_id !== req.userId) return res.status(403).json({ error: 'Not your item.' })
    if (item.status !== 'available') return res.status(409).json({ error: 'Cannot edit an item that is currently requested or borrowed.' })

    const { title, category, conditionNotes, maxBorrowDays, isPaid, pricePerDay, allowMultiple, transactionType, photos } = req.body
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' })

    const validCats = ['Books & Notes','Lab Equipment','Electronics','Accessories','Food','Stationary','Other']
    if (!validCats.includes(category)) return res.status(400).json({ error: 'Invalid category.' })

    const paid  = isPaid === 'true' || isPaid === true
    const price = paid ? parseFloat(pricePerDay || 0) : 0

    const validTxTypes = ['rent','sell','donate','lend']
    const txType = validTxTypes.includes(transactionType) ? transactionType : paid ? 'rent' : 'lend'

    let updated;
    if (photos !== undefined) {
      const images = Array.isArray(photos) ? photos : (photos ? [photos] : [])
      updated = await queryOne(`
        UPDATE items
        SET title=$1, category=$2, condition_notes=$3, max_borrow_days=$4, is_paid=$5, price_per_day=$6, allow_multiple=$7, transaction_type=$8, images=$9
        WHERE id=$10 RETURNING *
      `, [
        title.trim(), category, (conditionNotes||'').trim(), +maxBorrowDays||7, paid, price, allowMultiple === 'true' || allowMultiple === true, txType, images, req.params.id
      ])
    } else {
      updated = await queryOne(`
        UPDATE items
        SET title=$1, category=$2, condition_notes=$3, max_borrow_days=$4, is_paid=$5, price_per_day=$6, allow_multiple=$7, transaction_type=$8
        WHERE id=$9 RETURNING *
      `, [
        title.trim(), category, (conditionNotes||'').trim(), +maxBorrowDays||7, paid, price, allowMultiple === 'true' || allowMultiple === true, txType, req.params.id
      ])
    }

    res.json({ item: updated })
    broadcast('refresh:items')
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to edit item.' }) }
})

module.exports = router
