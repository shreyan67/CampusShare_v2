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

module.exports = router
