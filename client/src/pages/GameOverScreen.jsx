import React, { useEffect, useState } from 'react'
import { useGame } from '../utils/GameContext'
import Confetti from '../components/Confetti'
import './GameOverScreen.css'

const AVATARS = ['🚀', '⭐', '🌙', '💫', '🪐', '☄️', '🌟', '🎵', '👾', '🛸', '🌌', '🔭']
function getAvatar(id) {
  return AVATARS[(id?.charCodeAt(id.length - 1) || 0) % AVATARS.length]
}

const RANK_MEDALS = ['🥇', '🥈', '🥉']

export default function GameOverScreen() {
  const { state, startGame, backToTitle } = useGame()
  const { winner, finalScores, isHost, myId, nickname, roomCode, targetScore } = state
  const [showConfetti, setShowConfetti] = useState(false)
  const [restarting, setRestarting] = useState(false)

  const isWinner = winner && (winner.id === myId || winner.nickname === nickname)

  useEffect(() => {
    setShowConfetti(true)
    const t = setTimeout(() => setShowConfetti(false), 5000)
    return () => clearTimeout(t)
  }, [])

  const handleRematch = () => {
    if (restarting) return
    setRestarting(true)
    startGame(targetScore)
    setTimeout(() => setRestarting(false), 3000)
  }

  return (
    <div className="gameover-screen">
      <Confetti active={showConfetti} />

      <div className="gameover-container">

        {/* Winner announcement */}
        <div className="winner-section animate-fadeInUp">
          {isWinner ? (
            <>
              <div className="winner-trophy">🏆</div>
              <h1 className="winner-title glow-gold">우승!</h1>
              <p className="winner-sub">당신이 사운드 캐치 챔피언입니다!</p>
            </>
          ) : (
            <>
              <div className="winner-trophy" style={{ filter: 'grayscale(0.3)' }}>🎮</div>
              <h1 className="winner-title">
                <span className="glow-cyan">{winner?.nickname}</span>
                <span> 우승!</span>
              </h1>
              <p className="winner-sub">다음에는 더 빠르게 도전해보세요!</p>
            </>
          )}
        </div>

        {/* Final scoreboard */}
        <div className="glass-panel final-scores animate-fadeInUp" style={{ animationDelay: '0.15s' }}>
          <div className="scores-title">📊 최종 결과</div>
          <div className="final-list">
            {finalScores.map((p, i) => {
              const isMe = p.id === myId || p.nickname === nickname
              return (
                <div
                  key={p.id || i}
                  className={`final-row ${i === 0 ? 'first' : ''} ${isMe ? 'me' : ''} animate-fadeInUp`}
                  style={{ animationDelay: `${0.2 + i * 0.08}s` }}
                >
                  <span className="final-rank">
                    {i < 3 ? RANK_MEDALS[i] : `${i + 1}위`}
                  </span>
                  <span className="final-avatar">{getAvatar(p.id)}</span>
                  <span className="final-name">
                    {p.nickname}
                    {isMe && <span className="me-chip">나</span>}
                  </span>
                  <div className="final-score-wrap">
                    <div
                      className="final-score-bar"
                      style={{
                        width: `${Math.min((p.score / (finalScores[0]?.score || 1)) * 100, 100)}%`,
                        background: i === 0
                          ? 'linear-gradient(90deg, #f59e0b, #fcd34d)'
                          : 'linear-gradient(90deg, var(--purple-core), var(--cyan-core))'
                      }}
                    />
                    <span className="final-score-num">{p.score}점</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="gameover-actions animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
          {isHost && (
            <button
              className="btn btn-primary btn-lg action-btn"
              onClick={handleRematch}
              disabled={restarting}
            >
              {restarting ? '⏳ 시작 중...' : '🚀 다시 하기!'}
            </button>
          )}
          {!isHost && (
            <div className="waiting-rematch glass-panel">
              <span>🕐 방장이 다시 시작하기를 기다리는 중...</span>
            </div>
          )}
          <button className="btn btn-secondary action-btn" onClick={backToTitle}>
            🏠 메인으로 돌아가기
          </button>
        </div>

        {/* Room code reminder */}
        <p className="room-reminder">방 코드: <span className="glow-cyan" style={{ fontFamily: 'var(--font-display)' }}>{roomCode}</span></p>

      </div>
    </div>
  )
}
