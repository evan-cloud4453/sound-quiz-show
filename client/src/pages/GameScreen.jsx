// client/src/pages/GameScreen.jsx — v3
// 수정사항:
//   1. TTS가 안 들리는 문제 → speak() 호출 전 AudioContext resume + iOS 워밍업
//   2. 타이머 후 15초 멈춤 → clearRoomTimers가 startRound에서 항상 실행되므로 서버 측 해결
//   3. 클라이언트는 서버 timer_start 수신 시에만 타이머 UI 시작

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../utils/GameContext'
import { useSocket } from '../hooks/useSocket'
import WaveformVisualizer from '../components/WaveformVisualizer'
import TimerRing from '../components/TimerRing'
import './GameScreen.css'

// ─── 상수 ────────────────────────────────────────────────────
const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 }
const AVATARS  = ['🚀','⭐','🌙','💫','🪐','☄️','🌟','🎵','👾','🛸','🌌','🔭']
function getAvatar(id) {
  return AVATARS[(id?.charCodeAt(id.length - 1) || 0) % AVATARS.length]
}

// ─── YouTube API 싱글톤 ───────────────────────────────────────
let ytApiPromise = null
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytApiPromise)       return ytApiPromise
  ytApiPromise = new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
    const s = document.createElement('script')
    s.src     = 'https://www.youtube.com/iframe_api'
    s.onerror = () => reject(new Error('YouTube API 로드 실패'))
    document.head.appendChild(s)
  })
  return ytApiPromise
}

// ─── 팡파레 ──────────────────────────────────────────────────
function playFanfare(ctx) {
  const notes = [
    [523.25, 0.00, 0.18], [659.25, 0.18, 0.18],
    [783.99, 0.36, 0.18], [1046.50,0.54, 0.28],
    [659.25, 0.88, 0.18], [783.99, 1.06, 0.18],
    [1046.50,1.24, 0.18], [659.25, 1.42, 0.18],
    [783.99, 1.66, 0.28], [783.99, 2.00, 0.28],
  ]
  notes.forEach(([freq, offset, dur]) => {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type            = 'triangle'
    osc.frequency.value = freq
    const t = ctx.currentTime + offset
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(t); osc.stop(t + dur + 0.05)
  })
  return 2400 // ms
}

// ─── 틱 소리 ─────────────────────────────────────────────────
function playTick(ctx) {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type            = 'sine'
  osc.frequency.value = 850
  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(); osc.stop(ctx.currentTime + 0.06)
}

