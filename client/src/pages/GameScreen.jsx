import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../utils/GameContext'
import { useSocket } from '../hooks/useSocket'

import WaveformVisualizer from '../components/WaveformVisualizer'
import TimerRing from '../components/TimerRing'
import './GameScreen.css'

const AVATARS = ['🚀', '⭐', '🌙', '💫', '🪐', '☄️', '🌟', '🎵', '👾', '🛸', '🌌', '🔭']
function getAvatar(id) {
  return AVATARS[(id?.charCodeAt(id.length - 1) || 0) % AVATARS.length]
}

export default function GameScreen() {
  const { state, submitAnswer } = useGame()
  const { emit } = useSocket()
  
  // 💡 MongoDB 데이터 구조에 맞춰 audioUrl과 startTime을 받도록 수정되었습니다.
  const {
    players, myId, nickname,
    currentRound, totalRounds, category, hint,
    audioUrl, startTime, 
    roundActive, lastResult, targetScore
  } = state

  const [answer, setAnswer] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [timerActive, setTimerActive] = useState(false) // 독립된 타이머 상태
  const [mediaLoaded, setMediaLoaded] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [flashWrong, setFlashWrong] = useState(false)
  const [phaseLabel, setPhaseLabel] = useState('다음 라운드 준비 중...')
  const [showResult, setShowResult] = useState(false)
  const [playbackBlocked, setPlaybackBlocked] = useState(false)
  const [playbackError, setPlaybackError] = useState(false)

  const inputRef = useRef(null)
  const audioRef = useRef(null)
  const audioStopTimerRef = useRef(null)
  const failSafeTimerRef = useRef(null)

  // =========================================================
  // 🟢 1. 핵심 오디오 및 20초 에러 스킵 매니저
  // =========================================================
  useEffect(() => {
    if (roundActive && audioUrl) {
      // 라운드 시작 시 상태 초기화
      setAnswer('')
      setSubmitted(false)
      setFlashWrong(false)
      setIsPlaying(false)
      setTimerActive(false)
      setShowResult(false)
      setPlaybackBlocked(false)
      setPlaybackError(false)
      setMediaLoaded(true)
      setPhaseLabel('오디오 로딩 중...')

      // 기존 오디오 청소
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      const audio = new Audio(audioUrl)
      audio.currentTime = startTime || 0
      audioRef.current = audio

      // 🚨 [20초 구명조끼] 20초 동안 재생에 성공하지 못하면 강제 스킵!
      failSafeTimerRef.current = setTimeout(() => {
        if (audioRef.current) audioRef.current.pause()
        setIsPlaying(false)
        setTimerActive(false)
        window.alert("⚠️ 음원 재생 지연 오류! 다음 문제로 강제 이동합니다.")
        emit('skip_round') // 서버로 스킵 신호 발송
      }, 20000)

      // 오디오 자동 재생 시도
      audio.play()
        .then(() => {
          clearTimeout(failSafeTimerRef.current) // 재생 성공 시 에러 타이머 해제
          setPhaseLabel('소리를 들어보세요!')
          setIsPlaying(true)
          setTimerActive(true) // ⏱️ 타이머 출발!
          emit('youtube_playing')

          // 10초 뒤 음악'만' 정지 (타이머는 계속 돌아감)
          audioStopTimerRef.current = setTimeout(() => {
            if (audioRef.current) audioRef.current.pause()
            setIsPlaying(false)
          }, 10000)
        })
        .catch(err => {
          console.error("오디오 재생 실패 (브라우저 자동재생 차단):", err)
          setPlaybackBlocked(true)
          setPhaseLabel('재생 버튼을 눌러주세요')
          // failSafeTimerRef는 계속 돌아가고 있으므로, 20초 안에 버튼 안 누르면 넘어감!
        })

      return () => {
        clearTimeout(audioStopTimerRef.current)
        clearTimeout(failSafeTimerRef.current)
        if (audioRef.current) audioRef.current.pause()
      }
    } else if (roundActive && !audioUrl) {
      setPlaybackError(true)
      setPhaseLabel('음원 주소가 없습니다.')
    }
  }, [roundActive, currentRound, audioUrl, startTime, emit])

  // =========================================================
  // 🟢 2. 자동재생 차단 시 수동 재생 버튼
  // =========================================================
  const playManual = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.play()
      .then(() => {
        clearTimeout(failSafeTimerRef.current)
        setPlaybackBlocked(false)
        setPhaseLabel('소리를 들어보세요!')
        setIsPlaying(true)
        setTimerActive(true)
        emit('youtube_playing')

        audioStopTimerRef.current = setTimeout(() => {
          if (audioRef.current) audioRef.current.pause()
          setIsPlaying(false)
        }, 10000)
      })
      .catch(e => console.error(e))
  }, [emit])

  // =========================================================
  // 🟢 3. 기타 게임 상태 관리 (타이머 정지, 정답 처리 등)
  // =========================================================
  useEffect(() => {
    if (!roundActive) setTimerActive(false)
  }, [roundActive])

  useEffect(() => {
    if (lastResult) {
      const isRoundResult = lastResult.correct || lastResult.noWinner || lastResult.winnerId
      if (!isRoundResult) return undefined

      // 누군가 정답을 맞히거나 시간이 끝나면 음악 즉시 정지
      if (audioRef.current) {
        audioRef.current.pause()
        setIsPlaying(false)
      }

      setShowResult(true)
      setPhaseLabel(lastResult.correct ? '🎉 정답!' : '⏰ 시간 초과!')
      const t = setTimeout(() => setShowResult(false), 2500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [lastResult])

  useEffect(() => {
    if (roundActive && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [roundActive])

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
      {/* Result overlay */}
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
              <div className="result-text">시간 초과!</div>
              <div className="result-answer">정답: {lastResult.answer}</div>
              <div className="result-sub">모두에게 +1점</div>
            </div>
          )}
        </div>
      )}

      <div className="game-layout">
        {/* LEFT: Scoreboard */}
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

        {/* CENTER: Game area */}
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

          {/* Audio player + visualizer */}
          <div className="audio-area glass-panel">
            <div className="audio-inner youtube-audio-inner">
              
              <div className="youtube-player-shell">
                 {/* 유튜브 iframe 코드는 MongoDB 오디오 방식 전환으로 인해 완전히 삭제되었습니다 */}
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
                
                {/* 브라우저 정책으로 자동재생이 막혔을 때 등장하는 수동 버튼 */}
                {playbackBlocked && (
                  <button className="btn btn-secondary audio-play-btn" onClick={playManual}>
                    ▶ 재생
                  </button>
                )}
                {playbackError && (
                  <div className="audio-error">음원을 재생할 수 없습니다.</div>
                )}
                <div className="phase-label">{phaseLabel}</div>
              </div>
            </div>
          </div>

          {/* Answer input area */}
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

        {/* RIGHT: Timer */}
        <div className="timer-panel glass-panel">
          <div className="timer-label">남은 시간</div>
          {/* 💡 복잡한 조건 없이 timerActive 하나만으로 완벽하게 돌아갑니다 */}
          <TimerRing
            timeLimit={state.timeLimit || 15}
            active={timerActive} 
          />
          <div className="timer-hint">빠를수록 유리!</div>
        </div>
      </div>
    </div>
  )
}
