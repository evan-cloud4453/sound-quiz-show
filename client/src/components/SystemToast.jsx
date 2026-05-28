import React from 'react'
import { useGame } from '../utils/GameContext'
import './SystemToast.css'

export default function SystemToast() {
  const { state } = useGame()
  const { systemMsg } = state

  if (!systemMsg) return null

  return (
    <div className="system-toast animate-fadeInUp">
      <span className="toast-icon">📢</span>
      <span>{systemMsg}</span>
    </div>
  )
}
