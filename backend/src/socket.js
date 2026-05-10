/**
 * socket.js — Shared Socket.io instance
 *
 * All route files import { emitToUser } from './socket' to push
 * real-time updates to specific connected users without polling.
 *
 * Architecture:
 *   - One socket per user session.
 *   - userSockets Map: userId → Set<socketId>  (supports multiple tabs)
 *   - Routes call emitToUser(userId, event, payload) after any mutation.
 *   - Client handles events and refreshes only the affected data slice.
 */

let io = null

// Map of userId → Set of socket IDs connected for that user
const userSockets = new Map()

function init(server, corsOrigins) {
  const { Server } = require('socket.io')
  io = new Server(server, {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    // Client must identify itself immediately after connecting
    socket.on('identify', (userId) => {
      if (!userId) return
      socket.userId = userId

      if (!userSockets.has(userId)) userSockets.set(userId, new Set())
      userSockets.get(userId).add(socket.id)

      console.log(`[socket] User ${userId} connected (${socket.id}), total sockets: ${io.engine.clientsCount}`)
    })

    socket.on('disconnect', () => {
      const uid = socket.userId
      if (uid && userSockets.has(uid)) {
        userSockets.get(uid).delete(socket.id)
        if (userSockets.get(uid).size === 0) userSockets.delete(uid)
      }
    })
  })

  return io
}

/**
 * Emit a real-time event to a specific user (all their tabs/devices).
 * @param {string} userId   — target user's UUID
 * @param {string} event    — event name (e.g. 'refresh:requests')
 * @param {object} payload  — optional data
 */
function emitToUser(userId, event, payload = {}) {
  if (!io || !userId) return
  const sids = userSockets.get(userId)
  if (!sids || sids.size === 0) return
  for (const sid of sids) {
    io.to(sid).emit(event, payload)
  }
}

/**
 * Emit a real-time event to ALL connected users.
 * Use this for marketplace updates.
 */
function broadcast(event, payload = {}) {
  if (!io) return
  io.emit(event, payload)
}

module.exports = { init, emitToUser, broadcast }
