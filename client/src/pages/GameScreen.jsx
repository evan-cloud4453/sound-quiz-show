// client/src/pages/GameScreen.jsx — v4
// 수정:
//   1. speakSafe: cancel() 후 150ms 대기 → TTS 묵음 버그 수정
//   2. timer_start 리스너를 GameContext 없이 직접 소켓에서 수신
//   3. isTimerRunning 의존 제거, timerActive만 사용
//   4. window.utterances 누수 방지 (최대 5개 유지)

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../utils/GameContext'
import { useSocket } from '../hooks/useSocket'
import WaveformVisualizer from '../components/WaveformVisualizer'
import TimerRing from '../components/TimerRing'
import './GameScreen.css'

const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 }
const AVATARS  = ['🚀','⭐','🌙','💫','🪐','☄️','🌟','🎵','👾','🛸','🌌','🔭']
function getAvatar(id) {
  return AVATARS[(id?.charCodeAt(id.length - 1) || 0) % AVATARS.length]
}
const [allReady, setAllReady] = useState(false) // 추가: 모두 준비되었는지 확인

// ─── YouTube API 싱글톤 ───────────────────────────────────────
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

// ─── 팡파레 ──────────────────────────────────────────────────
function playFanfare(ctx) {
  const t = ctx.currentTime
  const note = (freq, offset) => {
    const osc = ctx.createOscillator()
    const g   = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.2, t + offset)
    g.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.15)
    osc.connect(g); g.connect(ctx.destination)
    osc.start(t + offset); osc.stop(t + offset + 0.2)
  }
  note(523.25, 0); note(659.25, 0.1); note(783.99, 0.2); note(1046.50, 0.3)
  return 700
}

