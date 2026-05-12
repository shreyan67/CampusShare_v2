import { io } from 'socket.io-client'

let socket = null
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export function connect(userId) {
  if (socket) return socket

  socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
  })

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id)
    socket.emit('identify', userId)
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
  // We expect connect() to be called before on(), so socket should exist.
  // If it doesn't, we can't listen.
  if (!socket) {
    console.warn('[socket] tried to listen to', event, 'before connect')
    return () => {}
  }
  
  socket.on(event, handler)
  return () => socket.off(event, handler)
}
