// client/src/pages/GameScreen.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../utils/GameContext'
import { useSocket } from '../hooks/useSocket' 

import WaveformVisualizer from '../components/WaveformVisualizer'
import TimerRing from '../components/TimerRing'
import './GameScreen.css'

const YOUTUBE_PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2
}

let youtubeApiPromise = null

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('YouTube API requires a browser'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()
      resolve(window.YT)
    }

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => reject(new Error('Failed to load YouTube IFrame API'))
      document.head.appendChild(script)
    }
  })

  return youtubeApiPromise
}

function getClipEnd(start, end) {
  return end > start ? end : start + 10
}

const AVATARS = ['🚀', '⭐', '🌙', '💫', '🪐', '☄️', '🌟', '🎵', '👾', '🛸', '🌌', '🔭']
function getAvatar(id) {
  return AVATARS[(id?.charCodeAt(id.length - 1) || 0) % AVATARS.length]
}

export default function GameScreen() {
  const { state, submitAnswer } = useGame()
  const { emit } = useSocket()
  const {
    players, myId, nickname,
    currentRound, totalRounds, category, hint,
    youtubeId, youtubeStart, youtubeEnd,
    roundActive, lastResult, targetScore,
    isTimerRunning
  } = state

  const [answer, setAnswer] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [timerActive, setTimerActive] = useState(false)
  const [mediaLoaded, setMediaLoaded] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [flashWrong, setFlashWrong] = useState(false)
  const [phaseLabel, setPhaseLabel] = useState('다음 라운드 준비 중...')
  const [showResult, setShowResult] = useState(false)
  const [playbackBlocked, setPlaybackBlocked] = useState(false)
  const [playbackError, setPlaybackError] = useState(false)

  const inputRef = useRef(null)
  const playerRef = useRef(null)
  const playerHostIdRef = useRef(`Youtubeer-${Math.random().toString(36).slice(2)}`)
  const roundTokenRef = useRef(0)

  const failSafeTimerRef = useRef(null)
  const audioStopTimerRef = useRef(null)
  const tickTimersRef = useRef([])

  // 💡 Web Audio API 기반의 무결점 째깍째깍 사운드 합성 오실레이터
  const playTickSound = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.type = 'sine'
      osc.frequency.setValueAtTime(850, ctx.currentTime) // 깔끔하고 경쾌한 메트로놈 피치
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.start()
      osc.stop(ctx.currentTime + 0.05)
    } catch (e) {
      console.error("Audio Tick Error:", e)
    }
  }, [])

  const clearTickTimers = useCallback(() => {
    tickTimersRef.current.forEach(t => clearTimeout(t))
    tickTimersRef.current = []
  }, [])

  const playYouTube = useCallback(() => {
    const player = playerRef.current
    if (!player || !youtubeId) return

    try {
      player.playVideo()
      setPlaybackBlocked(false)
      setPlaybackError(false)
      setPhaseLabel('소리를 들어보세요!')
    } catch (error) {
      setPlaybackBlocked(true)
      setPhaseLabel('재생 버튼을 눌러주세요')
    }
  }, [youtubeId])

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.destroy?.()
      } catch (error) {}
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    const roundToken = roundTokenRef.current + 1
    roundTokenRef.current = roundToken

    setAnswer('')
    setSubmitted(false)
    setFlashWrong(false)
    setIsPlaying(false)
    setTimerActive(false)
    setMediaLoaded(false)
    setShowResult(false)
    setPlaybackBlocked(false)
    setPlaybackError(false)
    setPhaseLabel('YouTube 플레이어 준비 중...')

    clearTimeout(failSafeTimerRef.current)
    clearTimeout(audioStopTimerRef.current)
    clearTickTimers()

    if (!youtubeId) {
      setMediaLoaded(true)
      if (currentRound > 0) {
        setPlaybackError(true)
        emit('skip_round') // 영상 ID가 비어있다면 지연 없이 즉시 폭풍 스킵!
      } else {
        setPhaseLabel('다음 라운드 준비 중...')
      }
      return undefined
    }

    // 로딩 무한 지연을 막기 위한 클라이언트 방어막 타이머 (10초)
    failSafeTimerRef.current = setTimeout(() => {
      setIsPlaying(false)
      setTimerActive(false)
      emit('skip_round')
    }, 10000)

    let cancelled = false
    const startSeconds = Number(youtubeStart) || 0
    const endSeconds = getClipEnd(startSeconds, Number(youtubeEnd) || 0)

    const loadClip = (player) => {
      if (cancelled || roundTokenRef.current !== roundToken) return

      setMediaLoaded(true)
      setPhaseLabel('소리를 들어보세요!')
      player.loadVideoById({
        videoId: youtubeId,
        startSeconds,
        endSeconds
      })
      setTimeout(() => {
        if (!cancelled && roundTokenRef.current === roundToken) playYouTube()
      }, 150)
    }

    loadYouTubeApi()
      .then(YT => {
        if (cancelled || roundTokenRef.current !== roundToken) return

        if (playerRef.current?.loadVideoById) {
          loadClip(playerRef.current)
          return
        }

        playerRef.current = new YT.Player(playerHostIdRef.current, {
          width: 220,
          height: 200,
          videoId: youtubeId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0,
            start: Math.floor(startSeconds),
            end: Math.floor(endSeconds),
            origin: window.location.origin
          },
          events: {
            onReady: event => loadClip(event.target),
            onStateChange: event => {
              if (event.data === YOUTUBE_PLAYER_STATE.PLAYING) {
                clearTimeout(failSafeTimerRef.current)

                setIsPlaying(true)
                setTimerActive(true)
                setPlaybackBlocked(false)
                setPlaybackError(false)
                setPhaseLabel('소리를 들어보세요!')
                emit('youtube_playing')

                clearTimeout(audioStopTimerRef.current)
                // 10초 소리 재생 후 정지 및 나머지 5초 째깍째깍 기동!
                audioStopTimerRef.current = setTimeout(() => {
                  try { playerRef.current?.pauseVideo?.() } catch (e) {}
                  setIsPlaying(false)
                  
                  clearTickTimers()
                  // 남은 5초 동안 1초 간격으로 정확히 5번 째깍 사운드 런칭
                  for (let i = 0; i < 5; i++) {
                    tickTimersRef.current.push(
                      setTimeout(() => {
                        playTickSound()
                      }, i * 1000)
                    )
                  }
                }, 10000)
              }
              if (event.data === YOUTUBE_PLAYER_STATE.PAUSED || event.data === YOUTUBE_PLAYER_STATE.ENDED) {
                setIsPlaying(false)
              }
            },
            // 🚨 유튜브 재생 제한 등의 에러 감지 시 어떤 지연이나 문구 출력도 없이 0.1초 만에 스킵 신호 발사!
            onError: () => {
              clearTimeout(failSafeTimerRef.current)
              clearTimeout(audioStopTimerRef.current)
              clearTickTimers()
              setIsPlaying(false)
              emit('skip_round') 
            },
            onAutoplayBlocked: () => {
              setMediaLoaded(true)
              setIsPlaying(false)
              setPlaybackBlocked(true)
              setPhaseLabel('재생 버튼을 눌러주세요')
            }
          }
        })
      })
      .catch(() => {
        setIsPlaying(false)
        emit('skip_round')
      })

    return () => {
      cancelled = true
      clearTimeout(failSafeTimerRef.current)
      clearTimeout(audioStopTimerRef.current)
      clearTickTimers()
      try {
        playerRef.current?.stopVideo?.()
      } catch (error) {}
    }
  }, [youtubeId, youtubeStart, youtubeEnd, currentRound, playYouTube, emit, playTickSound, clearTickTimers])

  useEffect(() => {
    if (roundActive && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [roundActive])

  useEffect(() => {
    if (!roundActive) {
      setTimerActive(false)
      clearTimeout(failSafeTimerRef.current)
      clearTimeout(audioStopTimerRef.current)
      clearTickTimers()
    }
  }, [roundActive, clearTickTimers])

  useEffect(() => {
    if (lastResult) {
      const isRoundResult = lastResult.correct || lastResult.noWinner || lastResult.winnerId
      if (!isRoundResult) return undefined

      try {
        playerRef.current?.pauseVideo?.()
      } catch (error) {}
      
      setIsPlaying(false)
      clearTickTimers() // 정답자가 선점했거나 라운드 타임오버가 확정되면 째깍 사운드 즉시 폐기

      setShowResult(true)
      setPhaseLabel(lastResult.correct ? '🎉 정답!' : '⏰ 라운드 종료!')
      const t = setTimeout(() => setShowResult(false), 2500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [lastResult, clearTickTimers])

  const handleSubmit = useCallback(() => {
    if (!answer.trim() || submitted || !roundActive) return
    setSubmitted(true)
    submitAnswer(answer.trim())
  }, [answer, submitted, roundActive, submitAnswer])

  const handleKey = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  useEffect(() => {
    if (lastResult && !lastResult.correct && !lastResult.noWinner && !lastResult.winnerId) {
      setSubmitted(false) 
      setAnswer('')
      setFlashWrong(true)
      setTimeout(() => setFlashWrong(false), 600)
      inputRef.current?.focus()
    }
  }, [lastResult])

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const progressPct = totalRounds > 0 ? ((currentRound - 1) / totalRounds) * 100 : 0

  return (
    <div className={`game-screen ${flashWrong ? 'flash-wrong' : ''}`}>

      {showResult && lastResult && (
        <div className={`result-overlay ${lastResult.correct || lastResult.noWinner ? 'show' : ''}`}>
          {lastResult.winnerId && (
            <div className="result-banner correct animate-scaleIn">
              <div className="result-icon">🎯</div>
              <div className="result-text">
                <span className="result-winner">{lastResult.winnerNickname}</span>
                <span>정답!</span>
              </div>
              <div className="result-answer">정답: {lastResult.answer}</div>
            </div>
          )}
          {lastResult.noWinner && (
            <div className="result-banner timeout animate-scaleIn">
              <div className="result-icon">⏰</div>
              <div className="result-text">
                {lastResult.message?.includes('스킵') ? '재생 오류 스킵!' : '시간 초과!'}
              </div>
              <div className="result-answer">정답: {lastResult.answer}</div>
              <div className="result-sub">{lastResult.message || '아무도 점수를 얻지 못했습니다 (0점)'}</div>
            </div>
          )}
        </div>
      )}

      <div className="game-layout">

        <div className="scoreboard-panel glass-panel">
          <div className="scoreboard-title">🏆 스코어보드</div>
          <div className="score-list">
            {sortedPlayers.map((p, i) => {
              const isMe = p.id === myId || p.nickname === nickname
              const isWinner = lastResult?.winnerId === p.id
              return (
                <div key={p.id} className={`score-row ${isMe ? 'me' : ''} ${isWinner ? 'just-won' : ''}`}>
                  <span className="rank-num">{i + 1}</span>
                  <span className="player-ava">{getAvatar(p.id)}</span>
                  <span className="score-name">
                    {p.nickname}
                    {isMe && <span className="me-badge">나</span>}
                  </span>
                  <div className="score-bar-wrap">
                    <div className="score-bar" style={{ width: `${Math.min((p.score / targetScore) * 100, 100)}%` }} />
                  </div>
                  <span className="score-num">{p.score}</span>
                  <span className="score-target">/{targetScore}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="game-center">

          <div className="round-progress">
            <div className="round-info">
              <span className="glow-cyan">라운드 {currentRound}</span>
              <span className="text-secondary"> / {totalRounds}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {category && (
            <div className="category-row animate-fadeIn">
              <div className="category-badge">🎵 {category}</div>
              {hint && <span className="hint-text">힌트: {hint}</span>}
            </div>
          )}

          <div className="audio-area glass-panel">
            <div className="audio-inner youtube-audio-inner">
              <div className="youtube-player-shell">
                <div id={playerHostIdRef.current} />
              </div>

              <div className="youtube-sound-panel">
                {mediaLoaded ? (
                  <WaveformVisualizer isPlaying={isPlaying} />
                ) : (
                  <div className="audio-loading">
                    <div className="loading-spinner" />
                    <span>사운드 로딩 중...</span>
                  </div>
                )}
                {playbackBlocked && (
                  <button className="btn btn-secondary audio-play-btn" onClick={playYouTube}>
                    ▶ 재생
                  </button>
                )}
                {playbackError && (
                  <div className="audio-error">YouTube 영상을 재생할 수 없습니다.</div>
                )}
                <div className="phase-label">{phaseLabel}</div>
              </div>
            </div>
          </div>

          <div className={`answer-area glass-panel ${roundActive ? 'active' : ''}`}>
            {roundActive ? (
              <>
                <div className="answer-row">
                  <input
                    ref={inputRef}
                    className={`input answer-input ${flashWrong ? 'wrong' : ''}`}
                    placeholder="정답을 입력하세요..."
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={handleKey}
                    disabled={submitted && !flashWrong}
                    maxLength={40}
                    autoComplete="off"
                    autoCapitalize="none"
                  />
                  <button
                    className="btn btn-primary submit-btn"
                    onClick={handleSubmit}
                    disabled={!answer.trim() || (submitted && !flashWrong)}
                  >
                    제출 ↵
                  </button>
                </div>
                {submitted && !flashWrong && (
                  <p className="submitted-hint">⏳ 판정 중... 다른 플레이어를 기다리세요</p>
                )}
                {flashWrong && (
                  <p className="wrong-hint">❌ 틀렸습니다! 다시 시도해보세요.</p>
                )}
              </>
            ) : (
              <p className="waiting-next">⏳ 다음 라운드 준비 중...</p>
            )}
          </div>
        </div>

        <div className="timer-panel glass-panel">
          <div className="timer-label">남은 시간</div>
          <TimerRing
            timeLimit={state.timeLimit || 15}
            active={isTimerRunning || timerActive} 
          />
          <div className="timer-hint">빠를수록 유리!</div>
        </div>

      </div>
    </div>
  )
}