// ─── 틱 소리 ─────────────────────────────────────────────────
function playTick(ctx) {
  const osc = ctx.createOscillator()
  const g   = ctx.createGain()
  osc.type = 'sine'; osc.frequency.value = 850
  g.gain.setValueAtTime(0.15, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
  osc.connect(g); g.connect(ctx.destination)
  osc.start(); osc.stop(ctx.currentTime + 0.06)
}

// ─── ★ 수정된 TTS 함수 ────────────────────────────────────────
// 핵심: cancel() 후 반드시 150ms 대기 후 speak()
// 이전 utterance 참조 유지 (GC 방지), 최대 5개로 제한
const CATEGORY_AUDIO = {
  '드라마': '/sounds/categories/드라마.mp3',
  '가요': '/sounds/categories/가요.mp3',
  '팝송': '/sounds/categories/팝송.mp3',
  '영화': '/sounds/categories/영화.mp3',
  '애니메이션': '/sounds/categories/애니메이션.mp3',
  '동요': '/sounds/categories/동요.mp3',
  '클래식음악': '/sounds/categories/클래식음악.mp3',
  '작곡가': '/sounds/categories/작곡가.mp3',
  '공연예술': '/sounds/categories/공연예술.mp3',
  '스포츠': '/sounds/categories/스포츠.mp3',
  '운송수단': '/sounds/categories/운송수단.mp3',
  '악기': '/sounds/categories/악기.mp3',
  '동물': '/sounds/categories/동물.mp3',
  '계절': '/sounds/categories/계절.mp3',
  '자연현상': '/sounds/categories/자연현상.mp3',
  '불쾌한소리': '/sounds/categories/불쾌한소리.mp3',
  '직업': '/sounds/categories/직업.mp3',
  '물건장소': '/sounds/categories/물건장소.mp3',
  '나라': '/sounds/categories/나라.mp3',
  '언어': '/sounds/categories/언어.mp3',
  '춤의종류': '/sounds/categories/춤의종류.mp3'
};
const OPENING_AUDIO = '/sounds/opening.mp3'

function playAudioFile(src, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(); return }
    const audio = new Audio(src)
    audio.volume = 1.0
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    audio.onended = finish
    audio.onerror = finish  // 파일 없으면 그냥 넘어감
    signal?.addEventListener('abort', () => { audio.pause(); finish() })
    audio.play().catch(finish)
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

  const categoryRef = useRef(category)
  useEffect(() => { categoryRef.current = category }, [category])
  
  const targetScoreRef = useRef(targetScore)
  useEffect(() => { targetScoreRef.current = targetScore }, [targetScore])

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || window.webkitAudioContext
      if (Ctor) audioCtxRef.current = new Ctor()
    }
    return audioCtxRef.current
  }, [])

  // 모두가 터치(준비)를 완료했다는 서버 신호 수신
  useEffect(() => {
    const unsub = on('all_players_ready', () => {
      setAllReady(true)
    })
    return unsub
  }, [on])

  // 한국어 음성 초기화
  useEffect(() => {
    const init = () => {
      const voices = window.speechSynthesis.getVoices()
      const ko = voices.filter(v => v.lang.startsWith('ko'))
      korVoiceRef.current = (
        ko.find(v => /natural|premium|google|siri|yuna/i.test(v.name)) || ko[0] || null
      )
    }
    init()
    window.speechSynthesis.onvoiceschanged = init
  }, [])

  // YouTube Player 초기화
  useEffect(() => {
    let destroyed = false
    loadYouTubeApi().then(YT => {
      if (destroyed) return
      playerRef.current = new YT.Player(hostElemId.current, {
        width: 1, height: 1,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0 },
        events: {
          onReady: () => setMediaReady(true),
          onStateChange: (e) => ytStateHandlerRef.current(e),
          onError: () => {
            setIsPlaying(false)
            setPlaybackError(true)
            musicEndResolveRef.current?.()
            musicEndResolveRef.current = null
          }
        }
      })
    })
    return () => { destroyed = true; playerRef.current?.destroy?.() }
  }, [])

  // YouTube 상태 핸들러
  const ytStateHandlerRef = useRef()
  ytStateHandlerRef.current = (event) => {
    if (event.data === YT_STATE.PLAYING) {
      setIsPlaying(true)
      setPlaybackError(false)
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

  // ★ timer_start 수신 — useSocket의 on() 직접 사용
  useEffect(() => {
    const unsub = on('timer_start', ({ timeLimit }) => {
      console.log('[timer_start] 수신:', timeLimit)
      setTimerLimit(timeLimit)
      setTimerActive(true)
    })
    return unsub
  }, [on])

  // 음악 재생 Promise
  function playMusic(videoId, startSec, endSec, signal) {
    return new Promise((resolve) => {
      if (signal?.aborted) { resolve(); return }

      const start   = Number(startSec) || 0
      const end     = Number(endSec)   || 0
      const clipSec = (end > start) ? (end - start) : 10

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
          endSeconds: end > start ? end : undefined
        })
        setTimeout(() => {
          if (signal?.aborted) { safeResolve(); return }
          playerRef.current?.playVideo?.()
        }, 300)
      } catch(e) { safeResolve(); return }

      const safetyTimer = setTimeout(() => {
        try { playerRef.current?.stopVideo?.() } catch(e) {}
        safeResolve()
      }, clipSec * 1000)

      signal?.addEventListener('abort', () => {
        clearTimeout(safetyTimer)
        try { playerRef.current?.stopVideo?.() } catch(e) {}
        safeResolve()
      })

      const orig = safeResolve
      musicEndResolveRef.current = () => { clearTimeout(safetyTimer); orig() }
    })
  }

  // 틱 소리 — 서버가 끊을 때까지 반복
  function playTicksTillEnd(signal) {
    return new Promise(resolve => {
      clearInterval(tickRef.current)
      tickRef.current = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(tickRef.current); resolve(); return
        }
        const ctx = getAudioCtx()
        if (ctx) playTick(ctx)
      }, 1000)
    })
  }

  // 언락 버튼
  const handleUnlock = useCallback(async () => {
  const ctx = getAudioCtx()
  if (ctx?.state === 'suspended') await ctx.resume()

  // ★ 추가: HTML5 Audio 객체 정책 우회를 위한 빈 소리 1회 재생
  const dummyAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
  dummyAudio.play().catch(() => {}) // 에러가 나도 무시 (언락이 목적)

  // ★ AudioContext 완전히 깨울 때까지 대기 (무음 버퍼 재생)
  await new Promise(resolve => {
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.onended = resolve
    src.start(0)
    setTimeout(resolve, 300) // 안전망
  })

  setSoundUnlocked(true)
  emit('ready_to_start')
  setPhaseLabel('다른 플레이어들을 기다리는 중...')
  if (playerRef.current?.playVideo) {
    playerRef.current.playVideo()
    setTimeout(() => playerRef.current?.pauseVideo?.(), 200)
  }
}, [getAudioCtx])

  // 라운드 시퀀스
  useEffect(() => {
    if (!allReady || !roundActive) return

    const prevAc = seqAbortRef.current
    const ac = new AbortController()
    seqAbortRef.current = ac
    prevAc?.abort()
    const sig = ac.signal

    setAnswer(''); setSubmitted(false); setFlashWrong(false)
    setIsPlaying(false); setTimerActive(false)
    setShowResult(false); setPlaybackError(false)
    musicStartedRef.current = false

    async function runSequence() {
      const ctx = getAudioCtx()
    
      // 1. 오프닝 (1회)
      if (!openingDoneRef.current) {
        openingDoneRef.current = true
        setPhaseLabel('🎙️ 오프닝 안내 방송 중...')
        if (ctx?.state === 'suspended') await ctx.resume()
    
        // 팡파레 + 오프닝 MP3 순서대로
        await delay(700)
        if (sig.aborted) return
    
        await playAudioFile(OPENING_AUDIO, sig)  // opening.mp3 길이만큼 대기
        if (sig.aborted) return
        await delay(500)
        if (sig.aborted) return
      }
    
      // 2. 주제 안내 MP3
      const currentCategory = categoryRef.current
      if (currentCategory) {
        setPhaseLabel(`🎵 주제: ${currentCategory}`)
        
        const cleanCategory = currentCategory.replace(/[^가-힣a-zA-Z0-9]/g, '')
        const catSrc = CATEGORY_AUDIO[cleanCategory]
        
        if (catSrc) {
          // 재생 시작 시간 기록
          const startTime = Date.now();
          
          const isSuccess = await playAudioFile(catSrc, sig)
          if (sig.aborted) return
          
          // 파일이 너무 빨리 끝났더라도(예: 0.5초), 무조건 최소 2.5초는 기다리도록 강제 연장
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime < 2500) {
            await delay(2500 - elapsedTime);
          }
        await delay(500)
        if (sig.aborted) return
      }
    
      // 3. 음악 재생 (기존 그대로)
      if (!youtubeId) { emit('skip_round'); return }
      setPhaseLabel('🎧 소리를 들어보세요!')
      await playMusic(youtubeId, youtubeStart, youtubeEnd, sig)
      if (sig.aborted) return
    
      // 4. 틱 소리 (기존 그대로)
      setIsPlaying(false)
      setPhaseLabel('⌨️ 정답을 입력하세요!')
      await playTicksTillEnd(sig)
    }

    runSequence()

    return () => {
      ac.abort()
      clearInterval(tickRef.current)
      window.speechSynthesis.cancel()
      try { playerRef.current?.stopVideo?.() } catch(e) {}
    }
  }, [allReady, roundActive, youtubeId, currentRound, emit, getAudioCtx])

  // 라운드 비활성화 정리
  useEffect(() => {
    if (!roundActive) {
      seqAbortRef.current?.abort()
      clearInterval(tickRef.current)
      setTimerActive(false)
      setIsPlaying(false)
      try { playerRef.current?.stopVideo?.() } catch(e) {}
    }
  }, [roundActive])

  // 결과 수신
  useEffect(() => {
    if (!lastResult) return
    if (!lastResult.correct && !lastResult.noWinner && !lastResult.winnerId) return

    seqAbortRef.current?.abort()
    clearInterval(tickRef.current)
    try { playerRef.current?.stopVideo?.() } catch(e) {}
    setIsPlaying(false)
    setTimerActive(false)
    setShowResult(true)

    const t = setTimeout(() => setShowResult(false), 2500)
    return () => clearTimeout(t)
  }, [lastResult])

  // 개인 오답 시 입력창 잠금 해제 및 빨간 화면(flashWrong) 처리
  useEffect(() => {
    if (!lastResult) return
    // 누군가 정답을 맞히거나(winnerId) 시간초과(noWinner)로 라운드가 완전히 끝난 경우는 무시
    if (lastResult.correct || lastResult.winnerId || lastResult.noWinner) return
    
    // 만약 틀린 사람이 '나'라면 (서버에서 lastResult에 틀린 사람의 id를 userId 등으로 보내준다고 가정)
    // (서버가 별도 ID를 안 준다면 본인 화면에서 틀렸다는 응답이 왔을 때로 처리)
    setFlashWrong(true)   // 빨간 화면 깜빡임
    setSubmitted(false)   // ★ 핵심: 입력창 잠금 해제
    setAnswer('')         // 입력창 비우기
    
    // 1초 뒤 빨간 화면 깜빡임 효과 제거
    const t = setTimeout(() => {
      setFlashWrong(false)
      inputRef.current?.focus() // 다시 타자 칠 수 있게 포커스
    }, 1000)
    
    return () => clearTimeout(t)
  }, [lastResult])

  // 포커스
  useEffect(() => {
    if (roundActive && soundUnlocked)
      setTimeout(() => inputRef.current?.focus(), 300)
  }, [roundActive, soundUnlocked])

  const handleSubmit = useCallback(() => {
    if (!answer.trim() || submitted || !roundActive) return
    setSubmitted(true)
    submitAnswer(answer.trim())
  }, [answer, submitted, roundActive, submitAnswer])

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

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
