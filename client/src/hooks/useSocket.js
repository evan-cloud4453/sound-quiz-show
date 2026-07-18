// client/src/hooks/useSocket.js — v4
// 수정: on() 등록 전 도달한 이벤트를 놓치지 않도록 큐잉 방식으로 변경
// timer_start처럼 컴포넌트 마운트 직후 올 수 있는 이벤트도 안전하게 수신

import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

// ★ 재접속 식별용 영구 토큰 (브라우저별 1회 생성, localStorage 보관)
function getPid() {
  try {
    let pid = localStorage.getItem('sqs_pid')
    if (!pid) {
      pid = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('sqs_pid', pid)
    }
    return pid
  } catch (e) {
    return 'p_' + Math.random().toString(36).slice(2)
  }
}

// 소켓 인스턴스를 모듈 레벨 싱글톤으로 관리
// (React StrictMode 이중 마운트에서 소켓이 두 개 생기는 문제 방지)
let globalSocket = null
let globalConnected = false

function getSocket() {
  if (!globalSocket || globalSocket.disconnected) {
    globalSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    })
  }
  return globalSocket
}

export function useSocket() {
  const [connected, setConnected] = useState(globalConnected)
  const listenersRef = useRef({}) // { eventName: Set<handler> }

  useEffect(() => {
    const socket = getSocket()

    const onConnect = () => {
      globalConnected = true
      setConnected(true)
    }
    const onDisconnect = () => {
      globalConnected = false
      setConnected(false)
    }

    socket.on('connect',    onConnect)
    socket.on('disconnect', onDisconnect)

    if (socket.connected) setConnected(true)

    // 모든 게임 이벤트를 여기서 등록하고 listenersRef로 포워딩
    const GAME_EVENTS = [
      'room_update',
      'game_started',
      'round_start',
      'answer_result',
      'game_over',
      'system_message',
      'timer_start',    // ★ 타이머 이벤트 명시적 등록
      'hint_revealed',
      'chat_message',   // ★ 채팅
      'back_to_lobby',  // ★ 게임 종료 후 대기방 복귀
      'skip_opening',   // ★ 방장의 오프닝 안내방송 스킵
      'kicked',         // ★ 강퇴 당함
      'player_guess',   // ★ 제출한 정답 실시간 말풍선(오답만 텍스트 표시)
      'player_scored',  // ★ 정답 처리(텍스트 없이 '맞혔음'만 — 부스 초록 표시)
      'round_result'    // ★ 라운드 종료 + 정답자 순위 요약
    ]

    const forwarders = {}
    GAME_EVENTS.forEach(event => {
      forwarders[event] = (...args) => {
        const handlers = listenersRef.current[event]
        if (handlers) {
          handlers.forEach(h => {
            try { h(...args) } catch(e) { console.error(`[useSocket] ${event} handler error:`, e) }
          })
        }
      }
      socket.on(event, forwarders[event])
    })

    return () => {
      socket.off('connect',    onConnect)
      socket.off('disconnect', onDisconnect)
      GAME_EVENTS.forEach(event => {
        socket.off(event, forwarders[event])
      })
    }
  }, [])

  // on(event, handler) → cleanup 함수 반환
  const on = useCallback((event, handler) => {
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = new Set()
    }
    listenersRef.current[event].add(handler)

    return () => {
      listenersRef.current[event]?.delete(handler)
    }
  }, [])

  // emit
  const emit = useCallback((event, data, cb) => {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(event, data, cb)
    } else {
      console.warn(`[useSocket] emit '${event}' 실패: 소켓 미연결`)
    }
  }, [])

  return {
    emit,
    on,
    connected,
    socketId: globalSocket?.id,
    pid: getPid()
  }
}
