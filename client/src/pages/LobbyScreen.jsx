// client/src/pages/LobbyScreen.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useGame } from '../utils/GameContext'
import { getAvatar } from '../utils/avatars'
import './LobbyScreen.css'

export default function LobbyScreen() {
  const { state, startGame, backToTitle, sendChat, toggleReady, transferHost, kickPlayer, updateSettings } = useGame()
  const {
    roomCode, players, hostId, myId, nickname,
    availableCategories, chatMessages, maxPlayers,
    targetScore: ctxTargetScore, roundCount: ctxRoundCount, selectedCategories: ctxCats,
    roundTime: ctxRoundTime
  } = state

  // ── 설정 (방장이 모달에서 조정) ──
  const [targetScore, setTargetScore] = useState(ctxTargetScore || 20)
  const [roundCount, setRoundCount]   = useState(ctxRoundCount || 10)
  const TARGET_OPTIONS = [10, 20, 30, 40, 50]
  // 라운드당 1등 3점이 최대이므로, 라운드 수 × 3 을 넘는 목표는 도달 불가 → 선택 차단
  const maxReachable = roundCount * 3
  // 라운드 수가 바뀌어 현재 목표가 도달 불가가 되면, 선택 가능한 최댓값으로 낮춘다.
  const chooseRounds = (r) => {
    setRoundCount(r)
    if (targetScore > r * 3) {
      const valid = TARGET_OPTIONS.filter(s => s <= r * 3)
      setTargetScore(valid.length ? valid[valid.length - 1] : TARGET_OPTIONS[0])
    }
  }
  const [selectedCats, setSelectedCats] = useState(ctxCats || [])
  const [roundTimeSel, setRoundTimeSel] = useState(ctxRoundTime || 15) // ★ 라운드당 시간(초)
  const ROUND_TIME_OPTIONS = [10, 15, 20, 30, 45]
  const [maxPlayersInput, setMaxPlayersInput] = useState(maxPlayers || 5) // ★ 설정에서 최대 인원 조절
  const [showSettings, setShowSettings] = useState(false)
  const [showCatPop, setShowCatPop] = useState(false)   // ★ 주제 팝오버(hover/tap)
  const [catPopPos, setCatPopPos] = useState({ top: 0, left: 0 })
  const catPopTimer = useRef(null)
  const catChipRef = useRef(null)

  // 팝오버를 트리거 칩 위치 기준으로 fixed 로 띄운다(부모 overflow/쌓임에 안 가리게).
  const openCatPop = (autoHide) => {
    const el = catChipRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      setCatPopPos({ top: r.bottom + 8, left: r.left + r.width / 2 })
    }
    setShowCatPop(true)
    clearTimeout(catPopTimer.current)
    if (autoHide) catPopTimer.current = setTimeout(() => setShowCatPop(false), 2800)
  }

  // 설정창을 열 때 현재 방 값 반영 (다른 값으로 갱신됐을 수 있으므로)
  useEffect(() => {
    if (showSettings) {
      setMaxPlayersInput(maxPlayers || 5)
      setRoundTimeSel(ctxRoundTime || 15)
    }
  }, [showSettings, maxPlayers, ctxRoundTime])

  const [copied, setCopied]   = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [starting, setStarting] = useState(false)

  // ── 방장 관리 모달 (방장 넘기기 / 강퇴) ──
  const [showManage, setShowManage] = useState(false)
  // 확인 모달: { type: 'transfer' | 'kick', player }
  const [confirmAction, setConfirmAction] = useState(null)

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

  // ★ 공유 링크 복사: ?room=코드 형태. 링크로 접속하면 참가 모드로 코드 자동 입력됨
  const shareLink = `${window.location.origin}${window.location.pathname}?room=${roomCode}`
  const copyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomCode}&openExternalBrowser=1`
    navigator.clipboard?.writeText(link)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  // ★ 준비 현황: 방장 외 모든 플레이어가 준비되어야 시작 가능
  const others = players.filter(p => p.id !== hostId)
  const allReady = others.length === 0 || others.every(p => p.isReady)
  const iAmReady = !!me?.isReady

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    await startGame({ targetScore, roundCount, roundTime: roundTimeSel, categories: selectedCats })
    setStarting(false)
  }

  // 설정창 닫을 때 서버에 현재 설정을 알려 다른 유저도 보이게 함
  const closeSettings = () => {
    updateSettings({ targetScore, roundCount, roundTime: roundTimeSel, categories: selectedCats, maxPlayers: maxPlayersInput })
    setShowSettings(false)
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

  // 방장 관리: 확인 모달에서 '확인' 누르면 실제 실행
  const runConfirm = () => {
    if (!confirmAction) return
    if (confirmAction.type === 'transfer') transferHost(confirmAction.player.id)
    else if (confirmAction.type === 'kick') kickPlayer(confirmAction.player.id)
    setConfirmAction(null)
    setShowManage(false)
  }

  const catSummary = selectedCats.length === 0
    ? '전체 주제'
    : `${selectedCats.length}개 주제`

  return (
    <div className="lobby-screen">
      <div className="lobby-container">

        {/* Header */}
        <div className="lobby-header animate-fadeInUp">
          <button className="back-btn-sm" onClick={backToTitle}>← 나가기</button>
          <div className="room-code-display" style={{ textAlign: 'center' }}>
            <span className="room-code-label">방 코드</span>
            <div className="room-code-value" style={{ justifyContent: 'center' }}>
              <span className="glow-cyan" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.2em' }}>
                {roomCode}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
              <button className="copy-btn" style={{ fontSize: '0.75rem', padding: '5px 12px' }} onClick={copyCode}>
                {copied ? '복사됨' : '복사'}
              </button>
              <button className="copy-btn" style={{ fontSize: '0.75rem', padding: '5px 12px' }} onClick={copyLink} title="공유 링크 복사">
                {linkCopied ? '복사됨' : '🔗'}
              </button>
            </div>
            <p className="room-code-hint">코드 또는 링크를 친구에게 공유하세요</p>
          </div>
        </div>

        <div className="lobby-body">
          {/* ★ 게임 정보 요약 (박스 없이) + 설정 버튼. 방 상태(ctx) 기준이라 전원에게 동일하게 보임 */}
          <div className="setting-info animate-fadeInUp" style={{ justifyContent: 'center', animationDelay: '0.05s' }}>
            <div className="info-chip">목표 {ctxTargetScore || targetScore}점</div>
            <div className="info-chip">{ctxRoundCount || roundCount}라운드</div>
            <div className="info-chip">라운드당 {ctxRoundTime || 15}초</div>

            {/* 주제 칩 + 팝오버 (전원 표시): 데스크톱 hover / 모바일 tap 시 선택된 주제 목록 표시 */}
            <div
              ref={catChipRef}
              onMouseEnter={() => openCatPop(false)}
              onMouseLeave={() => setShowCatPop(false)}
              onClick={() => openCatPop(true)}
            >
              <div className="info-chip" style={{ cursor: 'pointer' }}>
                🎵 {(ctxCats && ctxCats.length) ? `${ctxCats.length}개 주제` : '전체 주제'}
              </div>
              {showCatPop && (
                <div style={{
                  position: 'fixed', top: catPopPos.top, left: catPopPos.left, transform: 'translateX(-50%)',
                  zIndex: 9999, width: 'max-content', maxWidth: 'min(280px, 90vw)',
                  background: 'rgba(10,12,24,0.98)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.55)'
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                    선택된 주제
                  </div>
                  {(!ctxCats || ctxCats.length === 0) ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      전체 주제에서 출제됩니다
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
                      {ctxCats.map(c => (
                        <span key={c} style={{
                          fontSize: '0.76rem', padding: '3px 8px', borderRadius: 999,
                          background: 'rgba(124,58,237,0.22)', border: '1px solid rgba(124,58,237,0.5)',
                          color: 'var(--text-primary)', whiteSpace: 'nowrap'
                        }}>{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {currentIsHost && (
            <div className="animate-fadeInUp" style={{ display: 'flex', gap: 10, animationDelay: '0.08s' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowSettings(true)}
              >
                설정
              </button>
              {players.length > 1 && (
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowManage(true)}
                >
                  플레이어 관리
                </button>
              )}
            </div>
          )}

          {/* Players list */}
          <div className="glass-panel players-panel animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
            <div className="panel-title">
              <span>플레이어 ({players.length}/{maxPlayers || 5})</span>
              <div className="players-count-bar">
                {Array.from({ length: maxPlayers || 5 }).map((_, i) => (
                  <div key={i} className={`count-pip ${i < players.length ? 'filled' : ''}`} />
                ))}
              </div>
            </div>

            <div className="players-list">
              {players.map((p, i) => (
                <div
                  key={p.id}
                  className={`player-row ${p.id === myId || p.nickname === nickname ? 'me' : ''} animate-fadeInUp`}
                  style={{ animationDelay: `${i * 0.08}s`, opacity: p.disconnected ? 0.55 : 1 }}
                >
                  <div className="player-avatar-sm">{p.avatar || getAvatar(p.id)}</div>
                  <div className="player-info">
                    <span className="player-name">
                      {p.nickname}
                      {(p.id === myId || p.nickname === nickname) && <span className="me-tag">나</span>}
                    </span>
                    {p.id === hostId && <span className="host-tag">방장</span>}
                  </div>

                  {/* 준비 상태 표시 (연결 끊김이면 '대기중') */}
                  <div className={`ready-indicator ${p.disconnected ? 'waiting' : (p.id === hostId ? 'host' : (p.isReady ? 'host' : 'waiting'))}`}>
                    {p.disconnected ? '대기중' : (p.id === hostId ? '방장' : (p.isReady ? '준비완료' : '대기 중'))}
                  </div>
                </div>
              ))}

              {players.length < 8 && Array.from({ length: Math.min(2, 8 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="player-row empty">
                  <div className="player-avatar-sm empty-avatar">+</div>
                  <span className="empty-label">친구를 기다리는 중</span>
                </div>
              ))}
            </div>
          </div>

          {/* ★ 채팅 패널 (기존 설정란 자리) */}
          <div className="glass-panel animate-fadeInUp" style={{ animationDelay: '0.2s', display: 'flex', flexDirection: 'column', minHeight: 0, padding: 24 }}>
            <div className="panel-title"><span>채팅</span></div>

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
                  아직 메시지가 없어요. 첫 인사를 건네보세요
                </p>
              )}
              {chatMessages.map(m => {
                // ★ 방 알림(입장/퇴장/방장 위임/설정 변경/강퇴) — 가운데 흐린 텍스트
                if (m.system) {
                  return (
                    <div key={m.id} style={{ alignSelf: 'center', maxWidth: '90%', margin: '2px 0' }}>
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.74rem',
                        color: 'var(--text-dim)',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '4px 12px',
                        borderRadius: 999,
                        textAlign: 'center'
                      }}>
                        {m.text}
                      </span>
                    </div>
                  )
                }
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
                        {(players.find(pp=>pp.id===m.playerId)?.avatar) || getAvatar(m.playerId)} {m.nickname}
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

          {/* Action controls */}
          {currentIsHost ? (
            <div className="animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '0.3s' }}>
              {!allReady && (
                <p style={{ textAlign: 'center', color: 'var(--warn, #f59e0b)', fontSize: '0.82rem', margin: 0 }}>
                  모든 플레이어가 준비완료해야 시작할 수 있어요
                </p>
              )}
              <button
                className={`btn btn-primary btn-lg start-btn ${starting ? 'starting' : ''}`}
                onClick={handleStart}
                disabled={starting || players.length < 1 || !allReady}
              >
                {starting ? '게임 시작 중...' : '게임 시작'}
              </button>
              <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem', margin: '2px 0 0' }}>
                {players.length}명 참가 중
              </p>
            </div>
          ) : (
            <div className="animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: 12, animationDelay: '0.3s' }}>
              <button
                className={`btn btn-lg ${iAmReady ? 'btn-secondary' : 'btn-primary'}`}
                onClick={toggleReady}
              >
                {iAmReady ? '준비 취소' : '준비완료'}
              </button>
              <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem', margin: '2px 0 0' }}>
                {iAmReady ? '다시 누르면 준비가 취소됩니다' : '준비되면 위 버튼을 눌러주세요'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ★ 설정 모달 (방장 전용) */}
      {showSettings && currentIsHost && (
        <div
          onClick={closeSettings}
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
              <span>게임 설정</span>
              <button className="copy-btn" onClick={closeSettings}>닫기</button>
            </div>

            {/* 목표 점수 */}
            <div className="setting-row" style={{ marginBottom: 20 }}>
              <label>목표 점수 (먼저 달성하면 승리!)</label>
              <div className="score-selector">
                {TARGET_OPTIONS.map(s => {
                  const reachable = s <= maxReachable
                  return (
                    <button
                      key={s}
                      className={`score-option ${targetScore === s ? 'active' : ''}`}
                      onClick={() => reachable && setTargetScore(s)}
                      disabled={!reachable}
                      title={reachable ? '' : `라운드 ${roundCount}개로는 도달 불가 (최대 ${maxReachable}점)`}
                      style={!reachable ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.74rem', marginTop: 6 }}>
                * 1등 3점 / 2등 2점 / 3등 이하 1점. 목표는 라운드 수 × 3(현재 최대 {maxReachable}점)까지만 선택 가능.
              </p>
            </div>

            {/* 라운드 수 */}
            <div className="setting-row" style={{ marginBottom: 20 }}>
              <label>라운드 수</label>
              <div className="score-selector">
                {[5, 7, 10, 15, 20].map(r => (
                  <button
                    key={r}
                    className={`score-option ${roundCount === r ? 'active' : ''}`}
                    onClick={() => chooseRounds(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 라운드 시간(초) */}
            <div className="setting-row" style={{ marginBottom: 20 }}>
              <label>라운드 시간 (정답 입력 제한, 초)</label>
              <div className="score-selector">
                {ROUND_TIME_OPTIONS.map(t => (
                  <button
                    key={t}
                    className={`score-option ${roundTimeSel === t ? 'active' : ''}`}
                    onClick={() => setRoundTimeSel(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 최대 인원 (현재 인원수보다 낮게는 못 내림) */}
            <div className="setting-row" style={{ marginBottom: 20 }}>
              <label>최대 인원 ({maxPlayersInput}명)</label>
              <input
                type="range"
                min={Math.max(5, players.length)}
                max={15}
                step={1}
                value={Math.max(maxPlayersInput, Math.max(5, players.length))}
                onChange={e => setMaxPlayersInput(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--purple-core, #7c3aed)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span>{Math.max(5, players.length)}명</span><span>15명</span>
              </div>
              {players.length > 5 && (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.74rem', marginTop: 6 }}>
                  * 현재 인원({players.length}명)보다 적게는 설정할 수 없습니다.
                </p>
              )}
            </div>

            {/* 주제 선택 — 세로 스택 + 스크롤 체크리스트 */}
            <div className="setting-row" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ margin: 0 }}>출제 주제</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{catSummary}</span>
                  <button className="copy-btn" onClick={() => setSelectedCats([])}>전체 해제</button>
                  <button className="copy-btn" onClick={() => setSelectedCats(availableCategories)}>전체 선택</button>
                </div>
              </div>

              <div style={{
                maxHeight: 260,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: 6,
                borderRadius: 'var(--radius-lg, 12px)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}>
                {availableCategories.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
                    주제 목록을 불러오는 중...
                  </p>
                ) : (
                  availableCategories.map(cat => {
                    const on = selectedCats.includes(cat)
                    return (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 10,
                          cursor: 'pointer',
                          fontSize: '0.92rem',
                          color: 'var(--text-primary)',
                          background: on ? 'rgba(124,58,237,0.22)' : 'transparent',
                          border: on
                            ? '1px solid rgba(124,58,237,0.6)'
                            : '1px solid rgba(255,255,255,0.08)',
                          transition: 'background 0.15s, border 0.15s'
                        }}
                      >
                        <span style={{
                          flexShrink: 0,
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          color: '#fff',
                          background: on
                            ? 'linear-gradient(135deg, var(--purple-core), var(--cyan-core))'
                            : 'rgba(255,255,255,0.06)',
                          border: on ? 'none' : '1px solid rgba(255,255,255,0.18)'
                        }}>
                          {on ? '✓' : ''}
                        </span>
                        <span>{cat}</span>
                      </button>
                    )
                  })
                )}
              </div>

              <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: 10 }}>
                * 아무것도 선택하지 않으면 전체 주제에서 출제됩니다.
              </p>
            </div>

            <button
              className="btn btn-primary btn-lg w-full"
              onClick={closeSettings}
              style={{ marginTop: 16 }}
            >
              설정 완료
            </button>
          </div>
        </div>
      )}

      {/* ★ 방장 관리 모달 — 방장 넘기기 / 강퇴 */}
      {showManage && currentIsHost && (
        <div
          onClick={() => setShowManage(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(4,5,15,0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <div
            className="glass-panel animate-scaleIn"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 460, maxHeight: '80vh', overflowY: 'auto', padding: 24 }}
          >
            <div className="panel-title" style={{ marginBottom: 16 }}>
              <span>플레이어 관리</span>
              <button className="copy-btn" onClick={() => setShowManage(false)}>닫기</button>
            </div>

            <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', margin: '0 0 14px' }}>
              방장을 넘기거나 플레이어를 내보낼 수 있습니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {players.filter(p => p.id !== hostId).length === 0 && (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
                  관리할 다른 플레이어가 없습니다.
                </p>
              )}
              {players.filter(p => p.id !== hostId).map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <div className="player-avatar-sm">{p.avatar || getAvatar(p.id)}</div>
                  <span style={{ flex: 1, fontSize: '0.92rem' }}>
                    {p.nickname}
                    {p.disconnected && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-dim)' }}>(대기중)</span>}
                  </span>
                  <button
                    className="copy-btn"
                    onClick={() => setConfirmAction({ type: 'transfer', player: p })}
                  >
                    방장 넘기기
                  </button>
                  <button
                    className="copy-btn"
                    style={{ color: '#fca5a5', borderColor: 'rgba(248,113,113,0.4)' }}
                    onClick={() => setConfirmAction({ type: 'kick', player: p })}
                  >
                    강퇴
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ★ 확인 모달 — 방장 넘기기 / 강퇴 공통 (window.confirm 대체) */}
      {confirmAction && (
        <div
          onClick={() => setConfirmAction(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(4,5,15,0.78)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
        >
          <div
            className="glass-panel animate-scaleIn"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 360, padding: 24, textAlign: 'center' }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '1.1rem' }}>
              {confirmAction.type === 'transfer' ? '방장 넘기기' : '플레이어 강퇴'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 20px', lineHeight: 1.5 }}>
              {confirmAction.type === 'transfer'
                ? <><b>{confirmAction.player.nickname}</b>님에게 방장을 넘기시겠어요?</>
                : <><b>{confirmAction.player.nickname}</b>님을 방에서 내보내시겠어요?</>}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setConfirmAction(null)}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, ...(confirmAction.type === 'kick' ? { background: 'linear-gradient(135deg,#ef4444,#f87171)' } : {}) }}
                onClick={runConfirm}
              >
                {confirmAction.type === 'transfer' ? '넘기기' : '강퇴'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
