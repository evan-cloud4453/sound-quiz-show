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
  const { state, startGame, returnToLobby, backToTitle } = useGame()
  const {
    winner, isDraw, drawPlayers, finalScores, myId, nickname, roomCode,
    targetScore, roundCount, selectedCategories, hostId
  } = state
  // ★ 방장 판별은 서버가 실시간 갱신하는 hostId 만 사용.
  //   (state.isHost 는 방 생성 시 1회만 정해져 위임 후에도 안 바뀌므로 쓰면 안 됨)
  const isHost = !!myId && myId === hostId
  const [showConfetti, setShowConfetti] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [returning, setReturning] = useState(false)

  const isWinner = winner && (winner.id === myId || winner.nickname === nickname)

  useEffect(() => {
    setShowConfetti(true)
    const t = setTimeout(() => setShowConfetti(false), 5000)
    return () => clearTimeout(t)
  }, [])

  const handleRematch = async () => {
    if (restarting) return
    setRestarting(true)
    // 직전 게임 설정 그대로 재사용 + 오프닝 설명 자동 스킵 + 준비 체크 건너뜀
    await startGame({ targetScore, roundCount, categories: selectedCategories, autoSkipOpening: true, fromRematch: true })
    setRestarting(false)
  }

  const handleReturnToLobby = () => {
    if (returning) return
    setReturning(true)
    returnToLobby() // 서버가 모두를 대기방으로 보냄 (back_to_lobby)
  }

  return (
    <div className="gameover-screen">
      <Confetti active={showConfetti} />

      <div className="gameover-container">

        {/* Winner announcement */}
        <div className="winner-section animate-fadeInUp">
          {isDraw ? (
            <>
              <div className="winner-trophy">🤝</div>
              <h1 className="winner-title glow-cyan">무승부!</h1>
              <p className="winner-sub">
                {drawPlayers?.map(p => p.nickname).join(', ')}
                {' — 공동 1위!'}
              </p>
            </>
          ) : winner ? (
            isWinner ? (
              <>
                <div className="winner-trophy">🏆</div>
                <h1 className="winner-title glow-gold">우승!</h1>
                <p className="winner-sub">당신이 챔피언입니다!</p>
              </>
            ) : (
              <>
                <div className="winner-trophy">🎮</div>
                <h1 className="winner-title">
                  <span className="glow-cyan">{winner.nickname}</span> 우승!
                </h1>
                <p className="winner-sub">다음엔 더 빠르게!</p>
              </>
            )
          ) : (
            <>
              <div className="winner-trophy">🎮</div>
              <h1 className="winner-title glow-purple">게임 종료!</h1>
              <p className="winner-sub">수고하셨습니다!</p>
            </>
          )}
        </div>

        {/* Final scoreboard */}
        <div className="glass-panel final-scores animate-fadeInUp" style={{ animationDelay: '0.15s' }}>
          <div className="scores-title">최종 결과</div>
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
                  <span className="final-avatar">{p.avatar || getAvatar(p.id)}</span>
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
          {isHost ? (
            <>
              <button
                className="btn btn-primary btn-lg action-btn"
                onClick={handleRematch}
                disabled={restarting || returning}
              >
                {restarting ? '시작하는 중...' : '다시 하기'}
              </button>
              <button
                className="btn btn-secondary action-btn"
                onClick={handleReturnToLobby}
                disabled={restarting || returning}
              >
                {returning ? '이동하는 중...' : '대기방으로'}
              </button>
            </>
          ) : (
            <div className="waiting-rematch glass-panel">
              <span>방장이 다음 행동을 선택하는 중입니다</span>
            </div>
          )}
          <button className="btn btn-secondary action-btn" onClick={backToTitle}>
            메인으로 나가기
          </button>
        </div>

        {/* Room code reminder */}
        <p className="room-reminder">방 코드: <span className="glow-cyan" style={{ fontFamily: 'var(--font-display)' }}>{roomCode}</span></p>

      </div>
    </div>
  )
}
