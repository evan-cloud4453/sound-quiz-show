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

// 브라우저 가비지 컬렉터(GC)에 의해 TTS가 끊기는 버그 방지용 글로벌 배열
window.utterances = window.utterances || [];

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

// ─── 파티 입장음 (실로폰 아르페지오) ───────────────────────────
function playFanfare(ctx) {
  const t = ctx.currentTime;
  const playNote = (freq, offset) => {
    const osc = ctx.createOscillator(); 
    const gain = ctx.createGain();
    osc.type = 'sine'; 
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, t + offset); 
    gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.15);
    osc.connect(gain); 
    gain.connect(ctx.destination);
    osc.start(t + offset); 
    osc.stop(t + offset + 0.2);
  };
  playNote(523.25, 0);   
  playNote(659.25, 0.1); 
  playNote(783.99, 0.2); 
  playNote(1046.50, 0.3); 
  return 600; // ms
}

// ─── 틱 소리 ─────────────────────────────────────────────────
function playTick(ctx) {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type             = 'sine'
  osc.frequency.value = 850
  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(); osc.stop(ctx.currentTime + 0.06)
}

// ─── 무적 TTS 엔진 ──────────────────────────────
function speakSafe(text, voice) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utt   = new SpeechSynthesisUtterance(text);
    utt.lang    = 'ko-KR';
    if(voice) utt.voice = voice;
    utt.rate    = 1.1; 
    
    // 브라우저가 버리지 못하게 글로벌 락
    window.utterances.push(utt);

    let resolved = false;
    const safeResolve = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    utt.onend   = safeResolve;
    utt.onerror = safeResolve;
    window.speechSynthesis.speak(utt);

    // 완벽한 타임아웃 보험 (글자당 150ms + 1초 여유)
    const fallbackTime = Math.max(text.length * 150 + 1000, 2000);
    setTimeout(safeResolve, fallbackTime);
  });
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
    timeLimit: serverTimeLimit,
    isTimerRunning
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

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || window.webkitAudioContext
      if (Ctor) audioCtxRef.current = new Ctor()
    }
    return audioCtxRef.current
  }, [])

  useEffect(() => {
    const initVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      const ko     = voices.filter(v => v.lang.startsWith('ko'))
      korVoiceRef.current = (
        ko.find(v => /natural|premium|google|siri|yuna/i.test(v.name)) || ko[0] || null
      )
    }
    initVoice();
    window.speechSynthesis.onvoiceschanged = initVoice;
  }, [])

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
  }, [])

  const ytStateHandlerRef = useRef()
  ytStateHandlerRef.current = (event) => {
    if (event.data === YT_STATE.PLAYING) {
      setIsPlaying(true)
      setPlaybackError(false)

      if (!musicStartedRef.current) {
        musicStartedRef.current = true
        emit('music_started') // 💡 서버로 타이머 가동 신호
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

  // ── 서버 timer_start 수신 ────────────
  useEffect(() => {
    const unsub = on('timer_start', ({ timeLimit }) => {
      setTimerLimit(timeLimit)
      setTimerActive(true)
      setPhaseLabel('⌨️ 정답을 입력하세요!')
    })
    return unsub
  }, [on])

  function playMusic(videoId, startSec, endSec, signal) {
    return new Promise((resolve) => {
      if (signal?.aborted) { resolve(); return }

      const start   = Number(startSec) || 0
      const end     = Number(endSec)   || 0
      const clipSec = (end > start) ? (end - start) : 10 // 기본 10초 재생으로 고정

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

      // 10초가 지나면 무조건 노래 끊고 리졸브 (틱틱 시작)
      const safetyTimer = setTimeout(() => {
        try { playerRef.current?.stopVideo?.() } catch(e) {}
        safeResolve()
      }, clipSec * 1000)

      signal?.addEventListener('abort', () => {
        clearTimeout(safetyTimer)
        try { playerRef.current?.stopVideo?.() } catch(e) {}
        safeResolve()
      })

      const origSafe = safeResolve
      musicEndResolveRef.current = () => {
        clearTimeout(safetyTimer)
        origSafe()
      }
    })
  }

  // ── 남은 시간까지 틱 소리 재생 ──────────────────────────
  function playTicksTillEnd(signal) {
    return new Promise(resolve => {
      clearInterval(tickRef.current)
      tickRef.current = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(tickRef.current); resolve(); return;
        }
        const ctx = getAudioCtx()
        if (ctx) playTick(ctx)
      }, 1000)
    })
  }

  const handleUnlock = useCallback(async () => {
    const ctx = getAudioCtx()
    if (ctx?.state === 'suspended') await ctx.resume()

    const warmup = new SpeechSynthesisUtterance(' ')
    warmup.volume = 0
    warmup.lang   = 'ko-KR'
    window.speechSynthesis.speak(warmup)

    setSoundUnlocked(true)
    if (playerRef.current?.playVideo) {
      playerRef.current.playVideo()
      setTimeout(() => playerRef.current?.pauseVideo?.(), 200)
    }
  }, [getAudioCtx])

  // ── 완벽히 제어되는 라운드 시퀀스 파이프라인 ────────────────
  useEffect(() => {
    if (!soundUnlocked || !roundActive) return

    seqAbortRef.current?.abort()
    const ac  = new AbortController()
    seqAbortRef.current = ac
    const sig = ac.signal

    setAnswer(''); setSubmitted(false); setFlashWrong(false)
    setIsPlaying(false); setTimerActive(false)
    setShowResult(false); setPlaybackError(false)
    musicStartedRef.current = false 

    async function runSequence() {
      const ctx = getAudioCtx()

      // 1. 오프닝 로직
      if (!openingDoneRef.current) {
        openingDoneRef.current = true
        setPhaseLabel('🎙️ 오프닝 안내 방송 중...')

        if (ctx) {
          if (ctx.state === 'suspended') await ctx.resume()
          playFanfare(ctx)
        }
        if (sig.aborted) return

        await speakSafe(
          `여러분 안녕하세요. 소리를 듣고 정답을 최대한 빨리 맞춰주세요. 답이 무엇인지 알 것 같다면 정답을 입력해주세요. 입력한 답이 맞다면 1점을 얻습니다. ${targetScore}점을 먼저 달성한 사람이 승리합니다. 자, 이제 시작해볼까요?`,
          korVoiceRef.current
        )
        if (sig.aborted) return
        await delay(1000) // 멘트 끝나고 1초 대기
        if (sig.aborted) return
      }

      // 2. 주제 안내 로직
      if (category) {
        setPhaseLabel(`🎵 주제: ${category}`)
        await speakSafe(category, korVoiceRef.current)
        if (sig.aborted) return
        await delay(500) // 주제 안내 후 0.5초 대기
        if (sig.aborted) return
      }

      // 3. 유튜브 음악 가동
      if (!youtubeId) {
        emit('skip_round')
        return
      }

      setPhaseLabel('🎧 소리를 들어보세요!')
      await playMusic(youtubeId, youtubeStart, youtubeEnd, sig)
      if (sig.aborted) return

      // 4. 음악 10초 끝난 직후 틱-틱 사운드 작동
      setIsPlaying(false)
      setPhaseLabel('⌨️ 정답을 입력하세요!')
      await playTicksTillEnd(sig) // 서버 타이머가 끝내줄 때까지 틱틱 소리 반복
    }

    runSequence()

    return () => {
      ac.abort()
      clearInterval(tickRef.current)
      window.speechSynthesis.cancel()
      try { playerRef.current?.stopVideo?.() } catch(e) {}
    }
  }, [soundUnlocked, roundActive, youtubeId, currentRound, category, targetScore, emit, getAudioCtx])

  useEffect(() => {
    if (!roundActive) {
      seqAbortRef.current?.abort()
      clearInterval(tickRef.current)
      setTimerActive(false)
      setIsPlaying(false)
      try { playerRef.current?.stopVideo?.() } catch(e) {}
    }
  }, [roundActive])

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

  useEffect(() => {
    if (!lastResult) return
    if (lastResult.correct || lastResult.noWinner || lastResult.winnerId) return
    setSubmitted(false); setAnswer('')
    setFlashWrong(true)
    const t = setTimeout(() => setFlashWrong(false), 600)
    inputRef.current?.focus()
    return () => clearTimeout(t)
  }, [lastResult])

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
      <div style={{ position:'absolute', width:1, height:1, overflow:'hidden', opacity:0, pointerEvents:'none' }}>
        <div id={hostElemId.current} />
      </div>

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
            fontSize:'1.8rem', color:'#06b6d4', textShadow:'0 0 15px rgba(6,182,212,0.6)',
            textAlign:'center', padding:'0 24px', wordBreak:'keep-all'
          }}>
            화면을 터치해서 게임을 시작하세요
          </h2>
          <p style={{ color:'#94a3b8', fontSize:'1rem', textAlign:'center', padding:'0 24px' }}>
            오디오 시스템 활성화를 위해 터치가 필요합니다
          </p>
        </div>
      )}

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

      <div className="game-layout">
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

        <div className="timer-panel glass-panel">
          <div className="timer-label">남은 시간</div>
          {/* 💡 서버와 상태 동기화를 위해 isTimerRunning을 키에 포함시킴 */}
          <TimerRing
            key={`${currentRound}-${timerActive || isTimerRunning}`}
            timeLimit={timerLimit}
            active={timerActive || isTimerRunning}
          />
          <div className="timer-hint">빠를수록 유리!</div>
        </div>

      </div>
    </div>
  )
}
