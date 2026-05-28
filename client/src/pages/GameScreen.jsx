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
    isTimerRunning // 💡 서버에서 보내주는 글로벌 타이머 작동 신호!
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

  const audioStopTimerRef = useRef(null)

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

    clearTimeout(audioStopTimerRef.current)

    if (!youtubeId) {
      setMediaLoaded(true)
      if (currentRound > 0) {
        setPlaybackError(true)
        setPhaseLabel('YouTube 영상이 설정되지 않았습니다')
      } else {
        setPhaseLabel('다음 라운드 준비 중...')
      }
      return undefined
    }

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
                setIsPlaying(true)
                setTimerActive(true)
                setPlaybackBlocked(false)
                setPlaybackError(false)
                setPhaseLabel('소리를 들어보세요!')
                emit('youtube_playing') // 첫 재생 성공 시 서버로 전송

                clearTimeout(audioStopTimerRef.current)
                audioStopTimerRef.current = setTimeout(() => {
                  try { playerRef.current?.pauseVideo?.() } catch (e) {}
                  setIsPlaying(false)
                }, 10000)
              }
              if (event.data === YOUTUBE_PLAYER_STATE.PAUSED || event.data === YOUTUBE_PLAYER_STATE.ENDED) {
                setIsPlaying(false)
              }
            },
            // 🚨 재생할 수 없는 유튜브 영상일 경우 지연 없이 즉시 스킵!
            onError: () => {
              setMediaLoaded(true)
              setIsPlaying(false)
              setPlaybackBlocked(false)
              setPlaybackError(true)
              setPhaseLabel('⚠️ 재생 불가 영상! 라운드를 즉시 스킵합니다.')
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
        setMediaLoaded(true)
        setPlaybackError(true)
        setPhaseLabel('YouTube 플레이어를 불러오지 못했습니다')
      })

    return () => {
      cancelled = true
      clearTimeout(audioStopTimerRef.current)
      try {
        playerRef.current?.stopVideo?.()
      } catch (error) {}
    }
  }, [youtubeId, youtubeStart, youtubeEnd, currentRound, playYouTube, emit])

  useEffect(() => {
    if (roundActive && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [roundActive])

  useEffect(() => {
    if (!roundActive) {
      setTimerActive(false)
      clearTimeout(audioStopTimerRef.current)
    }
  }, [roundActive])

  useEffect(() => {
    if (lastResult) {
      const isRoundResult = lastResult.correct || lastResult.noWinner || lastResult.winnerId
      if (!isRoundResult) return undefined

      try {
        playerRef.current?.pauseVideo?.()
      } catch (error) {}

      setShowResult(true)
      setPhaseLabel(lastResult.correct ? '🎉 정답!' : '⏰ 라운드 종료!')
      const t = setTimeout(() => setShowResult(false), 2500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [lastResult])

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
          {/* 💡 서버가 타이머를 시작했다면(isTimerRunning) 무조건 강제 출발! */}
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
