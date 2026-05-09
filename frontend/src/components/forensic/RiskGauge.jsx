import { useEffect, useRef } from 'react'

/**
 * Animated circular SVG risk gauge.
 * score: 0–100, color: CSS color string
 */
export default function RiskGauge({ score = 0, color = '#ef4444', size = 160 }) {
  const R = (size / 2) - 14
  // 270° arc (from 135° to 405°, i.e. bottom-left to bottom-right)
  const ARC = 2 * Math.PI * R * 0.75
  const offset = ARC - (score / 100) * ARC
  const cx = size / 2
  const cy = size / 2
  // Start angle: 135° → 225° offset from right (3π/4)
  const startA = (135 * Math.PI) / 180
  const x1 = cx + R * Math.cos(startA)
  const y1 = cy + R * Math.sin(startA)

  const fillRef = useRef(null)

  useEffect(() => {
    // Animate on mount
    if (!fillRef.current) return
    fillRef.current.style.strokeDashoffset = ARC
    const t = setTimeout(() => {
      if (fillRef.current) fillRef.current.style.strokeDashoffset = offset
    }, 100)
    return () => clearTimeout(t)
  }, [score, ARC, offset])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id={`gauge-grad-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
        <filter id="gauge-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="8"
        strokeDasharray={`${ARC} ${2 * Math.PI * R}`}
        strokeDashoffset={-(2 * Math.PI * R * 0.125)}
        strokeLinecap="round"
        transform={`rotate(135 ${cx} ${cy})`}
      />
      {/* Fill */}
      <circle
        ref={fillRef}
        cx={cx} cy={cy} r={R}
        fill="none"
        stroke={`url(#gauge-grad-${score})`}
        strokeWidth="8"
        strokeDasharray={`${ARC} ${2 * Math.PI * R}`}
        strokeDashoffset={ARC}
        strokeLinecap="round"
        transform={`rotate(135 ${cx} ${cy})`}
        filter="url(#gauge-glow)"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#e2e8f0"
        fontSize={size * 0.22} fontWeight="900" fontFamily="Inter, sans-serif">
        {score}
      </text>
      <text x={cx} y={cy + size * 0.15} textAnchor="middle"
        fill="rgba(148,163,184,0.8)" fontSize={size * 0.07} fontFamily="Inter, sans-serif">
        /100
      </text>
    </svg>
  )
}
