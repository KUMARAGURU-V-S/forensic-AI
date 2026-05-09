import { useState, useRef, useEffect } from 'react'
import {
  Clock, Camera, Smartphone, Phone, MapPin, FlaskConical,
  Cpu, Heart, GitBranch, Map, BarChart3, Zap, ChevronDown,
  ZoomIn, ZoomOut,
} from 'lucide-react'

const LANES = [
  { id: 'autopsy',   label: 'Autopsy Findings', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: Heart },
  { id: 'cctv',      label: 'CCTV Events',       color: '#00d4ff', bg: 'rgba(0,212,255,0.1)',  icon: Camera },
  { id: 'phone',     label: 'Mobile Activity',   color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: Smartphone },
  { id: 'calls',     label: 'Call Logs',         color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: Phone },
  { id: 'location',  label: 'Location Data',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: MapPin },
  { id: 'biometric', label: 'Toxicology',        color: '#ec4899', bg: 'rgba(236,72,153,0.1)', icon: FlaskConical },
  { id: 'iot',       label: 'IoT / Sensors',     color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',  icon: Cpu },
]

// Map API event types to lane IDs
const TYPE_TO_LANE = {
  autopsy: 'autopsy', cctv: 'cctv', surveillance: 'cctv',
  phone: 'phone', mobile: 'phone', sms: 'phone',
  call: 'calls', communications: 'calls',
  location: 'location', geolocation: 'location',
  biometric: 'biometric', toxicology: 'biometric', pathology: 'autopsy',
  iot: 'iot', sensors: 'iot', wearable: 'iot',
}

const CANVAS_WIDTH = 1400
const LANE_H_BASE  = 110   // minimum lane height (1 row)
const ROW_H        = 110   // height per event row inside a lane
const EVENT_W      = 170   // assumed event card width for collision check
const HEADER_H     = 40
const LABEL_W      = 148

// Map event title substrings (lowercase) → thumbnail image path
const CCTV_THUMBS = [
  { match: 'vehicle arriving',   src: '/vid/vehiclecome.png'   },
  { match: 'entering building',  src: '/vid/come.png'          },
  { match: 'exiting building',   src: '/vid/go.png'            },
  { match: 'vehicle departing',  src: '/vid/vehicledepart.png' },
]

function getCctvThumb(title = '') {
  const lower = title.toLowerCase()
  const found = CCTV_THUMBS.find(t => lower.includes(t.match))
  return found ? found.src : null
}

function timeToX(ts, startMs, endMs) {
  const t = new Date(ts).getTime()
  return ((t - startMs) / (endMs - startMs)) * CANVAS_WIDTH
}

function formatAxisTime(ms) {
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function ForensicTimeline({ events = [], todTimestamp, onEventClick, activeSource }) {
  const [mode, setMode] = useState('timeline')
  const [zoom, setZoom] = useState(1)
  const [hoveredEvent, setHoveredEvent] = useState(null)
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 })
  const scrollRef = useRef(null)
  const svgRef = useRef(null)

  // Derive time range from events
  const timestamps = events.map(e => new Date(e.timestamp).getTime()).filter(Boolean)
  const startMs = timestamps.length ? Math.min(...timestamps) - 30 * 60000 : Date.now() - 6 * 3600000
  const endMs   = timestamps.length ? Math.max(...timestamps) + 30 * 60000 : Date.now()
  const rangeMs = endMs - startMs

  // Group events by lane AND compute staggered row offsets per lane
  const byLane = {}
  LANES.forEach(l => { byLane[l.id] = [] })
  events.forEach(ev => {
    const laneId = TYPE_TO_LANE[ev.type] || TYPE_TO_LANE[ev.category] || 'iot'
    if (byLane[laneId]) {
      if (!activeSource || activeSource === laneId || activeSource === ev.type)
        byLane[laneId].push(ev)
    }
  })

  /**
   * For each lane, assign a row index to every event using a greedy
   * interval-scheduling / shelf algorithm:
   * - Sort events by X position
   * - Keep track of the rightmost X used per row
   * - Place each event in the first row where it doesn't collide
   */
  const laneRows   = {}   // laneId → number of rows needed
  const eventRows  = {}   // ev._id → row index

  LANES.forEach(lane => {
    const laneEvs = byLane[lane.id]
    // Sort by timestamp
    const sorted = [...laneEvs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

    const rowTails = []  // rightmost X edge currently used per row

    sorted.forEach(ev => {
      const x = timeToX(ev.timestamp, startMs, endMs) * zoom
      const left = Math.max(2, x - 60)
      const right = left + EVENT_W

      // Find first row with no collision
      let placed = false
      for (let r = 0; r < rowTails.length; r++) {
        if (left > rowTails[r] + 4) {   // 4px gap between cards
          rowTails[r] = right
          eventRows[ev._id || `${lane.id}-${ev.timestamp}`] = r
          placed = true
          break
        }
      }
      if (!placed) {
        eventRows[ev._id || `${lane.id}-${ev.timestamp}`] = rowTails.length
        rowTails.push(right)
      }
    })

    laneRows[lane.id] = Math.max(1, rowTails.length)
  })

  // Compute the pixel height of each lane (at least LANE_H_BASE)
  const laneHeights = {}
  LANES.forEach(lane => {
    laneHeights[lane.id] = Math.max(LANE_H_BASE, laneRows[lane.id] * ROW_H)
  })

  const totalH = LANES.reduce((s, l) => s + laneHeights[l.id], 0)

  // Tick marks (hourly)
  const ticks = []
  let t = startMs
  while (t <= endMs) {
    ticks.push(t)
    t += 3600000 // 1 hour
  }

  const todX = todTimestamp ? timeToX(todTimestamp, startMs, endMs) * zoom : null

  // Correlation pairs (connect events close in time across lanes)
  const correlations = []
  const allPositioned = []
  let   laneOffsetY   = 0
  LANES.forEach((lane, li) => {
    byLane[lane.id].forEach(ev => {
      allPositioned.push({ ev, laneIdx: li, x: timeToX(ev.timestamp, startMs, endMs) * zoom, cy: laneOffsetY + laneHeights[lane.id] / 2 })
    })
    laneOffsetY += laneHeights[lane.id]
  })
  for (let i = 0; i < allPositioned.length; i++) {
    for (let j = i + 1; j < allPositioned.length; j++) {
      const a = allPositioned[i], b = allPositioned[j]
      if (Math.abs(a.x - b.x) < 60 && a.laneIdx !== b.laneIdx) {
        correlations.push({ x1: a.x, y1: a.cy, x2: b.x, y2: b.cy })
        if (correlations.length > 12) break
      }
    }
    if (correlations.length > 12) break
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(4,8,15,0.6)' }}>
      {/* ── Controls Bar ───────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,10,20,0.7)' }}>
        {/* Mode toggle */}
        <div className="flex items-center rounded-lg overflow-hidden"
          style={{ border: '1px solid rgba(0,212,255,0.15)', background: 'rgba(0,0,0,0.3)' }}>
          {[
            { id: 'timeline', label: 'Timeline', Icon: Clock },
            { id: 'graph',    label: 'Graph',    Icon: BarChart3 },
            { id: 'map',      label: 'Map',      Icon: Map },
          ].map(({ id, label, Icon }) => (
            <button key={id} id={`mode-${id}`} onClick={() => setMode(id)}
              className="flex items-center gap-1.5 px-3 h-7 text-[10px] font-semibold transition-colors"
              style={{
                background: mode === id ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: mode === id ? '#00d4ff' : '#475569',
                borderRight: id !== 'map' ? '1px solid rgba(0,212,255,0.08)' : 'none',
              }}>
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
            <ZoomOut size={13} />
          </button>
          <span className="text-[10px] font-mono text-slate-500 w-10 text-center">{(zoom * 100).toFixed(0)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
            <ZoomIn size={13} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Auto Correlate */}
          <button id="auto-correlate-btn"
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[10px] font-semibold transition-all"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.12)'}>
            <Zap size={11} />
            Auto Correlate
          </button>

          {/* View Options */}
          <button className="flex items-center gap-1 h-7 px-3 rounded-lg text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            View Options <ChevronDown size={10} />
          </button>
        </div>
      </div>

      {/* ── Timeline Body ──────────────────────────────────────────────── */}
      {mode === 'timeline' ? (
        /*
         * Single unified scroll container.
         * - overflow: auto  → scrolls both X (zoom) and Y (tall lanes)
         * - Lane labels: position:sticky left:0 so they stay visible while scrolling right
         * - Time axis:   position:sticky top:0  so it stays visible while scrolling down
         */
        <div
          ref={scrollRef}
          className="flex-1 min-w-0"
          style={{ overflow: 'auto', position: 'relative' }}
        >
          {/* Canvas — width drives horizontal scroll at any zoom level */}
          <div style={{
            width: Math.max(CANVAS_WIDTH * zoom + LABEL_W, 700),
            minHeight: totalH + HEADER_H,
            position: 'relative',
          }}>

            {/* ── Sticky time-axis header (top row) ── */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 30,
              display: 'flex',
              height: HEADER_H,
              background: 'rgba(4,8,15,0.97)',
              borderBottom: '1px solid rgba(0,212,255,0.1)',
            }}>
              {/* Corner cell that lines up with lane-label column */}
              <div style={{
                width: LABEL_W, flexShrink: 0,
                position: 'sticky', left: 0, zIndex: 31,
                background: 'rgba(4,8,15,0.97)',
                borderRight: '1px solid rgba(0,212,255,0.06)',
              }} />
              {/* Tick marks — positioned relative to the canvas area (offset by LABEL_W) */}
              <div style={{ flex: 1, position: 'relative' }}>
                {ticks.map((tick, i) => {
                  const x = ((tick - startMs) / rangeMs) * CANVAS_WIDTH * zoom
                  return (
                    <div key={i} className="absolute bottom-0 flex flex-col items-center" style={{ left: x }}>
                      <span className="text-[8px] font-mono text-slate-600 mb-1 whitespace-nowrap">
                        {formatAxisTime(tick)}
                      </span>
                      <div className="w-px h-2" style={{ background: 'rgba(0,212,255,0.2)' }} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Lane rows (label sticky-left + events area) ── */}
            {LANES.map((lane) => {
              const h = laneHeights[lane.id]
              const Icon = lane.icon
              return (
                <div key={lane.id} style={{
                  display: 'flex', position: 'relative',
                  height: h, borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>

                  {/* ── Sticky lane label ── */}
                  <div style={{
                    position: 'sticky', left: 0, zIndex: 20,
                    width: LABEL_W, flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0 12px',
                    background: 'rgba(4,8,15,0.97)',
                    borderRight: '1px solid rgba(0,212,255,0.06)',
                  }}>
                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: lane.bg }}>
                      <Icon size={11} style={{ color: lane.color }} />
                    </div>
                    <span className="text-[10px] font-medium leading-tight" style={{ color: lane.color }}>
                      {lane.label}
                    </span>
                  </div>

                  {/* ── Events canvas area ── */}
                  <div style={{
                    flex: 1, position: 'relative',
                    width: CANVAS_WIDTH * zoom,
                    height: h,
                  }}>
                    {/* Faint vertical grid lines */}
                    {ticks.map((tick, ti) => (
                      <div key={ti} className="absolute top-0 bottom-0 w-px"
                        style={{ left: ((tick - startMs) / rangeMs) * CANVAS_WIDTH * zoom, background: 'rgba(255,255,255,0.02)' }} />
                    ))}

                    {/* Events — staggered rows, no overlap */}
                    {byLane[lane.id].map((ev, ei) => {
                      const x     = timeToX(ev.timestamp, startMs, endMs) * zoom
                      const evKey = ev._id || `${lane.id}-${ev.timestamp}`
                      const row   = eventRows[evKey] ?? 0
                      const rows  = laneRows[lane.id]

                      const rowH  = h / rows
                      const topPx = row * rowH + rowH * 0.12
                      const cardH = rowH * 0.76

                      const conf       = Math.round((ev.confidence || 0.9) * 100)
                      const isCritical = ev.severity === 'critical' || ev.severity === 'high'
                      const label      = ev.title?.length > 22 ? ev.title.slice(0, 20) + '…' : ev.title

                      const thumb = lane.id === 'cctv' ? getCctvThumb(ev.title) : null
                      const hasThumb = Boolean(thumb)

                      return (
                        <div
                          key={ei}
                          className="tl-event absolute flex flex-col"
                          id={`tl-event-${lane.id}-${ei}`}
                          style={{
                            left:    Math.max(2, x - 70),
                            top:     topPx,
                            height:  cardH,
                            width:   hasThumb ? 160 : undefined,
                            minWidth: hasThumb ? 160 : 120,
                            maxWidth: hasThumb ? 160 : 190,
                            background: lane.bg,
                            border: `1px solid ${lane.color}${isCritical ? '' : '66'}`,
                            boxShadow: isCritical ? `0 0 10px ${lane.color}33` : 'none',
                            overflow: 'hidden',
                          }}
                          onClick={() => onEventClick?.(ev)}
                          onMouseEnter={(e) => {
                            setHoveredEvent(ev)
                            const r = e.currentTarget.getBoundingClientRect()
                            setHoveredPos({ x: r.left, y: r.top })
                          }}
                          onMouseLeave={() => setHoveredEvent(null)}
                        >
                          {hasThumb ? (
                            <>
                              {/* ── Image fills top portion ── */}
                              <div style={{ flex: '0 0 68px', position: 'relative', overflow: 'hidden' }}>
                                <img
                                  src={thumb}
                                  alt={ev.title}
                                  style={{
                                    width: '100%', height: '100%',
                                    objectFit: 'cover',
                                    filter: 'brightness(0.92) saturate(0.88)',
                                    display: 'block',
                                  }}
                                />
                                {/* Cyan glow overlay at bottom edge */}
                                <div style={{
                                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 18,
                                  background: `linear-gradient(to top, ${lane.color}22, transparent)`,
                                }} />
                                <Camera size={8} style={{
                                  position: 'absolute', bottom: 3, left: 4,
                                  color: lane.color, opacity: 0.9,
                                }} />
                              </div>
                              {/* ── Text info below image ── */}
                              <div style={{ flex: 1, padding: '3px 5px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
                                <div style={{ fontSize: 9, fontFamily: 'monospace', color: lane.color, opacity: 0.85, marginBottom: 1 }}>
                                  {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false })}
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.25, wordBreak: 'break-word' }}>
                                  {ev.title}
                                </div>
                                <div style={{ marginTop: 3, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                                  <div style={{ height: '100%', borderRadius: 2, width: `${conf}%`, background: lane.color }} />
                                </div>
                              </div>
                            </>
                          ) : (
                            /* ── Normal (no thumb) layout ── */
                            <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                              <div style={{ fontSize: 9, fontFamily: 'monospace', color: lane.color, opacity: 0.7, marginBottom: 2 }}>
                                {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false })}
                              </div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {label}
                              </div>
                              <div style={{ marginTop: 4, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                                <div style={{ height: '100%', borderRadius: 2, width: `${conf}%`, background: lane.color }} />
                              </div>
                              {lane.id === 'cctv' && (
                                <div style={{ position: 'absolute', top: 3, right: 4 }}>
                                  <Camera size={8} style={{ color: lane.color, opacity: 0.5 }} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Empty lane placeholder */}
                    {byLane[lane.id].length === 0 && (
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-700">
                        No events in this category
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* ── Full-height SVG correlation overlay ── */}
            <svg
              ref={svgRef}
              className="absolute pointer-events-none"
              style={{
                top: HEADER_H, left: LABEL_W, zIndex: 10,
                width: CANVAS_WIDTH * zoom, height: totalH,
                overflow: 'visible',
              }}
            >
              {correlations.map((c, i) => {
                const mx = (c.x1 + c.x2) / 2
                return (
                  <path key={i}
                    d={`M ${c.x1} ${c.y1} C ${mx} ${c.y1} ${mx} ${c.y2} ${c.x2} ${c.y2}`}
                    stroke="rgba(0,212,255,0.15)" strokeWidth="1"
                    strokeDasharray="4 3" fill="none"
                    className="dash-animated"
                  />
                )
              })}
              {/* TOD vertical marker */}
              {todX && todX > 0 && todX < CANVAS_WIDTH * zoom && (
                <>
                  <line x1={todX} y1={0} x2={todX} y2={totalH}
                    stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8" />
                  <rect x={todX - 60} y={4} width={120} height={18} rx="3"
                    fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.4)" strokeWidth="1" />
                  <text x={todX} y={17} textAnchor="middle" fontSize="8" fill="#f87171" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                    ⚠ ESTIMATED TOD
                  </text>
                </>
              )}
            </svg>
          </div>
        </div>
      ) : mode === 'graph' ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <GitBranch size={32} className="mx-auto mb-3 text-slate-600" />
            <p className="text-sm text-slate-500">Graph view — navigate to <span style={{ color: '#00d4ff' }}>Graph Analysis</span> for full graph</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Map size={32} className="mx-auto mb-3 text-slate-600" />
            <p className="text-sm text-slate-500">Map view — geolocation data plotted</p>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredEvent && (
        <div className="fixed pointer-events-none z-50 tooltip"
          style={{ left: hoveredPos.x + 10, top: hoveredPos.y - 40 }}>
          <div className="text-[10px] font-semibold text-slate-100 mb-0.5">{hoveredEvent.title}</div>
          <div className="text-[9px] text-slate-400">{new Date(hoveredEvent.timestamp).toLocaleString()}</div>
          {hoveredEvent.description && (
            <div className="text-[9px] text-slate-500 mt-0.5 max-w-[200px]">{hoveredEvent.description}</div>
          )}
        </div>
      )}
    </div>
  )
}
