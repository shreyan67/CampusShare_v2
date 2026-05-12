import { io } from 'socket.io-client'

let socket = null
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Persistent list of active listeners to survive socket re-connections
const activeListeners = []

export function connect(userId) {
  if (socket?.connected) return socket

  if (socket) socket.disconnect()

  socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
  })

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id)
    socket.emit('identify', userId)
    // Re-apply all active listeners whenever we (re)connect
    activeListeners.forEach(({ event, handler }) => {
      socket.on(event, handler)
    })
  })

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason)
  })

  socket.on('connect_error', (err) => {
    console.warn('[socket] connect error:', err.message)
  })

  return socket
}

export function disconnect() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getSocket() {
  return socket
}

/** Subscribe to an event. Returns an unsubscribe function. */
export function on(event, handler) {
  const listener = { event, handler }
  activeListeners.push(listener)

  if (socket?.connected) {
    socket.on(event, handler)
  }

  return () => {
    const idx = activeListeners.indexOf(listener)
    if (idx !== -1) activeListeners.splice(idx, 1)
    if (socket) socket.off(event, handler)
  }
}