// ─── TTS — onend 실제 완료 대기 ──────────────────────────────
// ★ audioCtx를 받아서 resume 보장 후 speak
function speak(text, voice, audioCtx) {
  return new Promise((resolve) => {
    // iOS: AudioContext가 suspended면 TTS도 묵음 처리되는 경우 있음
    const doSpeak = () => {
      window.speechSynthesis.cancel()
      const utt   = new SpeechSynthesisUtterance(text)
      utt.lang    = 'ko-KR'
      utt.voice   = voice || null
      utt.rate    = 1.0
      utt.volume  = 1.0
      utt.onend   = () => resolve()
      utt.onerror = () => resolve()
      window.speechSynthesis.speak(utt)

      // iOS onend 묵음 방어: 글자당 120ms + 4초 여유
      const maxMs = Math.max(text.length * 120 + 4000, 6000)
      setTimeout(resolve, maxMs)
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().then(doSpeak).catch(doSpeak)
    } else {
      doSpeak()
    }
  })
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms))
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function GameScreen() {
  const { state, submitAnswer } = useGame()
  const { emit, on }            = useSocket()

  const {
    players, myId, nickname,
    currentRound, totalRounds,
    category, hint,
    youtubeId, youtubeStart, youtubeEnd,
    roundActive, lastResult, targetScore,
    timeLimit: serverTimeLimit
  } = state

  // ── UI 상태 ──────────────────────────────────────────────
  const [soundUnlocked, setSoundUnlocked] = useState(false)
  const [isPlaying,     setIsPlaying]     = useState(false)
  const [timerActive,   setTimerActive]   = useState(false)
  const [timerLimit,    setTimerLimit]    = useState(serverTimeLimit || 25)
  const [mediaReady,    setMediaReady]    = useState(false)
  const [answer,        setAnswer]        = useState('')
  const [submitted,     setSubmitted]     = useState(false)
  const [flashWrong,    setFlashWrong]    = useState(false)
  const [phaseLabel,    setPhaseLabel]    = useState('접속 대기 중...')
  const [showResult,    setShowResult]    = useState(false)
  const [playbackError, setPlaybackError] = useState(false)

  // ── Ref ──────────────────────────────────────────────────
  const inputRef           = useRef(null)
  const playerRef          = useRef(null)
  const audioCtxRef        = useRef(null)
  const korVoiceRef        = useRef(null)
  const hostElemId         = useRef(`yt-${Math.random().toString(36).slice(2)}`)
  const seqAbortRef        = useRef(null)
  const openingDoneRef     = useRef(false)
  const musicEndResolveRef = useRef(null)
  const tickRef            = useRef(null)
  const musicStartedRef    = useRef(false)

  // ── AudioContext 초기화 ───────────────────────────────────
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || window.webkitAudioContext
      if (Ctor) audioCtxRef.current = new Ctor()
    }
    return audioCtxRef.current
  }, [])

  // ── 한국어 음성 초기화 ───────────────────────────────────
  useEffect(() => {
    const init = () => {
      const voices = window.speechSynthesis.getVoices()
      const ko     = voices.filter(v => v.lang.startsWith('ko'))
      korVoiceRef.current = (
        ko.find(v => /natural|premium|google|siri|yuna/i.test(v.name))
        || ko[0] || null
      )
    }
    init()
    window.speechSynthesis.onvoiceschanged = init
  }, [])

  // ── YouTube Player 초기화 ────────────────────────────────
  useEffect(() => {
    let destroyed = false
    loadYouTubeApi().then(YT => {
      if (destroyed) return
      playerRef.current = new YT.Player(hostElemId.current, {
        width: 1, height: 1,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0 },
        events: {
          onReady:       () => setMediaReady(true),
          onStateChange: (e) => ytStateHandlerRef.current(e),
          onError:       () => {
            setIsPlaying(false)
            setPlaybackError(true)
            musicEndResolveRef.current?.()
            musicEndResolveRef.current = null
          }
        }
      })
    })
    return () => { destroyed = true; playerRef.current?.destroy?.() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── YouTube 상태 핸들러 ───────────────────────────────────
  const ytStateHandlerRef = useRef()
  ytStateHandlerRef.current = (event) => {
    if (event.data === YT_STATE.PLAYING) {
      setIsPlaying(true)
      setPlaybackError(false)

      // ★ 음악 실제 재생 시작 → 서버에 알림 (1회만)
      if (!musicStartedRef.current) {
        musicStartedRef.current = true
        emit('music_started')
      }
    }
    if (event.data === YT_STATE.PAUSED || event.data === YT_STATE.ENDED) {
      setIsPlaying(false)
    }
    if (event.data === YT_STATE.ENDED) {
      musicEndResolveRef.current?.()
      musicEndResolveRef.current = null
    }
  }

  // ── 서버 timer_start 수신 → UI 타이머 동기화 ────────────
  useEffect(() => {
    const unsub = on('timer_start', ({ timeLimit }) => {
      setTimerLimit(timeLimit)
      setTimerActive(true)
      setPhaseLabel('⌨️ 정답을 입력하세요!')
    })
    return unsub
  }, [on])

  // ── 음악 재생 Promise (ENDED 이벤트 기준) ────────────────
  function playMusic(videoId, startSec, endSec, signal) {
    return new Promise((resolve) => {
      if (signal?.aborted) { resolve(); return }

      const start   = Number(startSec) || 0
      const end     = Number(endSec)   || 0
      const clipSec = (end > start) ? (end - start) : 15

      // resolve wrapper: 중복 호출 방지
      let resolved = false
      const safeResolve = () => {
        if (resolved) return
        resolved = true
        musicEndResolveRef.current = null
        resolve()
      }

      musicEndResolveRef.current = safeResolve

      try {
        playerRef.current?.loadVideoById({
          videoId,
          startSeconds: start,
          endSeconds:   end > start ? end : undefined
        })
        setTimeout(() => {
          if (signal?.aborted) { safeResolve(); return }
          playerRef.current?.playVideo?.()
        }, 300)
      } catch(e) {
        safeResolve(); return
      }

      // 안전망: 클립 + 8초
      const safetyTimer = setTimeout(() => {
        try { playerRef.current?.stopVideo?.() } catch(e) {}
        safeResolve()
      }, (clipSec + 8) * 1000)

      signal?.addEventListener('abort', () => {
        clearTimeout(safetyTimer)
        try { playerRef.current?.stopVideo?.() } catch(e) {}
        safeResolve()
      })

      // safetyTimer 정리를 위해 safeResolve 래핑
      const origSafe = safeResolve
      musicEndResolveRef.current = () => {
        clearTimeout(safetyTimer)
        origSafe()
      }
    })
  }

  // ── 틱 소리 N회 ─────────────────────────────────────────
  function playTicks(count, intervalMs, signal) {
    return new Promise(resolve => {
      let i = 0
      clearInterval(tickRef.current)
      tickRef.current = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(tickRef.current)
          resolve(); return
        }
        const ctx = getAudioCtx()
        if (ctx) playTick(ctx)
        if (++i >= count) {
          clearInterval(tickRef.current)
          resolve()
        }
      }, intervalMs)
    })
  }

  // ── 언락 버튼 ────────────────────────────────────────────
  const handleUnlock = useCallback(async () => {
    const ctx = getAudioCtx()

    // ★ AudioContext를 반드시 resume (iOS 정책)
    if (ctx?.state === 'suspended') {
      await ctx.resume()
    }

    // ★ speechSynthesis 워밍업 (빈 발화로 iOS 음성 엔진 깨우기)
    const warmup = new SpeechSynthesisUtterance(' ')
    warmup.volume = 0
    warmup.lang   = 'ko-KR'
    window.speechSynthesis.speak(warmup)

    setSoundUnlocked(true)

    // YouTube unlock
    if (playerRef.current?.playVideo) {
      playerRef.current.playVideo()
      setTimeout(() => playerRef.current?.pauseVideo?.(), 200)
    }
  }, [getAudioCtx])

  // ── 라운드 시퀀스 ────────────────────────────────────────
  useEffect(() => {
    if (!soundUnlocked || !roundActive) return

    seqAbortRef.current?.abort()
    const ac  = new AbortController()
    seqAbortRef.current = ac
    const sig = ac.signal

    setAnswer(''); setSubmitted(false); setFlashWrong(false)
    setIsPlaying(false); setTimerActive(false)
    setShowResult(false); setPlaybackError(false)
    musicStartedRef.current = false // ★ 라운드마다 초기화

    async function runSequence() {
      const ctx = getAudioCtx()

      // ── 1라운드 오프닝 (1회만) ──────────────────────
      if (!openingDoneRef.current) {
        openingDoneRef.current = true
        setPhaseLabel('🎙️ 오프닝 안내 방송 중...')

        if (ctx) {
          if (ctx.state === 'suspended') await ctx.resume()
          playFanfare(ctx)
          await delay(2400)
        }
        if (sig.aborted) return

        await speak(
          `여러분 안녕하세요. ` +
          `소리를 듣고 정답을 최대한 빨리 맞춰주세요. ` +
          `답이 무엇인지 알 것 같다면 정답을 입력해주세요. ` +
          `입력한 답이 맞다면 1점을 얻습니다. ` +
          `${targetScore}점을 먼저 달성한 사람이 승리합니다. ` +
          `자, 이제 시작해볼까요?`,
          korVoiceRef.current,
          ctx
        )
        if (sig.aborted) return

        await delay(2000)
        if (sig.aborted) return
      }

      // ── 주제 안내 ───────────────────────────────────
      if (category) {
        setPhaseLabel(`🎵 주제: ${category}`)
        await speak(category, korVoiceRef.current, ctx)
        if (sig.aborted) return
        await delay(1000)
        if (sig.aborted) return
      }

      // ── 음악 재생 ───────────────────────────────────
      if (!youtubeId) {
        emit('skip_round')
        return
      }

      setPhaseLabel('🎧 소리를 들어보세요!')
      await playMusic(youtubeId, youtubeStart, youtubeEnd, sig)
      if (sig.aborted) return

      setIsPlaying(false)
      setPhaseLabel('⌨️ 정답을 입력하세요!')

      // 음악 끝 후 틱 5회
      await playTicks(5, 1000, sig)
    }

    runSequence()

    return () => {
      ac.abort()
      clearInterval(tickRef.current)
      window.speechSynthesis.cancel()
      try { playerRef.current?.stopVideo?.() } catch(e) {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundUnlocked, roundActive, youtubeId, currentRound])

  // ── 라운드 비활성화 정리 ─────────────────────────────────
  useEffect(() => {
    if (!roundActive) {
      seqAbortRef.current?.abort()
      clearInterval(tickRef.current)
      setTimerActive(false)
      setIsPlaying(false)
      try { playerRef.current?.stopVideo?.() } catch(e) {}
    }
  }, [roundActive])

  // ── 결과 수신 ────────────────────────────────────────────
  useEffect(() => {
    if (!lastResult) return
    const isRound = lastResult.correct || lastResult.noWinner || lastResult.winnerId
    if (!isRound) return

    seqAbortRef.current?.abort()
    clearInterval(tickRef.current)
    try { playerRef.current?.stopVideo?.() } catch(e) {}
    setIsPlaying(false)
    setTimerActive(false)

    setShowResult(true)
    const t = setTimeout(() => setShowResult(false), 2500)
    return () => clearTimeout(t)
  }, [lastResult])

  // ── 개인 오답 ────────────────────────────────────────────
  useEffect(() => {
    if (!lastResult) return
    if (lastResult.correct || lastResult.noWinner || lastResult.winnerId) return
    setSubmitted(false); setAnswer('')
    setFlashWrong(true)
    const t = setTimeout(() => setFlashWrong(false), 600)
    inputRef.current?.focus()
    return () => clearTimeout(t)
  }, [lastResult])

  // ── 포커스 ───────────────────────────────────────────────
  useEffect(() => {
    if (roundActive && soundUnlocked)
      setTimeout(() => inputRef.current?.focus(), 300)
  }, [roundActive, soundUnlocked])

  // ── 제출 ─────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!answer.trim() || submitted || !roundActive) return
    setSubmitted(true)
    submitAnswer(answer.trim())
  }, [answer, submitted, roundActive, submitAnswer])

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  // ── 렌더 ─────────────────────────────────────────────────
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const progressPct   = totalRounds > 0 ? ((currentRound - 1) / totalRounds) * 100 : 0

  return (
    <div className={`game-screen ${flashWrong ? 'flash-wrong' : ''}`}>

      {/* YouTube 숨김 플레이어 */}
      <div style={{ position:'absolute', width:1, height:1, overflow:'hidden', opacity:0, pointerEvents:'none' }}>
        <div id={hostElemId.current} />
      </div>

      {/* 언락 오버레이 */}
      {!soundUnlocked && (
        <div onClick={handleUnlock} style={{
          position:'fixed', inset:0, zIndex:99999,
          background:'rgba(4,5,15,0.96)', backdropFilter:'blur(16px)',
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          cursor:'pointer', gap:'20px'
        }}>
          <div style={{ fontSize:'5rem', animation:'float 1.5s ease-in-out infinite' }}>🎵</div>
          <h2 style={{
            fontSize:'1.8rem', color:'#06b6d4',
            textShadow:'0 0 15px rgba(6,182,212,0.6)',
            textAlign:'center', padding:'0 24px', wordBreak:'keep-all'
          }}>
            화면을 터치해서 게임을 시작하세요
          </h2>
          <p style={{ color:'#94a3b8', fontSize:'1rem', textAlign:'center', padding:'0 24px' }}>
            오디오 시스템 활성화를 위해 터치가 필요합니다
          </p>
        </div>
      )}

      {/* 결과 오버레이 */}
      {showResult && lastResult && (
        <div className="result-overlay show">
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
              <div className="result-text">시간 초과!</div>
              <div className="result-answer">정답: {lastResult.answer}</div>
              <div className="result-sub">{lastResult.message}</div>
            </div>
          )}
        </div>
      )}

      {/* 게임 레이아웃 */}
      <div className="game-layout">

        {/* 스코어보드 */}
        <div className="scoreboard-panel glass-panel">
          <div className="scoreboard-title">🏆 스코어보드</div>
          <div className="score-list">
            {sortedPlayers.map((p, i) => {
              const isMe     = p.id === myId || p.nickname === nickname
              const isWinner = lastResult?.winnerId === p.id
              return (
                <div key={p.id} className={`score-row ${isMe?'me':''} ${isWinner?'just-won':''}`}>
                  <span className="rank-num">{i + 1}</span>
                  <span className="player-ava">{getAvatar(p.id)}</span>
                  <span className="score-name">
                    {p.nickname}
                    {isMe && <span className="me-badge">나</span>}
                  </span>
                  <div className="score-bar-wrap">
                    <div className="score-bar" style={{ width:`${Math.min((p.score/targetScore)*100,100)}%` }} />
                  </div>
                  <span className="score-num">{p.score}</span>
                  <span className="score-target">/{targetScore}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 메인 */}
        <div className="game-center">
          <div className="round-progress">
            <div className="round-info">
              <span className="glow-cyan">라운드 {currentRound || 1}</span>
              <span style={{ color:'var(--text-secondary)' }}> / {totalRounds}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width:`${progressPct}%` }} />
            </div>
          </div>

          {category && (
            <div className="category-row animate-fadeIn">
              <div className="category-badge">🎵 {category}</div>
              {hint && <span className="hint-text">힌트: {hint}</span>}
            </div>
          )}

          <div className="audio-area glass-panel">
            <div className="audio-inner">
              {mediaReady
                ? <WaveformVisualizer isPlaying={isPlaying} />
                : <div className="audio-loading"><div className="loading-spinner" /><span>오디오 초기화 중...</span></div>
              }
              {playbackError && (
                <div style={{ color:'#f87171', fontSize:'0.8rem', marginTop:'8px' }}>
                  ⚠️ 영상을 불러올 수 없습니다. 다음 라운드를 기다려주세요.
                </div>
              )}
              <div className="phase-label">{phaseLabel}</div>
            </div>
          </div>

          <div className={`answer-area glass-panel ${roundActive?'active':''}`}>
            {roundActive ? (
              <>
                <div className="answer-row">
                  <input
                    ref={inputRef}
                    className={`input answer-input ${flashWrong?'wrong':''}`}
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
                {submitted && !flashWrong && <p className="submitted-hint">⏳ 판정 중...</p>}
                {flashWrong && <p className="wrong-hint">❌ 틀렸습니다! 다시 시도하세요.</p>}
              </>
            ) : (
              <p className="waiting-next">⏳ 다음 라운드 준비 중...</p>
            )}
          </div>
        </div>

        {/* 타이머 */}
        <div className="timer-panel glass-panel">
          <div className="timer-label">남은 시간</div>
          <TimerRing
            key={`${currentRound}-${timerActive}`}
            timeLimit={timerLimit}
            active={timerActive}
          />
          <div className="timer-hint">빠를수록 유리!</div>
        </div>

      </div>
    </div>
  )
}
