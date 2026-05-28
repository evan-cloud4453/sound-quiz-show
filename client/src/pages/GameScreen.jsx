import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGame } from '../utils/GameContext'
import WaveformVisualizer from '../components/WaveformVisualizer'
import TimerRing from '../components/TimerRing'
import './GameScreen.css'

const AVATARS = ['🚀', '⭐', '🌙', '💫', '🪐', '☄️', '🌟', '🎵', '👾', '🛸', '🌌', '🔭']
function getAvatar(id) {
  return AVATARS[(id?.charCodeAt(id.length - 1) || 0) % AVATARS.length]
}

export default function GameScreen() {
  const { state, submitAnswer } = useGame()
  const {
    players, myId, nickname,
    currentRound, totalRounds, category, hint, audioUrl,
    roundActive, lastResult, targetScore
  } = state

  const [answer, setAnswer] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioLoaded, setAudioLoaded] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [flashWrong, setFlashWrong] = useState(false)
  const [phaseLabel, setPhaseLabel] = useState('다음 라운드 준비 중...')
  const [showResult, setShowResult] = useState(false)

  const audioRef = useRef(null)
  const inputRef = useRef(null)

  // New round: reset state
  useEffect(() => {
    if (!audioUrl) return
    setAnswer('')
    setSubmitted(false)
    setFlashWrong(false)
    setIsPlaying(false)
    setAudioLoaded(false)
    setShowResult(false)
    setPhaseLabel('소리를 들어보세요!')

    // Load & play audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = audioUrl
      audioRef.current.load()
    }
  }, [audioUrl, currentRound])

  // Auto focus input when round active
  useEffect(() => {
    if (roundActive && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [roundActive])

  // Show result overlay
  useEffect(() => {
    if (lastResult) {
      setShowResult(true)
      setPhaseLabel(lastResult.correct ? '🎉 정답!' : '⏰ 시간 초과!')
      const t = setTimeout(() => setShowResult(false), 2500)
      return () => clearTimeout(t)
    }
  }, [lastResult])

  const handleAudioLoaded = () => {
    setAudioLoaded(true)
    setIsPlaying(true)
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
  }

  const handleSubmit = useCallback(() => {
    if (!answer.trim() || submitted || !roundActive) return
    setSubmitted(true)
    submitAnswer(answer.trim())
    // If wrong, server sends answer_result with correct:false for this socket only
  }, [answer, submitted, roundActive, submitAnswer])

  const handleKey = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  // Flash wrong when server says incorrect (only personal)
  useEffect(() => {
    if (lastResult && !lastResult.correct && !lastResult.noWinner && !lastResult.winnerId) {
      setSubmitted(false) // allow resubmit
      setAnswer('')
      setFlashWrong(true)
      setTimeout(() => setFlashWrong(false), 600)
      inputRef.current?.focus()
    }
  }, [lastResult])

  const me = players.find(p => p.id === myId || p.nickname === nickname)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  const progressPct = totalRounds > 0 ? ((currentRound - 1) / totalRounds) * 100 : 0

  return (
    <div className={`game-screen ${flashWrong ? 'flash-wrong' : ''}`}>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onLoadedData={handleAudioLoaded}
        onEnded={handleAudioEnded}
        onError={() => setAudioLoaded(true)}
        preload="auto"
      />

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
                <div
                  key={p.id}
                  className={`score-row ${isMe ? 'me' : ''} ${isWinner ? 'just-won' : ''}`}
                >
                  <span className="rank-num">{i + 1}</span>
                  <span className="player-ava">{getAvatar(p.id)}</span>
                  <span className="score-name">
                    {p.nickname}
                    {isMe && <span className="me-badge">나</span>}
                  </span>
                  <div className="score-bar-wrap">
                    <div
                      className="score-bar"
                      style={{ width: `${Math.min((p.score / targetScore) * 100, 100)}%` }}
                    />
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

          {/* Progress bar */}
          <div className="round-progress">
            <div className="round-info">
              <span className="glow-cyan">라운드 {currentRound}</span>
              <span className="text-secondary"> / {totalRounds}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Category */}
          {category && (
            <div className="category-row animate-fadeIn">
              <div className="category-badge">🎵 {category}</div>
              {hint && <span className="hint-text">힌트: {hint}</span>}
            </div>
          )}

          {/* Audio visualizer */}
          <div className="audio-area glass-panel">
            <div className="audio-inner">
              {audioLoaded ? (
                <WaveformVisualizer isPlaying={isPlaying} />
              ) : (
                <div className="audio-loading">
                  <div className="loading-spinner" />
                  <span>사운드 로딩 중...</span>
                </div>
              )}
              <div className="phase-label">{phaseLabel}</div>
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
          <TimerRing
            timeLimit={state.timeLimit || 15}
            active={roundActive}
          />
          <div className="timer-hint">빠를수록 유리!</div>
        </div>

      </div>
    </div>
  )
}
