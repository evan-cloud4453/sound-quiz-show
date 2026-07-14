// client/src/pages/GameScreen.jsx — v5
// 변경:
//   - 좌측 세로 스코어보드 / 우측 타이머 패널 제거
//   - 음악 네모 아래에 참가자 가로 카드열(4명 한 줄, 초과 시 wrap) — 퀴즈쇼 스탠드 형태
//   - 타이머는 오디오 네모 우측 위에 작게
//   - 제출 시 실시간 말풍선(모두에게): 오답=일반색, 정답=초록색, 2.5초 후 사라짐
//   - 빨간 깜빡임(flashWrong)은 본인 화면에만 (기존 유지)

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../utils/GameContext'
import { useSocket } from '../hooks/useSocket'
import WaveformVisualizer from '../components/WaveformVisualizer'
import TimerRing from '../components/TimerRing'
import { getAvatar } from '../utils/avatars'
import './GameScreen.css'

const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 }

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

const CATEGORY_AUDIO = {
  '드라마': '/sounds/categories/드라마.mp3',
  '가요': '/sounds/categories/가요.mp3',
  '팝송': '/sounds/categories/팝송.mp3',
  '영화': '/sounds/categories/영화.mp3',
  '애니메이션': '/sounds/categories/애니메이션.mp3',
  '동요': '/sounds/categories/동요.mp3',
  '클래식음악': '/sounds/categories/클래식음악.mp3',
  '작곡가': '/sounds/categories/작곡가.mp3',
  '공연예술': '/sounds/categories/공연 예술.mp3',
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
  '춤의종류': '/sounds/categories/춤의종류.mp3',
  '가수': '/sounds/categories/가수.mp3',
  '게임': '/sounds/categories/게임.mp3',
  '군가': '/sounds/categories/군가.mp3',
  '브랜드': '/sounds/categories/브랜드.mp3',
  '예능': '/sounds/categories/예능.mp3',
  '유튜버': '/sounds/categories/유튜버.mp3'
  '롤 챔피언': '/sounds/categories/롤챔피언.mp3'
};
const INTRO_AUDIO   = '/sounds/opening_intro.mp3'    // 설명 소리 (스킵 대상)
const GO_AUDIO      = '/sounds/opening_go.mp3'       // 시작 소리 (항상 재생)
const BONUS_AUDIO   = '/sounds/bonus.mp3'            // 보너스 퀴즈 나레이션

