import React, { useEffect, useState } from 'react'

const COLORS = ['#7c3aed','#06b6d4','#ec4899','#f59e0b','#10b981','#a855f7','#67e8f9','#fcd34d']

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

export default function Confetti({ active }) {
  const [pieces, setPieces] = useState([])

  useEffect(() => {
    if (!active) { setPieces([]); return }

    const newPieces = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: `${randomBetween(0, 100)}%`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: randomBetween(6, 14),
      duration: randomBetween(2.5, 4.5),
      delay: randomBetween(0, 1.5),
      rotation: randomBetween(0, 360),
      shape: Math.random() > 0.5 ? '50%' : '2px'
    }))
    setPieces(newPieces)

    const t = setTimeout(() => setPieces([]), 5000)
    return () => clearTimeout(t)
  }, [active])

  if (!pieces.length) return null

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.shape,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            boxShadow: `0 0 6px ${p.color}`
          }}
        />
      ))}
    </div>
  )
}
