import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../utils/GameContext'
import { useSocket } from '../hooks/useSocket'
import WaveformVisualizer from '../components/WaveformVisualizer'
import TimerRing from '../components/TimerRing'
import './GameScreen.css'

// ─── 상수 ────────────────────────────────────────────────────
const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }
const AVATARS = ['🚀','⭐','🌙','💫','🪐','☄️','🌟','🎵','👾','🛸','🌌','🔭']

// ─── 유틸 ────────────────────────────────────────────────────
function getAvatar(id) {
  return AVATARS[(id?.charCodeAt(id.length - 1) || 0) % AVATARS.length]
}

// YouTube IFrame API 로드 (싱글톤)
let ytApiPromise = null
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.onerror = () => reject(new Error('YouTube API 로드 실패'))
    document.head.appendChild(s)
  })
  return ytApiPromise
}

// 팡파레 효과음 (Web Audio API)
function playFanfare(ctx) {
  // 빠라빠람 빠라바람 빰빰 — 도미솔도 미솔도미 솔솔
  const notes = [
    [523.25, 0.00, 0.18], // 도
    [659.25, 0.18, 0.18], // 미
    [783.99, 0.36, 0.18], // 솔
    [1046.50,0.54, 0.28], // 도(高)
    [659.25, 0.88, 0.18], // 미
    [783.99, 1.06, 0.18], // 솔
    [1046.50,1.24, 0.18], // 도(高)
    [659.25, 1.42, 0.18], // 미
    [783.99, 1.66, 0.28], // 솔 (강)
    [783.99, 2.00, 0.28], // 솔 (강)
  ]
  notes.forEach(([freq, offset, dur]) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const t = ctx.currentTime + offset
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  })
  // 팡파레 총 길이: ~2.3초
  return 2350
}

// 틱 소리 1회
function playTick(ctx) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 850
  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.06)
}

