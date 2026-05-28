import React, { useState } from 'react'
import { useGame } from '../utils/GameContext'
import './LobbyScreen.css'

const AVATARS = ['🚀', '⭐', '🌙', '💫', '🪐', '☄️', '🌟', '🎵', '👾', '🛸', '🌌', '🔭']

function getAvatar(id) {
  // Deterministic avatar from player id
  const idx = id ? id.charCodeAt(id.length - 1) % AVATARS.length : 0
  return AVATARS[idx]
}

export default function LobbyScreen() {
  const { state, startGame, backToTitle } = useGame()
  const { roomCode, players, isHost, hostId, myId, nickname } = state
  const [targetScore, setTargetScore] = useState(5)
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleStart = () => {
    if (starting) return
    setStarting(true)
    startGame(targetScore)
    setTimeout(() => setStarting(false), 3000)
  }

  const me = players.find(p => p.id === myId) || players.find(p => p.nickname === nickname)

  return (
    <div className="lobby-screen">
      <div className="lobby-container">

        {/* Header */}
        <div className="lobby-header animate-fadeInUp">
          <button className="back-btn-sm" onClick={backToTitle}>← 나가기</button>
          <div className="room-code-display">
            <span className="room-code-label">방 코드</span>
            <div className="room-code-value">
              <span className="glow-cyan" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.2em' }}>
                {roomCode}
              </span>
              <button className="copy-btn" onClick={copyCode}>
                {copied ? '✅ 복사됨' : '📋 복사'}
              </button>
            </div>
            <p className="room-code-hint">친구에게 이 코드를 알려주세요!</p>
          </div>
        </div>

        <div className="lobby-body">
          {/* Players list */}
          <div className="glass-panel players-panel animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
            <div className="panel-title">
              <span>👥 플레이어 ({players.length}/8)</span>
              <div className="players-count-bar">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`count-pip ${i < players.length ? 'filled' : ''}`} />
                ))}
              </div>
            </div>

            <div className="players-list">
              {players.map((p, i) => (
                <div
                  key={p.id}
                  className={`player-row ${p.id === myId || p.nickname === nickname ? 'me' : ''} animate-fadeInUp`}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="player-avatar-sm">{getAvatar(p.id)}</div>
                  <div className="player-info">
                    <span className="player-name">
                      {p.nickname}
                      {(p.id === myId || p.nickname === nickname) && <span className="me-tag">나</span>}
                    </span>
                    {p.id === hostId && <span className="host-tag">👑 방장</span>}
                  </div>
                  <div className={`ready-indicator ${p.id === hostId ? 'host' : 'waiting'}`}>
                    {p.id === hostId ? '방장' : '대기 중'}
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {players.length < 8 && Array.from({ length: Math.min(2, 8 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="player-row empty">
                  <div className="player-avatar-sm empty-avatar">+</div>
                  <span className="empty-label">친구를 기다리는 중...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Game settings (host only) */}
          {isHost && (
            <div className="glass-panel settings-panel animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              <div className="panel-title">⚙️ 게임 설정</div>

              <div className="setting-row">
                <label>목표 점수 (먼저 달성하면 승리!)</label>
                <div className="score-selector">
                  {[3, 5, 7, 10, 15, 20].map(s => (
                    <button
                      key={s}
                      className={`score-option ${targetScore === s ? 'active' : ''}`}
                      onClick={() => setTargetScore(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-info">
                <div className="info-chip">🎵 최대 10라운드</div>
                <div className="info-chip">⏱️ 라운드당 15초</div>
                <div className="info-chip">🏆 목표: {targetScore}점</div>
              </div>
            </div>
          )}

          {/* Non-host waiting message */}
          {!isHost && (
            <div className="glass-panel waiting-panel animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              <div className="waiting-icon">🛸</div>
              <p className="waiting-text">방장이 게임을 시작할 때까지<br />기다려주세요!</p>
              <div className="waiting-dots">
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* Start button (host only) */}
          {isHost && (
            <button
              className={`btn btn-primary btn-lg start-btn animate-fadeInUp ${starting ? 'starting' : ''}`}
              style={{ animationDelay: '0.3s' }}
              onClick={handleStart}
              disabled={starting || players.length < 1}
            >
              {starting ? '🚀 게임 시작 중...' : `🚀 게임 시작! (${players.length}명)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
