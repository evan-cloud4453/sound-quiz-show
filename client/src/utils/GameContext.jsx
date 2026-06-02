import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { useSocket } from '../hooks/useSocket'

const GameContext = createContext(null)

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

  // ★ 게임 설정
  roundCount: 10,            // 라운드 수
  selectedCategories: [],    // 선택한 주제 ([] = 전체)
  availableCategories: [],   // 서버가 알려주는 선택 가능한 주제 목록

  // ★ 채팅
  chatMessages: [],          // { id, playerId, nickname, text, ts }

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

  // result state
  lastResult: null,
  winner: null,
  finalScores: [],

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
        lastResult: null
      }
    case 'HINT_REVEALED':
      return { ...state, hint: action.data.hint || '' }
    case 'ANSWER_RESULT':
      return {
        ...state,
        lastResult: action.data,
        roundActive: action.data.correct || action.data.noWinner || action.data.winnerId
          ? false
          : state.roundActive
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
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { emit, on, connected } = useSocket()

  // Listen to socket events
  useEffect(() => {
    const unsubs = [
      on('room_update', data => dispatch({ type: 'ROOM_UPDATE', data })),
      on('game_started', data => dispatch({ type: 'GAME_STARTED', data })),
      on('round_start',  data => dispatch({ type: 'ROUND_START',  data })),
      on('hint_revealed', data => dispatch({ type: 'HINT_REVEALED', data })),
      on('answer_result',data => dispatch({ type: 'ANSWER_RESULT',data })),
      on('game_over',    data => dispatch({ type: 'GAME_OVER',    data })),
      on('chat_message', data => dispatch({ type: 'CHAT_MESSAGE', data })),   // ★ 채팅
      on('back_to_lobby', ()  => dispatch({ type: 'BACK_TO_LOBBY' })),        // ★ 대기방 복귀
      on('system_message', ({ text }) => {
        dispatch({ type: 'SYSTEM_MSG', text })
        setTimeout(() => dispatch({ type: 'CLEAR_SYSTEM_MSG' }), 4000)
      })
    ]
    return () => unsubs.forEach(u => u())
  }, [on])

  const joinRoom = useCallback((nickname, roomCode) => {
    emit('join_room', { nickname, roomCode: roomCode || undefined }, (res) => {
      if (res.error) {
        alert(res.error)
        return
      }
      dispatch({ type: 'SET_NICKNAME', nickname })
      dispatch({ type: 'JOINED_ROOM', roomCode: res.roomCode, isHost: res.isHost })
    })
  }, [emit])

  // ★ startGame: 이제 { targetScore, roundCount, categories } 객체를 받는다.
  //   (하위호환: 숫자만 넘어오면 targetScore로 처리)
  const startGame = useCallback((config = {}) => {
    const cfg = typeof config === 'number' ? { targetScore: config } : (config || {})
    const payload = {
      targetScore: cfg.targetScore ?? 5,
      roundCount:  cfg.roundCount  ?? 10,
      categories:  cfg.categories  ?? []
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

  const backToTitle = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return (
    <GameContext.Provider value={{
      state, dispatch,
      joinRoom, startGame, submitAnswer,
      sendChat, returnToLobby, backToTitle,
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
