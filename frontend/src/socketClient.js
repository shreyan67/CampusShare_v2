/**
 * socketClient.js — Frontend Socket.io connection manager
 *
 * Connects once per user session and exposes a way to register
 * event listeners. The App component calls connect(userId) on login
 * and disconnect() on logout.
 */
import { io } from 'socket.io-client'

let socket = null

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export function connect(userId) {
  if (socket?.connected) return socket

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
  if (!socket) return () => {}
  socket.on(event, handler)
  return () => socket?.off(event, handler)
}
