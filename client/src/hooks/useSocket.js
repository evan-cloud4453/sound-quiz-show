import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const listenersRef = useRef({})

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      console.log('[Socket] Connected:', socket.id)
    })

    socket.on('disconnect', () => {
      setConnected(false)
      console.log('[Socket] Disconnected')
    })

    // Forward all events to registered listeners
    const forward = (event) => (...args) => {
      const handlers = listenersRef.current[event] || []
      handlers.forEach(h => h(...args))
    }

    const events = [
      'room_update', 'game_started', 'round_start',
      'answer_result', 'game_over', 'system_message'
    ]
    events.forEach(ev => socket.on(ev, forward(ev)))

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const on = useCallback((event, handler) => {
    if (!listenersRef.current[event]) listenersRef.current[event] = []
    listenersRef.current[event].push(handler)
    return () => {
      listenersRef.current[event] = listenersRef.current[event].filter(h => h !== handler)
    }
  }, [])

  const emit = useCallback((event, data, cb) => {
    if (socketRef.current) socketRef.current.emit(event, data, cb)
  }, [])

  return { emit, on, connected, socketId: socketRef.current?.id }
}
