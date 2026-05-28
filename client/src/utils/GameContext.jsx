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
        targetScore: action.data.targetScore
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

  const startGame = useCallback((targetScore) => {
    return new Promise(resolve => {
      let settled = false
      const timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        alert('서버 응답이 없습니다. 잠시 후 다시 시도해주세요.')
        resolve({ error: 'timeout' })
      }, 10000)

      emit('start_game', { targetScore }, (res) => {
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

  const backToTitle = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return (
    <GameContext.Provider value={{ state, dispatch, joinRoom, startGame, submitAnswer, backToTitle, connected }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used inside GameProvider')
  return ctx
}
