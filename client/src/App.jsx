import React from 'react'
import { GameProvider, useGame } from './utils/GameContext'
import TitleScreen from './pages/TitleScreen'
import LobbyScreen from './pages/LobbyScreen'
import GameScreen from './pages/GameScreen'
import GameOverScreen from './pages/GameOverScreen'
import SystemToast from './components/SystemToast'
import Copyright from './components/Copyright'

// ★ 서버 연결 끊김 / 세션 종료 오버레이
function ConnectionLostOverlay() {
  const { state, goMain } = useGame()
  if (!state.connectionLost) return null
  const removed = state.connectionLost.removed

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100001,
      background: 'rgba(4,5,15,0.92)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24
    }}>
      <div style={{ fontSize: '3rem' }}>{removed ? '🔌' : '📡'}</div>
      <h2 style={{ color: '#e2e8f0', textAlign: 'center', margin: 0, wordBreak: 'keep-all' }}>
        서버와 연결이 끊겼습니다
      </h2>
      <p style={{ color: '#94a3b8', fontSize: '0.95rem', textAlign: 'center', margin: 0, maxWidth: 360, lineHeight: 1.6 }}>
        {removed
          ? '연결이 오래 끊겨 방에서 나가졌습니다. 메인 화면에서 다시 입장해주세요.'
          : '재연결을 시도하고 있습니다. 잠시만 기다려주세요.'}
      </p>
      <button
        className="btn btn-primary btn-lg"
        onClick={goMain}
        style={{ marginTop: 4 }}
      >
        메인으로 돌아가기
      </button>
    </div>
  )
}

function Router() {
  const { state } = useGame()

  return (
    <>
      {/* Background layers (always visible) */}
      <div className="stars-bg" />
      <div className="nebula" />

      {/* Screen routing */}
      {state.screen === 'title'    && <TitleScreen />}
      {state.screen === 'lobby'    && <LobbyScreen />}
      {state.screen === 'game'     && <GameScreen />}
      {state.screen === 'gameover' && <GameOverScreen />}

      {/* Global toast */}
      <SystemToast />

      {/* ★ 연결 끊김 오버레이 (최상단) */}
      <ConnectionLostOverlay />

      {/* 저작권 표시 (PC 우하단 / 모바일 하단 중앙) */}
      <Copyright />
    </>
  )
}

export default function App() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  )
}
