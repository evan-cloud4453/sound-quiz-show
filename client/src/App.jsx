import React from 'react'
import { GameProvider, useGame } from './utils/GameContext'
import TitleScreen from './pages/TitleScreen'
import LobbyScreen from './pages/LobbyScreen'
import GameScreen from './pages/GameScreen'
import GameOverScreen from './pages/GameOverScreen'
import SystemToast from './components/SystemToast'

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
