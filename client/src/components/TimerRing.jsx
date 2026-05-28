import React, { useEffect, useState, useRef } from 'react'

const SIZE = 100
const STROKE = 8
const R = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R

export default function TimerRing({ timeLimit = 15, active, onExpire }) {
  const [remaining, setRemaining] = useState(timeLimit)
  const intervalRef = useRef(null)

  useEffect(() => {
    setRemaining(timeLimit)
  }, [timeLimit, active])

  useEffect(() => {
    if (!active) {
      clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          onExpire?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [active, onExpire])

  const progress = remaining / timeLimit
  const dashOffset = CIRCUMFERENCE * (1 - progress)

  const color = progress > 0.5
    ? 'var(--cyan-glow)'
    : progress > 0.25
      ? 'var(--gold-glow)'
      : '#f87171'

  return (
    <div className="timer-wrap" style={{ position: 'relative', width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="timer-ring">
        <circle
          className="timer-ring-bg"
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          strokeWidth={STROKE}
        />
        <circle
          className="timer-ring-progress"
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          strokeWidth={STROKE}
          stroke={color}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.6rem',
          fontWeight: 700,
          color,
          lineHeight: 1,
          textShadow: `0 0 10px ${color}`
        }}>
          {remaining}
        </span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>SEC</span>
      </div>
    </div>
  )
}
