import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import { useSocket } from '../hooks/useSocket'

const GameContext = createContext(null)

// ★ 재접속 세션 (브라우저 종료/백그라운드 후 복귀용)
const SESSION_KEY = 'sqs_session'
function saveSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch (e) {} }
function loadSession()  { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch (e) { return null } }
function clearSession() { try { localStorage.removeItem(SESSION_KEY) } catch (e) {} }

const initialState = {
  screen: 'title',       // title | lobby | game | gameover
  roomCode: null,
  isHost: false,
  myId: null,
  nickname: '',
  players: [],
  hostId: null,
  gameStatus: 'WAITING',
  targetScore: 5,
  maxPlayers: 5,             // ★ 방 최대 인원 (방 생성 시 5~15, 기본 5)

  // ★ 게임 설정
  roundCount: 10,            // 라운드 수
  selectedCategories: [],    // 선택한 주제 ([] = 전체)
  availableCategories: [],   // 서버가 알려주는 선택 가능한 주제 목록

  // ★ 채팅
  chatMessages: [],          // { id, playerId, nickname, text, ts }

  // ★ 오프닝 자동 스킵 (재시작 시 true)
  autoSkipOpening: false,

  // round state
  currentRound: 0,
  totalRounds: 10,
  category: '',
  hint: '',
  audioUrl: null,
  youtubeId: null,
  youtubeStart: 0,
  youtubeEnd: 0,
  timeLimit: 15,
  roundActive: false,
  isBonus: false,        // ★ 보너스 라운드 여부
  pointValue: 1,         // ★ 이번 라운드 배점

  // result state
  lastResult: null,
  winner: null,
  finalScores: [],

  connectionLost: false,   // ★ false | { removed: boolean } — 연결 끊김 오버레이

  systemMsg: null
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SCREEN':     return { ...state, screen: action.screen }
    case 'SET_MY_ID':      return { ...state, myId: action.id }
    case 'SET_NICKNAME':   return { ...state, nickname: action.nickname }
    case 'JOINED_ROOM':
      return { ...state, roomCode: action.roomCode, isHost: action.isHost, screen: 'lobby' }
    case 'ROOM_UPDATE':
      return {
        ...state,
        players: action.data.players,
        hostId: action.data.hostId,
        gameStatus: action.data.status,
        targetScore: action.data.targetScore,
        maxPlayers: action.data.maxPlayers ?? state.maxPlayers,
        roundCount: action.data.roundCount ?? state.roundCount,
        // 서버가 주제 목록을 보내주면 갱신 (없으면 기존 유지)
        availableCategories: action.data.categories?.length
          ? action.data.categories
          : state.availableCategories
      }

    // ★ 설정값 저장 (게임 시작/재시작 시 재사용)
    case 'SET_GAME_CONFIG':
      return {
        ...state,
        targetScore: action.config.targetScore ?? state.targetScore,
        roundCount: action.config.roundCount ?? state.roundCount,
        selectedCategories: action.config.categories ?? state.selectedCategories
      }

    // ★ 채팅 메시지 (최근 100개만 유지)
    case 'CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.data].slice(-100) }

    // ★ 게임 종료 후 대기방으로 복귀
    case 'BACK_TO_LOBBY':
      return {
        ...state,
        screen: 'lobby',
        roundActive: false,
        currentRound: 0,
        category: '',
        hint: '',
        lastResult: null,
        winner: null,
        finalScores: []
      }

    case 'GAME_STARTED':
      return {
        ...state,
        screen: 'game',
        totalRounds: action.data.totalRounds,
        targetScore: action.data.targetScore,
        autoSkipOpening: !!action.data.autoSkipOpening,
        lastResult: null,
        winner: null
      }
    case 'ROUND_START':
      return {
        ...state,
        currentRound: action.data.round,
        totalRounds: action.data.totalRounds,
        category: action.data.category,
        hint: '',
        audioUrl: action.data.audioUrl,
        youtubeId: action.data.youtubeId,
        youtubeStart: action.data.youtubeStart || 0,
        youtubeEnd: action.data.youtubeEnd || 0,
        timeLimit: action.data.timeLimit,
        roundActive: true,
        isBonus: !!action.data.isBonus,
        pointValue: action.data.pointValue || 1,
        lastResult: null
      }
    case 'HINT_REVEALED':
      return { ...state, hint: action.data.hint || '' }
    case 'ANSWER_RESULT':
      // 이제 오답 개인 통지(correct:false)에만 쓰인다. 라운드 종료는 ROUND_RESULT.
      return {
        ...state,
        lastResult: action.data,
        roundActive: action.data.correct || action.data.noWinner || action.data.winnerId
          ? false
          : state.roundActive
      }
    case 'ROUND_RESULT':
      // ★ 라운드 종료(순위 요약). 라운드 비활성화 + 결과 오버레이용 데이터 저장.
      return {
        ...state,
        lastResult: { ...action.data, roundOver: true },
        roundActive: false
      }
    case 'GAME_OVER':
      return {
        ...state,
        screen: 'gameover',
        winner: action.data.winner,
        isDraw: action.data.isDraw,
        drawPlayers: action.data.drawPlayers,
        finalScores: action.data.finalScores,
        roundActive: false
      }
    case 'SYSTEM_MSG':
      return { ...state, systemMsg: action.text }
    case 'CLEAR_SYSTEM_MSG':
      return { ...state, systemMsg: null }
    case 'SET_CONNECTION_LOST':
      return { ...state, connectionLost: { removed: !!action.removed } }
    case 'CLEAR_CONNECTION_LOST':
      return { ...state, connectionLost: false }
    case 'RESET':
      // myId(내 소켓 id)는 소켓이 살아있는 한 유효하므로 방 나가기(RESET)에도 유지한다.
      // (지우면 같은 소켓으로 방을 다시 만들 때 소켓 id가 안 바뀌어 myId가 복구되지 않아
      //  '내가 방장인지'(me = players.find(id===myId)) 판별이 깨진다 — 방장/건너뛰기 버그)
      return { ...initialState, myId: state.myId }
    default:
      return state
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { emit, on, connected, socketId, pid } = useSocket()

  // ★ 내 소켓 ID를 myId로 저장 (서버의 hostId/플레이어 id와 동일 체계).
  //   이게 있어야 '내가 방장인지' 판별(myId === hostId)이 정확히 동작한다.
  useEffect(() => {
    if (socketId) dispatch({ type: 'SET_MY_ID', id: socketId })
  }, [socketId, connected])

  // ★ 재연결 감지 → 저장된 세션으로 자동 재입장 시도
  const prevConnectedRef = useRef(connected)
  useEffect(() => {
    const was = prevConnectedRef.current
    prevConnectedRef.current = connected
    if (connected && !was) {
      const s = loadSession()
      if (s && s.pid && s.roomCode) {
        emit('rejoin_room', { pid: s.pid, roomCode: s.roomCode }, (res) => {
          if (res?.success) {
            dispatch({ type: 'SET_NICKNAME', nickname: s.nickname || '' })
            dispatch({ type: 'JOINED_ROOM', roomCode: res.roomCode, isHost: res.isHost })
            dispatch({ type: 'CLEAR_CONNECTION_LOST' })
            // 서버가 phase에 맞춰 game_started/game_over 를 이 소켓에 보냄 → 화면 자동 복구
          } else {
            // removed / room-gone → 더 이상 복구 불가: 세션 종료 + 오버레이(메인 버튼)
            clearSession()
            dispatch({ type: 'SET_CONNECTION_LOST', removed: true })
          }
        })
      }
    }
  }, [connected, emit])

  // ★ 연결이 끊긴 채 일정 시간 지나면 '연결 끊김' 오버레이 (방에 있었던 경우만)
  useEffect(() => {
    if (connected) return
    const s = loadSession()
    if (!s) return
    const t = setTimeout(() => {
      dispatch({ type: 'SET_CONNECTION_LOST', removed: false })
    }, 8000)
    return () => clearTimeout(t)
  }, [connected])

  // Listen to socket events
  useEffect(() => {
    const unsubs = [
      on('room_update', data => dispatch({ type: 'ROOM_UPDATE', data })),
      on('game_started', data => dispatch({ type: 'GAME_STARTED', data })),
      on('round_start',  data => dispatch({ type: 'ROUND_START',  data })),
      on('hint_revealed', data => dispatch({ type: 'HINT_REVEALED', data })),
      on('answer_result',data => dispatch({ type: 'ANSWER_RESULT',data })),
      on('round_result', data => dispatch({ type: 'ROUND_RESULT', data })),
      on('game_over',    data => dispatch({ type: 'GAME_OVER',    data })),
      on('chat_message', data => dispatch({ type: 'CHAT_MESSAGE', data })),   // ★ 채팅
      on('back_to_lobby', ()  => dispatch({ type: 'BACK_TO_LOBBY' })),        // ★ 대기방 복귀
      on('kicked', () => {                                                     // ★ 강퇴 당함
        clearSession()
        dispatch({ type: 'RESET' })
        if (typeof window !== 'undefined') window.alert('방장에 의해 방에서 내보내졌습니다.')
      }),
      // ★ 방 알림(입장/퇴장/방장 위임/설정 변경/강퇴)을 채팅창에 시스템 메시지로 표시
      on('system_message', ({ text }) => {
        dispatch({ type: 'CHAT_MESSAGE', data: {
          id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          system: true, text, ts: Date.now()
        } })
      })
    ]
    return () => unsubs.forEach(u => u())
  }, [on])

  const joinRoom = useCallback((nickname, roomCode, avatar, maxPlayers) => {
    emit('join_room', { nickname, roomCode: roomCode || undefined, avatar, pid, maxPlayers }, (res) => {
      if (res.error) {
        alert(res.error)
        return
      }
      dispatch({ type: 'SET_NICKNAME', nickname })
      dispatch({ type: 'JOINED_ROOM', roomCode: res.roomCode, isHost: res.isHost })
      // ★ 재접속용 세션 저장
      saveSession({ pid, roomCode: res.roomCode, nickname, avatar: avatar || null })
    })
  }, [emit, pid])

  // ★ startGame: 이제 { targetScore, roundCount, categories } 객체를 받는다.
  //   (하위호환: 숫자만 넘어오면 targetScore로 처리)
  const startGame = useCallback((config = {}) => {
    const cfg = typeof config === 'number' ? { targetScore: config } : (config || {})
    const payload = {
      targetScore: cfg.targetScore ?? 5,
      roundCount:  cfg.roundCount  ?? 10,
      categories:  cfg.categories  ?? [],
      autoSkipOpening: !!cfg.autoSkipOpening,   // ★ 재시작이면 true
      fromRematch:     !!cfg.fromRematch        // ★ 재시작이면 준비 체크 건너뜀
    }
    dispatch({ type: 'SET_GAME_CONFIG', config: payload })

    return new Promise(resolve => {
      let settled = false
      const timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        alert('서버 응답이 없습니다. 잠시 후 다시 시도해주세요.')
        resolve({ error: 'timeout' })
      }, 10000)

      emit('start_game', payload, (res) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        if (res?.error) alert(res.error)
        resolve(res)
      })
    })
  }, [emit])

  const submitAnswer = useCallback((answer) => {
    if (!answer.trim()) return
    emit('submit_answer', { answer })
  }, [emit])

  // ★ 채팅 전송
  const sendChat = useCallback((text) => {
    const clean = String(text || '').trim()
    if (!clean) return
    emit('chat_message', { text: clean })
  }, [emit])

  // ★ 게임 종료 후 대기방으로 (방장만 서버에서 허용)
  const returnToLobby = useCallback(() => {
    emit('return_to_lobby')
  }, [emit])

  // ★ 준비완료 토글 (모든 플레이어)
  const toggleReady = useCallback(() => {
    emit('toggle_ready')
  }, [emit])

  // ★ 방장 위임 (현재 방장만)
  const transferHost = useCallback((targetId) => {
    if (!targetId) return
    emit('transfer_host', { targetId })
  }, [emit])

  // ★ 강퇴 (방장만)
  const kickPlayer = useCallback((targetId) => {
    if (!targetId) return
    emit('kick_player', { targetId })
  }, [emit])

  // ★ 방 설정 실시간 공유 (방장만) — 설정창에서 값 변경 시 호출
  const updateSettings = useCallback((settings) => {
    emit('update_settings', settings || {})
  }, [emit])

  // ★ 방 나가기 → 서버에서 방 제거 후 타이틀로 (나간 뒤 알림 받는 버그 방지)
  const backToTitle = useCallback(() => {
    emit('leave_room')
    clearSession()
    dispatch({ type: 'RESET' })
  }, [emit])

  // ★ 연결 끊김 오버레이의 '메인으로' 버튼 → 세션 종료 후 새로고침(클린 상태)
  const goMain = useCallback(() => {
    clearSession()
    if (typeof window !== 'undefined') {
      window.location.href = window.location.pathname
    }
  }, [])

  return (
    <GameContext.Provider value={{
      state, dispatch,
      joinRoom, startGame, submitAnswer,
      sendChat, returnToLobby, backToTitle,
      toggleReady, transferHost, kickPlayer, updateSettings,
      goMain,
      connected
    }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used inside GameProvider')
  return ctx
}
