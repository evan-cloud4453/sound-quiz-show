import React, { useState } from 'react'
import { useGame } from '../utils/GameContext'
import './TitleScreen.css'

const AVATARS = ['🚀', '⭐', '🌙', '💫', '🪐', '☄️', '🌟', '🎵']

export default function TitleScreen() {
  const { joinRoom, connected } = useGame()
  const [mode, setMode] = useState(null) // null | 'create' | 'join'
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [selectedAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStart = () => {
    const trimmed = nickname.trim()
    if (!trimmed) { setError('닉네임을 입력해주세요!'); return }
    if (mode === 'join' && !roomCode.trim()) { setError('방 코드를 입력해주세요!'); return }
    setError('')
    setLoading(true)
    joinRoom(trimmed, mode === 'join' ? roomCode.toUpperCase() : null)
    setTimeout(() => setLoading(false), 3000)
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleStart() }

  return (
    <div className="title-screen">
      {/* Planet decoration */}
      <div className="planet planet-1" />
      <div className="planet planet-2" />
      <div className="planet planet-3" />
      <div className="orbit-ring" />

      <div className="title-content">
        {/* Logo */}
        <div className="logo-section animate-fadeInUp">
          <div className="logo-icon">🎵</div>
          <h1 className="logo-title">
            <span className="glow-cyan">SOUND</span>
            <br />
            <span className="glow-purple">CATCH</span>
          </h1>
          <p className="logo-subtitle">사운드 캐치 | 실시간 멀티플레이 퀴즈</p>
        </div>

        {/* Connection indicator */}
        <div className={`connection-dot ${connected ? 'online' : 'offline'}`}>
          <span className="dot" />
          {connected ? '서버 연결됨' : '연결 중...'}
        </div>

        {/* CTA buttons or form */}
        {!mode ? (
          <div className="cta-section animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            <button
              className="btn btn-primary btn-lg cta-btn"
              onClick={() => setMode('create')}
              disabled={!connected}
            >
              방 만들기
            </button>
            <button
              className="btn btn-secondary btn-lg cta-btn"
              onClick={() => setMode('join')}
              disabled={!connected}
            >
              방 참가하기
            </button>
          </div>
        ) : (
          <div className="entry-panel glass-panel animate-scaleIn">
            <div className="entry-header">
              <button className="back-btn" onClick={() => { setMode(null); setError('') }}>← 뒤로</button>
              <h2>{mode === 'create' ? '새 방 만들기' : '방 참가하기'}</h2>
            </div>

            <div className="avatar-row">
              <div className="avatar-preview">{selectedAvatar}</div>
              <p className="avatar-hint">내 아바타</p>
            </div>

            <div className="input-group">
              <label>닉네임</label>
              <input
                className="input"
                placeholder="우주 탐험가..."
                value={nickname}
                onChange={e => { setNickname(e.target.value); setError('') }}
                onKeyDown={handleKey}
                maxLength={16}
                autoFocus
              />
            </div>

            {mode === 'join' && (
              <div className="input-group">
                <label>방 코드 (4자리)</label>
                <input
                  className="input"
                  placeholder="예: A1B2"
                  value={roomCode}
                  onChange={e => { setRoomCode(e.target.value.toUpperCase()); setError('') }}
                  onKeyDown={handleKey}
                  maxLength={4}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.4rem' }}
                />
              </div>
            )}

            {error && <p className="entry-error">⚠️ {error}</p>}

            <button
              className="btn btn-primary btn-lg w-full"
              onClick={handleStart}
              disabled={loading || !connected}
            >
              {loading ? '⏳ 접속 중...' : mode === 'create' ? '방 생성' : '입장하기'}
            </button>
          </div>
        )}
        
      </div>
    </div>
  )
}
