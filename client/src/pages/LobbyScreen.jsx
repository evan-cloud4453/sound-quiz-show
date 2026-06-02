// client/src/pages/LobbyScreen.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useGame } from '../utils/GameContext'
import './LobbyScreen.css'

const AVATARS = ['🚀', '⭐', '🌙', '💫', '🪐', '☄️', '🌟', '👾', '🛸', '🌌', '🔭', '🎵']

function getAvatar(id) {
  const idx = id ? id.charCodeAt(id.length - 1) % AVATARS.length : 0
  return AVATARS[idx]
}

export default function LobbyScreen() {
  const { state, startGame, backToTitle, sendChat } = useGame()
  const {
    roomCode, players, hostId, myId, nickname,
    availableCategories, chatMessages,
    targetScore: ctxTargetScore, roundCount: ctxRoundCount, selectedCategories: ctxCats
  } = state

  // ── 설정 (방장이 모달에서 조정) ──
  const [targetScore, setTargetScore] = useState(ctxTargetScore || 5)
  const [roundCount, setRoundCount]   = useState(ctxRoundCount || 10)
  const [selectedCats, setSelectedCats] = useState(ctxCats || [])
  const [showSettings, setShowSettings] = useState(false)

  const [copied, setCopied]   = useState(false)
  const [starting, setStarting] = useState(false)

  // ── 채팅 ──
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef(null)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const me = players.find(p => p.id === myId) || players.find(p => p.nickname === nickname)
  const currentIsHost = me?.isHost || me?.id === hostId

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    await startGame({ targetScore, roundCount, categories: selectedCats })
    setStarting(false)
  }

  const toggleCategory = (cat) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const handleSendChat = () => {
    const text = chatInput.trim()
    if (!text) return
    sendChat(text)
    setChatInput('')
  }
  const handleChatKey = (e) => { if (e.key === 'Enter') handleSendChat() }

  const catSummary = selectedCats.length === 0
    ? '전체 주제'
    : `${selectedCats.length}개 주제`

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
                {copied ? '복사됨' : '복사'}
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

              {players.length < 8 && Array.from({ length: Math.min(2, 8 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="player-row empty">
                  <div className="player-avatar-sm empty-avatar">+</div>
                  <span className="empty-label">친구를 기다리는 중...</span>
                </div>
              ))}
            </div>
          </div>

          {/* ★ 채팅 패널 (기존 설정란 자리) */}
          <div className="glass-panel animate-fadeInUp" style={{ animationDelay: '0.2s', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="panel-title"><span>💬 채팅</span></div>

            <div style={{
              flex: 1,
              minHeight: 180,
              maxHeight: 280,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '8px 4px'
            }}>
              {chatMessages.length === 0 && (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', margin: 'auto' }}>
                  아직 메시지가 없어요. 첫 인사를 건네보세요! 👋
                </p>
              )}
              {chatMessages.map(m => {
                const mine = m.playerId === myId
                return (
                  <div key={m.id} style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: mine ? 'flex-end' : 'flex-start'
                  }}>
                    {!mine && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2, paddingLeft: 4 }}>
                        {getAvatar(m.playerId)} {m.nickname}
                      </span>
                    )}
                    <span style={{
                      background: mine
                        ? 'linear-gradient(135deg, var(--purple-core), var(--cyan-core))'
                        : 'rgba(255,255,255,0.08)',
                      color: 'var(--text-primary)',
                      padding: '7px 12px',
                      borderRadius: 14,
                      borderTopRightRadius: mine ? 4 : 14,
                      borderTopLeftRadius: mine ? 14 : 4,
                      fontSize: '0.9rem',
                      wordBreak: 'break-word',
                      lineHeight: 1.35
                    }}>
                      {m.text}
                    </span>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="answer-row" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="메시지를 입력하세요..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatKey}
                maxLength={200}
                autoComplete="off"
              />
              <button className="btn btn-primary" onClick={handleSendChat} disabled={!chatInput.trim()}>
                전송
              </button>
            </div>
          </div>

          {/* Host controls */}
          {currentIsHost ? (
            <div className="animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '0.3s' }}>
              <div className="setting-info" style={{ justifyContent: 'center' }}>
                <div className="info-chip">🏆 목표 {targetScore}점</div>
                <div className="info-chip">🎵 {roundCount}라운드</div>
                <div className="info-chip">📚 {catSummary}</div>
                <div className="info-chip">⏱️ 라운드당 15초</div>
              </div>

              <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
                ⚙️ 게임 설정
              </button>

              <button
                className={`btn btn-primary btn-lg start-btn ${starting ? 'starting' : ''}`}
                onClick={handleStart}
                disabled={starting || players.length < 1}
              >
                {starting ? '게임 시작 중...' : `게임 시작! (${players.length}명)`}
              </button>
            </div>
          ) : (
            <div className="glass-panel waiting-panel animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
              <div className="waiting-icon">🛸</div>
              <p className="waiting-text">방장이 설정을 마치고<br />게임을 시작할 때까지 기다려주세요!</p>
              <div className="waiting-dots"><span /><span /><span /></div>
            </div>
          )}
        </div>
      </div>

      {/* ★ 설정 모달 (방장 전용) */}
      {showSettings && currentIsHost && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(4,5,15,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <div
            className="glass-panel animate-scaleIn"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', padding: 24 }}
          >
            <div className="panel-title" style={{ marginBottom: 16 }}>
              <span>⚙️ 게임 설정</span>
              <button className="copy-btn" onClick={() => setShowSettings(false)}>✕ 닫기</button>
            </div>

            {/* 목표 점수 */}
            <div className="setting-row" style={{ marginBottom: 20 }}>
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

            {/* 라운드 수 */}
            <div className="setting-row" style={{ marginBottom: 20 }}>
              <label>라운드 수</label>
              <div className="score-selector">
                {[5, 7, 10, 15, 20].map(r => (
                  <button
                    key={r}
                    className={`score-option ${roundCount === r ? 'active' : ''}`}
                    onClick={() => setRoundCount(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 주제 선택 */}
            <div className="setting-row" style={{ marginBottom: 8 }}>
              <label>출제 주제 ({catSummary})</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                <button
                  className={`score-option ${selectedCats.length === 0 ? 'active' : ''}`}
                  onClick={() => setSelectedCats([])}
                  style={{ minWidth: 64 }}
                >
                  전체
                </button>
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    className={`score-option ${selectedCats.includes(cat) ? 'active' : ''}`}
                    onClick={() => toggleCategory(cat)}
                    style={{ minWidth: 'auto', padding: '8px 12px' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {availableCategories.length === 0 && (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 8 }}>
                  주제 목록을 불러오는 중...
                </p>
              )}
              <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: 10 }}>
                * 아무것도 선택하지 않으면 전체 주제에서 출제됩니다.
              </p>
            </div>

            <button
              className="btn btn-primary btn-lg w-full"
              onClick={() => setShowSettings(false)}
              style={{ marginTop: 16 }}
            >
              설정 완료
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
