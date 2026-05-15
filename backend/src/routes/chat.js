const express = require('express')
const { query, queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')
const { sendPushNotification } = require('./push')
const { emitToUser } = require('../socket')

const router = express.Router()

async function checkChatAccess(requestId, userId) {
  const r = await queryOne(`
    SELECT br.*, i.listing_type
    FROM borrow_requests br
    JOIN items i ON i.id = br.item_id
    WHERE br.id=$1
  `, [requestId])
  if (!r) return { error: 'Transaction not found.', status: 404 }
  if (r.borrower_id !== userId && r.owner_id !== userId) {
    return { error: 'Not authorized to view this chat.', status: 403 }
  }
  // L&F items allow chat once claimer is approved (selected) or active
  const isLF = r.listing_type === 'lost_found'
  const allowed = ['active', 'overdue'].includes(r.status) || (isLF && r.status === 'selected')
  if (!allowed) {
    return { error: 'Chat is only available for active or overdue transactions.', status: 403 }
  }
  return { request: r }
}

// GET /api/chat/unread — Fetch all unread messages for native notification & badge
router.get('/unread', requireAuth, async (req, res) => {
  try {
    const unread = await query(`
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar,
             i.listing_type as item_listing_type
      FROM transaction_messages m
      JOIN borrow_requests br ON m.request_id = br.id
      JOIN items i ON i.id = br.item_id
      JOIN users u ON m.sender_id = u.id
      WHERE m.sender_id != $1 AND m.is_read = false
        AND (br.borrower_id = $1 OR br.owner_id = $1)
        AND (br.status IN ('active', 'overdue')
          OR (i.listing_type = 'lost_found' AND br.status = 'selected'))
      ORDER BY m.created_at ASC
    `, [req.userId])
    
    res.json({ unread: unread.rows || unread })
  } catch (err) {
    console.error('[chat unread GET]', err)
    res.status(500).json({ error: 'Failed to fetch unread messages.' })
  }
})

// PATCH /api/chat/:requestId/read — Mark messages as read
router.patch('/:requestId/read', requireAuth, async (req, res) => {
  try {
    const access = await checkChatAccess(req.params.requestId, req.userId)
    if (access.error) return res.status(access.status).json({ error: access.error })

    await query(`
      UPDATE transaction_messages 
      SET is_read = true 
      WHERE request_id = $1 AND sender_id != $2 AND is_read = false
    `, [req.params.requestId, req.userId])

    res.json({ success: true })
  } catch (err) {
    console.error('[chat PATCH read]', err)
    res.status(500).json({ error: 'Failed to mark messages as read.' })
  }
})

// GET /api/chat/:requestId — Fetch messages
router.get('/:requestId', requireAuth, async (req, res) => {
  try {
    const access = await checkChatAccess(req.params.requestId, req.userId)
    if (access.error) return res.status(access.status).json({ error: access.error })

    const messages = await query(`
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.color as sender_color 
      FROM transaction_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.request_id = $1
      ORDER BY m.created_at ASC
    `, [req.params.requestId])

    // Notice we don't automatically mark as read here. The frontend explicitly calls PATCH /read.
    res.json({ messages: messages.rows || messages })
  } catch (err) {
    console.error('[chat GET]', err)
    res.status(500).json({ error: 'Failed to fetch messages.' })
  }
})

// POST /api/chat/:requestId — Send a message
router.post('/:requestId', requireAuth, async (req, res) => {
  try {
    const { content } = req.body
    if (!content || !content.trim()) return res.status(400).json({ error: 'Message cannot be empty.' })

    const access = await checkChatAccess(req.params.requestId, req.userId)
    if (access.error) return res.status(access.status).json({ error: access.error })

    const message = await queryOne(`
      INSERT INTO transaction_messages (request_id, sender_id, content, is_read)
      VALUES ($1, $2, $3, false)
      RETURNING *
    `, [req.params.requestId, req.userId, content.trim()])

    const user = await queryOne('SELECT name, avatar, color FROM users WHERE id=$1', [req.userId])
    
    // Determine recipient
    const r = access.request
    const recipientId = (r.borrower_id === req.userId) ? r.owner_id : r.borrower_id
    
    // Send actual Web Push notification to recipient
    sendPushNotification(recipientId, {
      title: `💬 New message from ${user.name}`,
      body: content.trim(),
      url: `/?chat=${r.id}`
    })

    const fullMsg = { ...message, sender_name: user.name, sender_avatar: user.avatar, sender_color: user.color }

    // Push message instantly to the recipient via socket (they don't need to poll)
    emitToUser(recipientId, 'new:message', { requestId: r.id, message: fullMsg })
    // Also refresh unread badge for recipient
    emitToUser(recipientId, 'refresh:chat-unread')

    res.status(201).json({ message: fullMsg })
  } catch (err) {
    console.error('[chat POST]', err)
    res.status(500).json({ error: 'Failed to send message.' })
  }
})

module.exports = router
