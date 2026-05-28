import React, { useEffect, useRef, useState } from 'react'

const BAR_COUNT = 28

export default function WaveformVisualizer({ isPlaying }) {
  const [bars] = useState(() =>
    Array.from({ length: BAR_COUNT }, () => ({
      maxH: Math.random() * 42 + 8,
      duration: (Math.random() * 0.5 + 0.4).toFixed(2),
      delay: (Math.random() * 0.6).toFixed(2)
    }))
  )

  return (
    <div className="waveform" aria-label="오디오 재생 중">
      {bars.map((bar, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            '--max-h': `${bar.maxH}px`,
            '--duration': `${bar.duration}s`,
            '--delay': `${bar.delay}s`,
            animationPlayState: isPlaying ? 'running' : 'paused',
            height: isPlaying ? undefined : '4px',
            opacity: isPlaying ? undefined : 0.3,
            transition: 'height 0.3s, opacity 0.3s'
          }}
        />
      ))}
    </div>
  )
}