// 한국어 TTS — Promise 반환, onend 실제 완료 기준
function speak(text, voice, rate = 1.0) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'ko-KR'
    utt.voice = voice
    utt.rate = rate
    utt.onend = () => resolve()
    utt.onerror = () => resolve() // 에러도 그냥 진행
    window.speechSynthesis.speak(utt)

    // iOS Safari: onend가 발화 안 되는 경우 방어
    // 글자당 약 100ms + 여유 3초
    const maxMs = Math.max(text.length * 100 + 3000, 5000)
    setTimeout(resolve, maxMs)
  })
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms))
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function GameScreen() {
  const { state, submitAnswer } = useGame()
  const { emit } = useSocket()
  const {
    players, myId, nickname,
    currentRound, totalRounds, category, hint,
    youtubeId, youtubeStart, youtubeEnd,
    roundActive, lastResult, targetScore,
  } = state

  // ── UI 상태 ──────────────────────────────────────────────
  const [soundUnlocked, setSoundUnlocked] = useState(false)
  const [isPlaying, setIsPlaying]         = useState(false)
  const [timerActive, setTimerActive]     = useState(false)
  const [mediaReady, setMediaReady]       = useState(false)
  const [answer, setAnswer]               = useState('')
  const [submitted, setSubmitted]         = useState(false)
  const [flashWrong, setFlashWrong]       = useState(false)
  const [phaseLabel, setPhaseLabel]       = useState('접속 대기 중...')
  const [showResult, setShowResult]       = useState(false)
  const [playbackError, setPlaybackError] = useState(false)

  // ── Ref ──────────────────────────────────────────────────
  const inputRef        = useRef(null)
  const playerRef       = useRef(null)
  const audioCtxRef     = useRef(null)
  const korVoiceRef     = useRef(null)
  const hostElemId      = useRef(`yt-${Math.random().toString(36).slice(2)}`)

  // 현재 라운드 시퀀스를 취소하기 위한 AbortController
  const seqAbortRef     = useRef(null)
  // 오프닝 한 번만
  const openingDoneRef  = useRef(false)
  // 음악 재생 완료 resolve
  const musicEndResolveRef = useRef(null)
  // 틱 interval
  const tickRef         = useRef(null)

  // ── AudioContext 초기화 (unlock 시) ─────────────────────
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (Ctx) audioCtxRef.current = new Ctx()
    }
    return audioCtxRef.current
  }, [])

  // ── 한국어 음성 초기화 ───────────────────────────────────
  useEffect(() => {
    const init = () => {
      const voices = window.speechSynthesis.getVoices()
      const ko = voices.filter(v => v.lang.startsWith('ko'))
      korVoiceRef.current = (
        ko.find(v => /natural|premium|google|siri|yuna/i.test(v.name))
        || ko[0]
        || null
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
          onReady: () => setMediaReady(true),
          onStateChange: handleYTState,
          onError: () => {
            setIsPlaying(false)
            setPlaybackError(true)
            // 음악 재생 실패 → 시퀀스 계속 진행
            musicEndResolveRef.current?.()
            musicEndResolveRef.current = null
          }
        }
      })
    })
    return () => {
      destroyed = true
      playerRef.current?.destroy?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── YouTube 상태 변경 핸들러 ─────────────────────────────
  // useRef로 감싸 클로저 문제 방지
  const handleYTStateRef = useRef()
  handleYTStateRef.current = (event) => {
    if (event.data === YT_STATE.PLAYING) {
      setIsPlaying(true)
      setPlaybackError(false)
    }
    if (event.data === YT_STATE.PAUSED || event.data === YT_STATE.ENDED) {
      setIsPlaying(false)
    }
    if (event.data === YT_STATE.ENDED) {
      // 음악 종료 → 시퀀스 resolve
      musicEndResolveRef.current?.()
      musicEndResolveRef.current = null
    }
  }
  function handleYTState(event) {
    handleYTStateRef.current(event)
  }

  // ── 음악 재생 Promise ────────────────────────────────────
  // 실제 ENDED 이벤트 또는 최대 재생시간 초과 시 resolve
  function playMusic(videoId, startSec, endSec, signal) {
    return new Promise((resolve) => {
      if (signal?.aborted) { resolve(); return }

      const start = Number(startSec) || 0
      const end   = Number(endSec) || 0
      const clipSec = (end > start) ? (end - start) : 10 // 기본 10초

      musicEndResolveRef.current = resolve

      try {
        playerRef.current?.loadVideoById({
          videoId,
          startSeconds: start,
          endSeconds: end > start ? end : undefined
        })
        // 살짝 딜레이 후 play (버퍼링 대기)
        setTimeout(() => {
          if (signal?.aborted) { resolve(); return }
          playerRef.current?.playVideo?.()
        }, 300)
      } catch(e) {
        resolve()
        return
      }

      // 안전망: 클립 길이 + 5초 초과 시 강제 종료
      const safetyMs = (clipSec + 5) * 1000
      const safetyTimer = setTimeout(() => {
        try { playerRef.current?.stopVideo?.() } catch(e) {}
        resolve()
        musicEndResolveRef.current = null
      }, safetyMs)

      // abort 시 즉시 정리
      signal?.addEventListener('abort', () => {
        clearTimeout(safetyTimer)
        try { playerRef.current?.stopVideo?.() } catch(e) {}
        resolve()
        musicEndResolveRef.current = null
      })

      // resolve 후 safety timer 정리
      const origResolve = musicEndResolveRef.current
      musicEndResolveRef.current = () => {
        clearTimeout(safetyTimer)
        origResolve()
        musicEndResolveRef.current = null
      }
    })
  }

  // ── 틱 소리 N번 ─────────────────────────────────────────
  function playTicks(count, intervalMs) {
    return new Promise(resolve => {
      let i = 0
      clearInterval(tickRef.current)
      tickRef.current = setInterval(() => {
        const ctx = getAudioCtx()
        if (ctx) playTick(ctx)
        i++
        if (i >= count) {
          clearInterval(tickRef.current)
          resolve()
        }
      }, intervalMs)
    })
  }

  // ── 언락 버튼 ────────────────────────────────────────────
  const handleUnlock = useCallback(() => {
    const ctx = getAudioCtx()
    if (ctx?.state === 'suspended') ctx.resume()
    setSoundUnlocked(true)
    setPhaseLabel('🎙️ 오프닝 안내 중...')
    // YouTube unlock
    if (playerRef.current?.playVideo) {
      playerRef.current.playVideo()
      setTimeout(() => playerRef.current?.pauseVideo?.(), 200)
    }
  }, [getAudioCtx])

  // ── 라운드 시퀀스 ────────────────────────────────────────
  // soundUnlocked && roundActive && youtubeId 변경 시 실행
  useEffect(() => {
    if (!soundUnlocked) return
    if (!roundActive) return

    // 이전 시퀀스 취소
    seqAbortRef.current?.abort()
    const ac = new AbortController()
    seqAbortRef.current = ac
    const sig = ac.signal

    // 입력 초기화
    setAnswer('')
    setSubmitted(false)
    setFlashWrong(false)
    setIsPlaying(false)
    setTimerActive(false)
    setShowResult(false)
    setPlaybackError(false)

    async function runSequence() {
      // ── 오프닝 (첫 라운드 1회만) ──────────────────────
      if (!openingDoneRef.current) {
        openingDoneRef.current = true
        setPhaseLabel('🎙️ 오프닝 안내 방송 중...')

        // 팡파레
        const ctx = getAudioCtx()
        if (ctx) {
          if (ctx.state === 'suspended') await ctx.resume()
          playFanfare(ctx)
          await delay(2400) // 팡파레 길이
        }

        if (sig.aborted) return

        // 오프닝 멘트
        await speak(
          `여러분 안녕하세요. 소리를 듣고 정답을 최대한 빨리 맞춰주세요. ` +
          `답이 무엇인지 알 것 같다면 정답을 입력해주세요. ` +
          `입력한 답이 맞다면 1점을 얻습니다. ` +
          `10라운드 내에 가장 먼저 ${targetScore}점을 달성한 사람이 승리합니다. ` +
          `자, 이제 시작해볼까요?`,
          korVoiceRef.current
        )
        if (sig.aborted) return

        await delay(2000)
        if (sig.aborted) return
      }

      // ── 주제 안내 ─────────────────────────────────────
      if (category) {
        setPhaseLabel(`🎵 주제: ${category}`)
        await speak(category, korVoiceRef.current)
        if (sig.aborted) return
        await delay(1000)
        if (sig.aborted) return
      }

      // ── 음악 재생 ─────────────────────────────────────
      if (!youtubeId) {
        // 음원 없으면 서버에 알림
        emit('skip_round')
        return
      }

      setPhaseLabel('🎧 소리를 들어보세요!')
      setTimerActive(true)

      await playMusic(youtubeId, youtubeStart, youtubeEnd, sig)
      if (sig.aborted) return

      setIsPlaying(false)
      setPhaseLabel('⌨️ 정답을 입력하세요!')

      // 음악 끝난 후 틱 5번 (1초 간격)
      await playTicks(5, 1000)
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

  // ── 라운드 비활성화 시 정리 ──────────────────────────────
  useEffect(() => {
    if (!roundActive) {
      seqAbortRef.current?.abort()
      clearInterval(tickRef.current)
      setTimerActive(false)
      setIsPlaying(false)
      try { playerRef.current?.stopVideo?.() } catch(e) {}
    }
  }, [roundActive])

  // ── 결과 표시 ────────────────────────────────────────────
  useEffect(() => {
    if (!lastResult) return
    const isRound = lastResult.correct || lastResult.noWinner || lastResult.winnerId
    if (!isRound) return

    // 음악 즉시 정지
    seqAbortRef.current?.abort()
    clearInterval(tickRef.current)
    try { playerRef.current?.stopVideo?.() } catch(e) {}
    setIsPlaying(false)
    setTimerActive(false)

    setShowResult(true)
    const t = setTimeout(() => setShowResult(false), 2500)
    return () => clearTimeout(t)
  }, [lastResult])

  // ── 오답 처리 ────────────────────────────────────────────
  useEffect(() => {
    if (!lastResult) return
    if (lastResult.correct || lastResult.noWinner || lastResult.winnerId) return
    // 개인 오답
    setSubmitted(false)
    setAnswer('')
    setFlashWrong(true)
    const t = setTimeout(() => setFlashWrong(false), 600)
    inputRef.current?.focus()
    return () => clearTimeout(t)
  }, [lastResult])

  // ── 입력 포커스 ──────────────────────────────────────────
  useEffect(() => {
    if (roundActive && soundUnlocked) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [roundActive, soundUnlocked])

  // ── 정답 제출 ────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!answer.trim() || submitted || !roundActive) return
    setSubmitted(true)
    submitAnswer(answer.trim())
  }, [answer, submitted, roundActive, submitAnswer])

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  // ── 렌더 ─────────────────────────────────────────────────
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const progressPct = totalRounds > 0 ? ((currentRound - 1) / totalRounds) * 100 : 0

  return (
    <div className={`game-screen ${flashWrong ? 'flash-wrong' : ''}`}>

      {/* YouTube 플레이어 (숨김) */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        <div id={hostElemId.current} />
      </div>

      {/* 언락 오버레이 */}
      {!soundUnlocked && (
        <div
          onClick={handleUnlock}
          style={{
            position:'fixed', inset:0, zIndex:99999,
            background:'rgba(4,5,15,0.96)', backdropFilter:'blur(16px)',
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            cursor:'pointer', gap:'20px'
          }}
        >
          <div style={{ fontSize:'5rem', animation:'float 1.5s ease-in-out infinite' }}>🎵</div>
          <h2 style={{ fontSize:'1.8rem', color:'#06b6d4', textShadow:'0 0 15px rgba(6,182,212,0.6)', textAlign:'center', padding:'0 24px', wordBreak:'keep-all' }}>
            화면을 터치해서 게임을 시작하세요
          </h2>
          <p style={{ color:'#94a3b8', fontSize:'1rem', textAlign:'center', padding:'0 24px' }}>
            오디오 시스템 활성화를 위해 터치가 필요합니다
          </p>
        </div>
      )}

      {/* 라운드 결과 오버레이 */}
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
              <div className="result-sub">{lastResult.message || '아무도 맞추지 못했습니다'}</div>
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

        {/* 메인 게임 영역 */}
        <div className="game-center">
          {/* 진행 바 */}
          <div className="round-progress">
            <div className="round-info">
              <span className="glow-cyan">라운드 {currentRound || 1}</span>
              <span style={{color:'var(--text-secondary)'}}> / {totalRounds}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* 카테고리 */}
          {category && (
            <div className="category-row animate-fadeIn">
              <div className="category-badge">🎵 {category}</div>
              {hint && <span className="hint-text">힌트: {hint}</span>}
            </div>
          )}

          {/* 오디오 비주얼라이저 */}
          <div className="audio-area glass-panel">
            <div className="audio-inner">
              {mediaReady ? (
                <WaveformVisualizer isPlaying={isPlaying} />
              ) : (
                <div className="audio-loading">
                  <div className="loading-spinner" />
                  <span>오디오 시스템 초기화 중...</span>
                </div>
              )}
              {playbackError && (
                <div style={{ color:'#f87171', fontSize:'0.8rem', marginTop:'8px' }}>
                  ⚠️ 영상을 불러올 수 없습니다. 다음 라운드를 기다려주세요.
                </div>
              )}
              <div className="phase-label">{phaseLabel}</div>
            </div>
          </div>

          {/* 정답 입력 */}
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

        {/* 타이머 */}
        <div className="timer-panel glass-panel">
          <div className="timer-label">남은 시간</div>
          <TimerRing
            timeLimit={state.timeLimit || 25}
            active={timerActive}
          />
          <div className="timer-hint">빠를수록 유리!</div>
        </div>

      </div>
    </div>
  )
}