function playAudioFile(src, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(); return }
    const audio = new Audio(src)
    audio.volume = 1.0
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    audio.onended = finish
    audio.onerror = () => { console.warn(`[오디오 재생 실패] ${src}`); finish() }
    signal?.addEventListener('abort', () => { audio.pause(); finish() })
    audio.play().catch(finish)
  })
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms))
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function GameScreen() {
  const { state, submitAnswer, backToTitle } = useGame()
  const { emit, on }            = useSocket()

  const {
    players, myId, nickname, hostId,
    currentRound, totalRounds,
    category, hint,
    youtubeId, youtubeStart, youtubeEnd,
    roundActive, lastResult, targetScore,
    isBonus, pointValue,
    timeLimit: serverTimeLimit,
    autoSkipOpening
  } = state

  const me = players?.find(p => p.id === myId)
  const isHost = !!(me?.isHost || (hostId && myId === hostId))

  const [soundUnlocked, setSoundUnlocked] = useState(false)
  const [bonusActive, setBonusActive] = useState(false)
  const [isPlaying,     setIsPlaying]     = useState(false)
  const [timerActive,   setTimerActive]   = useState(false)
  const [timerLimit,    setTimerLimit]    = useState(serverTimeLimit || 25)
  const [mediaReady,    setMediaReady]    = useState(false)
  const [answer,        setAnswer]        = useState('')
  const [answersOpen,   setAnswersOpen]   = useState(false)   // ★ 서버가 정답 접수를 연 뒤에만 true
  const [submitted,     setSubmitted]     = useState(false)
  const [flashWrong,    setFlashWrong]    = useState(false)
  const [phaseLabel,    setPhaseLabel]    = useState('접속 대기 중...')
  const [showResult,    setShowResult]    = useState(false)
  const [playbackError, setPlaybackError] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [openingPhase,  setOpeningPhase]  = useState(false)
  const [bubbles,       setBubbles]       = useState({})   // ★ { playerId: { text, correct, key } }

  const inputRef           = useRef(null)
  const playerRef          = useRef(null)
  const audioCtxRef        = useRef(null)
  const korVoiceRef        = useRef(null)
  const hostElemId         = useRef(`yt-${Math.random().toString(36).slice(2)}`)
  const seqAbortRef        = useRef(null)
  const openingDoneRef     = useRef(false)
  const skipOpeningRef     = useRef(null)
  const autoSkipRef        = useRef(false)
  const musicEndResolveRef = useRef(null)
  const tickRef            = useRef(null)
  const musicStartedRef    = useRef(false)
  const bubbleTimersRef    = useRef({})   // ★ playerId → 말풍선 제거 타이머

  const categoryRef = useRef(category)
  useEffect(() => { categoryRef.current = category }, [category])

  useEffect(() => { autoSkipRef.current = !!autoSkipOpening }, [autoSkipOpening])

  const targetScoreRef = useRef(targetScore)
  useEffect(() => { targetScoreRef.current = targetScore }, [targetScore])

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || window.webkitAudioContext
      if (Ctor) audioCtxRef.current = new Ctor()
    }
    return audioCtxRef.current
  }, [])

  // ─── 뒤로가기 / 새로고침 실수 방지 ──────────────────────────
  useEffect(() => {
    window.history.pushState({ guard: true }, '')
    const onPop = () => {
      setShowLeaveConfirm(true)
      window.history.pushState({ guard: true }, '')
    }
    window.addEventListener('popstate', onPop)
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  const confirmLeave = useCallback(() => {
    setShowLeaveConfirm(false)
    backToTitle()
  }, [backToTitle])

  // 전체화면 토글
  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    }
  }, [])

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

  // ★ 실시간 말풍선 수신 (제출 시 모두에게)
  useEffect(() => {
    const unsub = on('player_guess', ({ playerId, text, correct }) => {
      const key = `${Date.now()}-${Math.random()}`
      setBubbles(prev => ({ ...prev, [playerId]: { text, correct, key } }))
      clearTimeout(bubbleTimersRef.current[playerId])
      bubbleTimersRef.current[playerId] = setTimeout(() => {
        setBubbles(prev => {
          if (prev[playerId]?.key !== key) return prev
          const next = { ...prev }
          delete next[playerId]
          return next
        })
      }, 2500)
    })
    return unsub
  }, [on])

  // 라운드가 바뀌면 말풍선 초기화
  useEffect(() => {
    setBubbles({})
    Object.values(bubbleTimersRef.current).forEach(clearTimeout)
    bubbleTimersRef.current = {}
  }, [currentRound])

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

  // timer_start 수신
  useEffect(() => {
    const unsub = on('timer_start', ({ timeLimit }) => {
      setTimerLimit(timeLimit)
      setTimerActive(true)
      setAnswersOpen(true)                         // ★ 전원 준비됨 → 정답 입력 허용
      setTimeout(() => inputRef.current?.focus(), 50)
    })
    return unsub
  }, [on])

  // skip_opening 수신
  useEffect(() => {
    const unsub = on('skip_opening', () => {
      skipOpeningRef.current?.()
    })
    return unsub
  }, [on])

  const handleSkipOpening = useCallback(() => {
    emit('skip_opening')
  }, [emit])

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
        try { playerRef.current?.unMute?.() } catch(e) {}
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

    const dummyAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA')
    dummyAudio.play().catch(() => {})

    if (ctx) {
      await new Promise(resolve => {
        const buf = ctx.createBuffer(1, 1, 22050)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.onended = resolve
        src.start(0)
        setTimeout(resolve, 300)
      })
    }

    try {
      const yt = playerRef.current
      if (yt?.loadVideoById) {
        yt.mute()
        yt.loadVideoById({ videoId: 'M7lc1UVf-VE', startSeconds: 0 })
        yt.playVideo()
        await new Promise(r => setTimeout(r, 400))
        yt.stopVideo()
        yt.unMute()
      }
    } catch (e) {}

    setSoundUnlocked(true)
    emit('ready_to_start')
    setPhaseLabel('다른 플레이어들을 기다리는 중...')
  }, [getAudioCtx, emit])

  // 라운드 시퀀스
  useEffect(() => {
    if (!soundUnlocked || !roundActive) return

    const prevAc = seqAbortRef.current
    const ac = new AbortController()
    seqAbortRef.current = ac
    prevAc?.abort()
    const sig = ac.signal

    setAnswer(''); setSubmitted(false); setFlashWrong(false)
    setIsPlaying(false); setTimerActive(false); setAnswersOpen(false)
    setShowResult(false); setPlaybackError(false)
    setBonusActive(false)
    musicStartedRef.current = false

    async function runSequence() {
      const ctx = getAudioCtx()

      // 1. 오프닝 (1회)
      if (!openingDoneRef.current) {
        openingDoneRef.current = true
        if (ctx?.state === 'suspended') await ctx.resume()

        const introAc = new AbortController()
        const onMainAbort = () => introAc.abort()
        sig.addEventListener('abort', onMainAbort)
        skipOpeningRef.current = () => introAc.abort()

        const autoSkip = autoSkipRef.current
        if (!autoSkip) {
          setOpeningPhase(true)
          setPhaseLabel('🎙️ 게임 설명 중...')
          await delay(500)
          if (!sig.aborted && !introAc.signal.aborted) {
            await playAudioFile(INTRO_AUDIO, introAc.signal)
          }
          setOpeningPhase(false)
        }
        skipOpeningRef.current = null
        sig.removeEventListener('abort', onMainAbort)
        if (sig.aborted) return

        setPhaseLabel('자, 이제 게임을 시작합니다!')
        await playAudioFile(GO_AUDIO, sig)
        if (sig.aborted) return
        await delay(300)
        if (sig.aborted) return
      }

      // 1.5 보너스 퀴즈 연출
      if (isBonus) {
        setBonusActive(true)
        setPhaseLabel('보너스 퀴즈!')
        const hideTimer = setTimeout(() => setBonusActive(false), 2000)
        await playAudioFile(BONUS_AUDIO, sig)
        clearTimeout(hideTimer)
        setBonusActive(false)
        if (sig.aborted) return
      }

      // 2. 주제 안내 MP3
      const currentCategory = categoryRef.current
      if (currentCategory) {
        setPhaseLabel(`주제: ${currentCategory}`)
        const cleanCategory = currentCategory.normalize('NFC').replace(/[^가-힣a-zA-Z0-9]/g, '')
        const catSrc = CATEGORY_AUDIO[cleanCategory]
        if (catSrc) {
          const startTime = Date.now()
          await playAudioFile(catSrc, sig)
          if (sig.aborted) return
          const elapsedTime = Date.now() - startTime
          if (elapsedTime < 2500) await delay(2500 - elapsedTime)
        } else {
          console.warn(`[오디오 누락] '${cleanCategory}' 파일 없음`)
          await delay(2500)
        }
        await delay(500)
        if (sig.aborted) return
      }

      // 3. 음악 재생
      setBonusActive(false)
      if (!youtubeId) { emit('skip_round'); return }
      setPhaseLabel('🎧 소리를 들어보세요!')
      await playMusic(youtubeId, youtubeStart, youtubeEnd, sig)
      if (sig.aborted) return

      // 4. 틱 소리
      setIsPlaying(false)
      setPhaseLabel('⌨️ 정답을 입력하세요!')
      await playTicksTillEnd(sig)
    }

    runSequence()

    return () => {
      ac.abort()
      clearInterval(tickRef.current)
      window.speechSynthesis.cancel()
      setBonusActive(false)
      try { playerRef.current?.stopVideo?.() } catch(e) {}
    }
  }, [soundUnlocked, roundActive, youtubeId, currentRound, isBonus, emit, getAudioCtx])

  // 라운드 비활성화 정리
  useEffect(() => {
    if (!roundActive) {
      seqAbortRef.current?.abort()
      clearInterval(tickRef.current)
      setTimerActive(false)
      setAnswersOpen(false)
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

  // 개인 오답 처리 (빨간 깜빡임 — 본인 화면만)
  useEffect(() => {
    if (!lastResult) return
    if (lastResult.correct || lastResult.winnerId || lastResult.noWinner) return

    setFlashWrong(true)
    setSubmitted(false)
    setAnswer('')

    const t = setTimeout(() => {
      setFlashWrong(false)
      inputRef.current?.focus()
    }, 1000)
    return () => clearTimeout(t)
  }, [lastResult])

  // 포커스
  useEffect(() => {
    if (roundActive && soundUnlocked)
      setTimeout(() => inputRef.current?.focus(), 300)
  }, [roundActive, soundUnlocked])

  const handleSubmit = useCallback(() => {
    if (!answer.trim() || submitted || !roundActive || !answersOpen) return
    setSubmitted(true)
    submitAnswer(answer.trim())
  }, [answer, submitted, roundActive, answersOpen, submitAnswer])

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  const progressPct = totalRounds > 0 ? ((currentRound - 1) / totalRounds) * 100 : 0

  return (
    <div className={`game-screen ${flashWrong ? 'flash-wrong' : ''}`}>

      {/* 보너스 퀴즈 코즈믹 연출 오버레이 */}
      {bonusActive && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 50%, rgba(124,58,237,0.45), rgba(34,211,238,0.22) 40%, rgba(2,2,10,0.92) 78%)',
          animation: 'bonusPulse 1.1s ease-in-out infinite'
        }}>
          <div style={{ textAlign: 'center', animation: 'bonusPop 0.5s ease-out' }}>
            <div style={{
              fontSize: '3rem', fontWeight: 900, letterSpacing: '0.12em',
              background: 'linear-gradient(90deg,#a78bfa,#22d3ee)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 40px rgba(124,58,237,0.7)'
            }}>
              BONUS QUIZ
            </div>
          </div>
          <style>{`
            @keyframes bonusPulse { 0%,100% { opacity:.6 } 50% { opacity:1 } }
            @keyframes bonusPop { 0% { transform:scale(0.7); opacity:0 } 100% { transform:scale(1); opacity:1 } }
            @keyframes bubblePop { 0% { transform:translateY(6px) scale(0.8); opacity:0 } 100% { transform:translateY(0) scale(1); opacity:1 } }
          `}</style>
        </div>
      )}

      {/* 나가기 확인 모달 */}
      {showLeaveConfirm && (
        <div
          onClick={() => setShowLeaveConfirm(false)}
          style={{
            position:'fixed', inset:0, zIndex:100000,
            background:'rgba(4,5,15,0.7)', backdropFilter:'blur(8px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:16
          }}
        >
          <div className="glass-panel animate-scaleIn" onClick={e => e.stopPropagation()}
            style={{ width:'100%', maxWidth:380, padding:24, textAlign:'center' }}>
            <h2 style={{ marginBottom:8 }}>게임을 나가시겠어요?</h2>
            <p style={{ color:'var(--text-secondary)', fontSize:'0.9rem', marginBottom:20 }}>
              지금 나가면 진행 중인 게임에서 빠지게 됩니다.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1 }}
                      onClick={() => setShowLeaveConfirm(false)}>계속하기</button>
              <button className="btn btn-primary" style={{ flex:1 }}
                      onClick={confirmLeave}>나가기</button>
            </div>
          </div>
        </div>
      )}

      {/* 전체화면 버튼 (좌상단 고정, 기호만) */}
      <button
        onClick={toggleFullscreen}
        aria-label="전체화면"
        title="전체화면"
        style={{
          position:'fixed', top:14, left:14, zIndex:500,
          width:30, height:30, padding:0, borderRadius:8,
          display:'flex', alignItems:'center', justifyContent:'center',
          border:'1px solid rgba(255,255,255,0.2)',
          background:'rgba(255,255,255,0.08)',
          color:'var(--text-primary)', fontSize:'0.95rem', lineHeight:1, cursor:'pointer'
        }}
      >
        ⛶
      </button>

      {/* 나가기 버튼 (우상단 고정) */}
      {soundUnlocked && (
        <button
          onClick={() => setShowLeaveConfirm(true)}
          style={{
            position:'fixed', top:14, right:14, zIndex:500,
            padding:'8px 14px', borderRadius:999,
            border:'1px solid rgba(255,255,255,0.2)',
            background:'rgba(255,255,255,0.08)',
            color:'var(--text-primary)', fontSize:'0.85rem', cursor:'pointer'
          }}
        >
          나가기
        </button>
      )}

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

      {/* ── 메인 세로 레이아웃 ── */}
      <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* 라운드 진행 */}
        <div className="round-progress">
          <div className="round-info">
            <span className="glow-cyan">라운드 {currentRound || 1}</span>
            <span style={{ color:'var(--text-secondary)' }}> / {totalRounds}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width:`${progressPct}%` }} />
          </div>
        </div>

        {/* 주제 */}
        {category && (
          <div className="category-row animate-fadeIn">
            <div className="category-badge">{category}</div>
            {isBonus && (
              <div className="category-badge" style={{
                marginLeft: 8,
                background: 'linear-gradient(90deg, rgba(167,139,250,0.25), rgba(34,211,238,0.25))',
                border: '1px solid rgba(167,139,250,0.6)',
                color: '#e9d5ff'
              }}>
                배점 {pointValue}점
              </div>
            )}
            {hint && <span className="hint-text">힌트: {hint}</span>}
          </div>
        )}

        {/* 오디오 네모 + 타이머 (가로 배치, 타이머는 밖 우측 원래 크기) */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="audio-area glass-panel" style={{ flex: '1 1 320px', minWidth: 0 }}>
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
              {isHost && openingPhase && (
                <button
                  onClick={handleSkipOpening}
                  style={{
                    marginTop: 10, padding: '8px 18px', borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer'
                  }}
                >
                  설명 건너뛰고 시작
                </button>
              )}
            </div>
          </div>

          {/* 타이머 패널 (오디오 네모 밖 우측, 원래 크기) */}
          <div className="timer-panel glass-panel" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <div className="timer-label">남은 시간</div>
            <TimerRing
              key={`${currentRound}-${timerActive}`}
              timeLimit={timerLimit}
              active={timerActive}
            />
            <div className="timer-hint">빠를수록 유리!</div>
          </div>
        </div>

        {/* 정답 입력 */}
        <div className={`answer-area glass-panel ${roundActive?'active':''}`}>
          {roundActive ? (
            <>
              <div className="answer-row">
                <input
                  ref={inputRef}
                  className={`input answer-input ${flashWrong?'wrong':''}`}
                  placeholder={answersOpen ? '정답을 입력하세요...' : '🎧 잠시만요… 곧 입력할 수 있어요'}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={!answersOpen || (submitted && !flashWrong)}
                  maxLength={40}
                  autoComplete="off"
                  autoCapitalize="none"
                />
                <button
                  className="btn btn-primary submit-btn"
                  onClick={handleSubmit}
                  disabled={!answersOpen || !answer.trim() || (submitted && !flashWrong)}
                >
                  제출
                </button>
              </div>
              {submitted && !flashWrong && <p className="submitted-hint">판정 중...</p>}
              {flashWrong && <p className="wrong-hint">❌ 틀렸습니다! 다시 시도하세요.</p>}
            </>
          ) : (
            <p className="waiting-next">다음 라운드 준비 중...</p>
          )}
        </div>

        {/* ── 참가자 부스열 (퀴즈쇼 스탠드 — 각자 부스에서 소리치기) ── */}
        <div className="player-booths" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 4 }}>
          {players.map(p => {
            const isMe     = p.id === myId || p.nickname === nickname
            const isWinner = lastResult?.winnerId === p.id
            const bubble   = bubbles[p.id]
            return (
              <div
                key={p.id}
                style={{
                  position: 'relative',
                  flex: '1 1 170px',
                  minWidth: 130,
                  boxSizing: 'border-box'
                }}
              >
                {/* 말풍선 */}
                {bubble && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 20, maxWidth: 200, minWidth: 60,
                    animation: 'bubblePop 0.18s ease-out'
                  }}>
                    <div style={{
                      padding: '7px 12px', borderRadius: 14, fontSize: '0.86rem', fontWeight: 700,
                      textAlign: 'center', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                      color: bubble.correct ? '#052e16' : 'var(--text-primary)',
                      background: bubble.correct
                        ? 'linear-gradient(135deg,#34d399,#22c55e)'
                        : 'rgba(255,255,255,0.14)',
                      border: bubble.correct ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.18)',
                      boxShadow: bubble.correct ? '0 0 18px rgba(34,197,94,0.55)' : '0 2px 10px rgba(0,0,0,0.3)'
                    }}>
                      {bubble.text}
                    </div>
                    {/* 말풍선 꼬리 */}
                    <div style={{
                      width: 0, height: 0, margin: '0 auto',
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: `7px solid ${bubble.correct ? '#22c55e' : 'rgba(255,255,255,0.18)'}`
                    }} />
                  </div>
                )}

                {/* 카드 */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  minHeight: 118, height: '100%',
                  padding: '14px 8px', borderRadius: 14,
                  background: isMe ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.05)',
                  border: isWinner
                    ? '1.5px solid #22c55e'
                    : (isMe ? '1px solid rgba(124,58,237,0.6)' : '1px solid rgba(255,255,255,0.10)'),
                  boxShadow: isWinner ? '0 0 16px rgba(34,197,94,0.5)' : 'none',
                  transition: 'border 0.2s, box-shadow 0.2s',
                  opacity: p.disconnected ? 0.5 : 1
                }}>
                  <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>{p.avatar || getAvatar(p.id)}</div>
                  <div style={{
                    fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)',
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {p.nickname}{isMe && ' (나)'}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900 }} className="glow-cyan">
                    {p.score}<span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}> 점</span>
                  </div>
                  {p.disconnected && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>대기중</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
