import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Network, Zap, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { useForensicStore } from '../lib/store'

// ── Node type config ───────────────────────────────────────────────────────
const NODE_CFG = {
  victim:    { color: '#ef4444', glow: '#ef444466', ring: '#ef444422', size: 26 },
  suspect:   { color: '#f97316', glow: '#f9731666', ring: '#f9731622', size: 22 },
  device:    { color: '#00d4ff', glow: '#00d4ff55', ring: '#00d4ff18', size: 17 },
  camera:    { color: '#10b981', glow: '#10b98155', ring: '#10b98118', size: 17 },
  substance: { color: '#a855f7', glow: '#a855f755', ring: '#a855f718', size: 16 },
  location:  { color: '#ec4899', glow: '#ec489955', ring: '#ec489918', size: 18 },
  anomaly:   { color: '#f59e0b', glow: '#f59e0b55', ring: '#f59e0b18', size: 15 },
  default:   { color: '#64748b', glow: '#64748b44', ring: '#64748b14', size: 14 },
}

function cfg(node) {
  return NODE_CFG[node.category] || NODE_CFG[node.type] || NODE_CFG.default
}

// ── Force simulation (runs once to convergence) ────────────────────────────
function runForce(nodes, edges, cw, ch, iters = 400) {
  const k = Math.sqrt((cw * ch) / nodes.length) * 1.6   // wider natural spacing

  for (let it = 0; it < iters; it++) {
    const cool = Math.pow(1 - it / iters, 1.5)           // slower cool-down

    // Reset forces
    for (const n of nodes) { n.fx = 0; n.fy = 0 }

    // Repulsion — size-aware minimum gap
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const ni = nodes[i], nj = nodes[j]
        let dx = ni.x - nj.x, dy = ni.y - nj.y
        let d  = Math.sqrt(dx*dx + dy*dy)

        // Enforce hard minimum clearance = sum of radii + 28px padding
        const minDist = cfg(ni).size + cfg(nj).size + 40
        if (d < minDist) {
          // Direct separation push (instant, no force calc needed)
          const push = (minDist - d + 1) * 0.55
          const nx = d < 0.1 ? Math.random() - 0.5 : dx / d
          const ny = d < 0.1 ? Math.random() - 0.5 : dy / d
          ni.x += nx * push; ni.y += ny * push
          nj.x -= nx * push; nj.y -= ny * push
          d = minDist
          dx = nx * d; dy = ny * d
        }

        // Standard Barnes-Hut style repulsion
        const f = (k * k) / d
        const nx2 = dx / d, ny2 = dy / d
        ni.fx += nx2 * f; ni.fy += ny2 * f
        nj.fx -= nx2 * f; nj.fy -= ny2 * f
      }
    }

    // Attraction along edges — ideal spring length 160px
    for (const e of edges) {
      const s = nodes.find(n => n.id === e.source)
      const t = nodes.find(n => n.id === e.target)
      if (!s || !t) continue
      const dx = t.x - s.x, dy = t.y - s.y
      const d  = Math.max(Math.sqrt(dx*dx + dy*dy), 1)
      const rest = cfg(s).size + cfg(t).size + 120    // rest length tied to node sizes
      const f  = ((d - rest) / d) * 0.06
      s.fx += dx * f; s.fy += dy * f
      t.fx -= dx * f; t.fy -= dy * f
    }

    // Gentle center gravity
    for (const n of nodes) {
      n.fx += (cw/2 - n.x) * 0.015
      n.fy += (ch/2 - n.y) * 0.015
    }

    // Apply with temperature cap
    const cap = cool * 50
    for (const n of nodes) {
      const mag = Math.sqrt(n.fx*n.fx + n.fy*n.fy)
      const scale = Math.min(1, cap / Math.max(mag, 1))
      n.x += n.fx * scale
      n.y += n.fy * scale
      // Clamp within canvas with margin
      n.x = Math.max(cfg(n).size + 20, Math.min(cw - cfg(n).size - 20, n.x))
      n.y = Math.max(cfg(n).size + 20, Math.min(ch - cfg(n).size - 20, n.y))
    }
  }
}

// ── Draw helper ────────────────────────────────────────────────────────────
function drawGraph(ctx, nodes, edges, hovered, selected, pulse, cw, ch) {
  ctx.clearRect(0, 0, cw, ch)

  // Background grid
  ctx.save()
  ctx.strokeStyle = 'rgba(0,212,255,0.04)'
  ctx.lineWidth = 1
  const grid = 40
  for (let x = 0; x < cw; x += grid) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ch); ctx.stroke() }
  for (let y = 0; y < ch; y += grid) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cw,y); ctx.stroke() }
  ctx.restore()

  // Radial vignette
  const grad = ctx.createRadialGradient(cw/2, ch/2, ch*0.2, cw/2, ch/2, ch*0.8)
  grad.addColorStop(0, 'rgba(4,8,18,0)')
  grad.addColorStop(1, 'rgba(4,8,18,0.6)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch)

  // ── Edges ──────────────────────────────────────────────────────────────
  for (const edge of edges) {
    const s = nodes.find(n => n.id === edge.source)
    const t = nodes.find(n => n.id === edge.target)
    if (!s || !t) continue

    const isHighlighted = hovered && (hovered.id === s.id || hovered.id === t.id)
    const alpha = isHighlighted ? 0.9 : 0.35
    const width = isHighlighted ? 2.5 : (edge.weight || 1) * 1.2

    // Curved bezier
    const mx = (s.x + t.x) / 2 + (t.y - s.y) * 0.18
    const my = (s.y + t.y) / 2 - (t.x - s.x) * 0.18

    // Gradient stroke
    const eg = ctx.createLinearGradient(s.x, s.y, t.x, t.y)
    const sc = cfg(s), tc = cfg(t)
    eg.addColorStop(0, sc.color + Math.round(alpha * 255).toString(16).padStart(2,'0'))
    eg.addColorStop(1, tc.color + Math.round(alpha * 255).toString(16).padStart(2,'0'))

    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.quadraticCurveTo(mx, my, t.x, t.y)
    ctx.strokeStyle = eg
    ctx.lineWidth = width
    ctx.stroke()

    // Arrowhead
    if (isHighlighted) {
      const dx = t.x - mx, dy = t.y - my
      const ang = Math.atan2(dy, dx)
      const r = cfg(t).size + 2
      const ax = t.x - Math.cos(ang) * r
      const ay = t.y - Math.sin(ang) * r
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ax - 8*Math.cos(ang-0.4), ay - 8*Math.sin(ang-0.4))
      ctx.lineTo(ax - 8*Math.cos(ang+0.4), ay - 8*Math.sin(ang+0.4))
      ctx.closePath()
      ctx.fillStyle = tc.color + 'cc'
      ctx.fill()
    }

    // Edge label (only on hover)
    if (isHighlighted && edge.label) {
      const lx = (s.x*0.35 + mx*0.3 + t.x*0.35)
      const ly = (s.y*0.35 + my*0.3 + t.y*0.35) - 10
      ctx.save()
      ctx.font = 'bold 9px "JetBrains Mono", monospace'
      const tw = ctx.measureText(edge.label).width
      ctx.fillStyle = 'rgba(4,8,18,0.85)'
      ctx.beginPath()
      ctx.roundRect(lx - tw/2 - 5, ly - 10, tw + 10, 16, 4)
      ctx.fill()
      ctx.fillStyle = '#94a3b8'
      ctx.textAlign = 'center'
      ctx.fillText(edge.label.substring(0, 24), lx, ly)
      ctx.restore()
    }
  }

  // ── Nodes ──────────────────────────────────────────────────────────────
  for (const node of nodes) {
    const c = cfg(node)
    const isHov  = hovered?.id  === node.id
    const isSel  = selected?.id === node.id
    const r      = c.size + (isHov ? 4 : 0) + (isSel ? 2 : 0)
    const pulsed = isSel ? Math.sin(pulse * 0.08) * 5 : 0

    // Outer ring (pulse on select)
    ctx.beginPath()
    ctx.arc(node.x, node.y, r + 12 + pulsed, 0, Math.PI*2)
    ctx.fillStyle = c.ring
    ctx.fill()

    // Glow halo
    const glowR = r + 7
    const gg = ctx.createRadialGradient(node.x, node.y, r*0.5, node.x, node.y, glowR)
    gg.addColorStop(0, c.glow)
    gg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(node.x, node.y, glowR, 0, Math.PI*2)
    ctx.fillStyle = gg
    ctx.fill()

    // Node body
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, Math.PI*2)
    ctx.fillStyle = c.color + (isHov || isSel ? 'cc' : '88')
    ctx.fill()
    ctx.strokeStyle = c.color
    ctx.lineWidth = isHov || isSel ? 2.5 : 1.5
    ctx.stroke()

    // Inner highlight shine
    const shine = ctx.createRadialGradient(node.x - r*0.3, node.y - r*0.3, 0, node.x, node.y, r)
    shine.addColorStop(0, 'rgba(255,255,255,0.25)')
    shine.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, Math.PI*2)
    ctx.fillStyle = shine
    ctx.fill()

    // Label pill
    const label = node.label?.substring(0, 16) || node.id
    ctx.font = `${isHov || isSel ? 'bold ' : ''}10px Inter, sans-serif`
    const tw = ctx.measureText(label).width
    const lx = node.x, ly = node.y + r + 18
    // pill bg
    ctx.fillStyle = 'rgba(4,8,20,0.88)'
    ctx.beginPath()
    ctx.roundRect(lx - tw/2 - 6, ly - 11, tw + 12, 16, 5)
    ctx.fill()
    ctx.strokeStyle = c.color + '55'
    ctx.lineWidth = 1
    ctx.stroke()
    // text
    ctx.fillStyle = isHov || isSel ? '#ffffff' : '#cbd5e1'
    ctx.textAlign = 'center'
    ctx.fillText(label, lx, ly)
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export default function EvidenceGraph() {
  const { caseId: paramId } = useParams()
  const storeCaseId = useForensicStore(s => s.caseId)
  const caseId = paramId || storeCaseId || 'FTI-2024-0847'

  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [selectedNode, setSelected] = useState(null)
  const [hoveredNode, setHovered]   = useState(null)
  const [zoom, setZoom]             = useState(1)

  const canvasRef  = useRef(null)
  const nodesRef   = useRef([])
  const rafRef     = useRef(null)
  const pulseRef   = useRef(0)
  const dragRef    = useRef(null)

  // Load data
  useEffect(() => {
    setLoading(true)
    api.getGraph(caseId).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [caseId])

  // Build + simulate nodes
  useEffect(() => {
    if (!data || !canvasRef.current) return
    const canvas = canvasRef.current
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight
    canvas.width  = cw * window.devicePixelRatio
    canvas.height = ch * window.devicePixelRatio
    const ctx = canvas.getContext('2d')
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const nodes = data.graph.nodes.map((n, i) => {
      const angle = (i / data.graph.nodes.length) * Math.PI * 2
      const r = n.id === 'victim' ? 0 : (n.category === 'suspect' ? 110 : 200 + Math.random()*60)
      return { ...n, x: cw/2 + Math.cos(angle)*r, y: ch/2 + Math.sin(angle)*r, fx:0, fy:0 }
    })
    runForce(nodes, data.graph.edges, cw, ch)
    nodesRef.current = nodes

    // Animation loop
    const loop = () => {
      pulseRef.current++
      drawGraph(ctx, nodesRef.current, data.graph.edges,
        hoveredNode, selectedNode, pulseRef.current, cw, ch)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [data]) // re-run only on data change; hover/select drawn in loop via closure

  // Update loop closure when hover/select change
  useEffect(() => {
    if (!data || !canvasRef.current) return
    const canvas = canvasRef.current
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight
    const ctx = canvas.getContext('2d')
    cancelAnimationFrame(rafRef.current)
    const loop = () => {
      pulseRef.current++
      drawGraph(ctx, nodesRef.current, data.graph.edges,
        hoveredNode, selectedNode, pulseRef.current, cw, ch)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [hoveredNode, selectedNode])

  // Mouse events
  const getNode = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect  = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    for (const n of nodesRef.current) {
      const dx = n.x - x, dy = n.y - y
      if (Math.sqrt(dx*dx + dy*dy) < cfg(n).size + 6) return n
    }
    return null
  }

  const onMouseMove = useCallback((e) => {
    if (dragRef.current) {
      const canvas = canvasRef.current
      const rect   = canvas.getBoundingClientRect()
      dragRef.current.x = e.clientX - rect.left
      dragRef.current.y = e.clientY - rect.top
      return
    }
    const n = getNode(e)
    setHovered(n || null)
    if (canvasRef.current) canvasRef.current.style.cursor = n ? 'pointer' : 'default'
  }, [])

  const onMouseDown = useCallback((e) => {
    const n = getNode(e)
    if (n) { dragRef.current = n; setSelected(n) }
  }, [])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])
  const onClick   = useCallback((e) => { if (!getNode(e)) setSelected(null) }, [])

  const C  = { border:'rgba(0,212,255,0.10)', card:'rgba(7,14,32,0.90)', cyan:'#00d4ff' }
  const selCfg = selectedNode ? cfg(selectedNode) : null

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ background:'rgba(4,8,18,0.97)' }}>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
          style={{ borderColor:'#00d4ff', borderTopColor:'transparent' }} />
        <div className="text-[11px] font-mono text-slate-500">Building evidence graph…</div>
      </div>
    </div>
  )
  if (!data) return null

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background:'rgba(4,8,18,0.97)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom:`1px solid ${C.border}` }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.25)' }}>
          <Network size={15} style={{ color:'#a78bfa' }} />
        </div>
        <div>
          <h1 className="text-[14px] font-black text-slate-100">Evidence Relationship Graph</h1>
          <p className="text-[10px] font-mono text-slate-500">{caseId} · {data.graph.node_count} nodes · {data.graph.edge_count} edges</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(0.5, z-0.15))} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors" style={{ border:`1px solid ${C.border}` }}><ZoomOut size={13}/></button>
          <span className="text-[10px] font-mono text-slate-500 w-10 text-center">{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2.5, z+0.15))} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors" style={{ border:`1px solid ${C.border}` }}><ZoomIn size={13}/></button>
          <button onClick={() => { setZoom(1); setSelected(null) }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors" style={{ border:`1px solid ${C.border}` }}><Maximize2 size={13}/></button>
          <button onClick={() => { setLoading(true); api.getGraph(caseId).then(setData).finally(()=>setLoading(false)) }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold transition-all"
            style={{ background:'rgba(0,212,255,0.08)', border:`1px solid rgba(0,212,255,0.2)`, color:C.cyan }}>
            <RefreshCw size={11}/> Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Canvas */}
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <canvas
            ref={canvasRef}
            style={{ width:'100%', height:'100%', display:'block',
              transform:`scale(${zoom})`, transformOrigin:'center center', cursor:'default' }}
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onClick={onClick}
          />
          {/* Zoom hint */}
          <div className="absolute bottom-3 left-3 text-[9px] font-mono text-slate-700 pointer-events-none">
            Drag nodes · Click to inspect · Scroll to zoom
          </div>
        </div>

        {/* Right panel */}
        <div className="w-60 flex-shrink-0 flex flex-col gap-3 overflow-y-auto py-4 px-3" style={{ borderLeft:`1px solid ${C.border}` }}>

          {/* Selected node */}
          {selectedNode ? (
            <div className="rounded-xl p-3" style={{ background:selCfg.color+'0d', border:`1px solid ${selCfg.color}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full" style={{ background:selCfg.color, boxShadow:`0 0 8px ${selCfg.color}` }} />
                <span className="text-[11px] font-bold text-slate-100">{selectedNode.label}</span>
              </div>
              {[['Type', selectedNode.type],['Category', selectedNode.category],
                selectedNode.metadata?.risk_score ? ['Risk Score', selectedNode.metadata.risk_score] : null,
                selectedNode.metadata?.confidence  ? ['Confidence', `${Math.round(selectedNode.metadata.confidence*100)}%`] : null,
              ].filter(Boolean).map(([k,v]) => (
                <div key={k} className="flex justify-between py-1 text-[10px]" style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-200 font-medium">{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-3 text-center text-[10px] text-slate-600" style={{ background:'rgba(255,255,255,0.02)', border:`1px solid rgba(255,255,255,0.05)` }}>
              Click a node to inspect
            </div>
          )}

          {/* Graph metrics */}
          <div className="rounded-xl p-3" style={{ background:C.card, border:`1px solid ${C.border}` }}>
            <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
              <div className="w-1 h-3 rounded-full" style={{ background:C.cyan }} /> Graph Metrics
            </div>
            {[
              ['Nodes', data.graph.node_count],
              ['Edges', data.graph.edge_count],
              ['Density', data.graph_metrics?.density ?? '—'],
              ['Central Node', data.graph_metrics?.central_node ?? '—'],
              ['Clusters', data.graph_metrics?.clusters_detected ?? '—'],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between py-1.5 text-[10px]" style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-slate-500">{k}</span>
                <span className="text-slate-200 font-mono">{v}</span>
              </div>
            ))}
          </div>

          {/* AI Insights */}
          {data.ai_insights?.length > 0 && (
            <div className="rounded-xl p-3" style={{ background:C.card, border:`1px solid ${C.border}` }}>
              <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                <Zap size={9} style={{ color:C.cyan }} /> AI Insights
              </div>
              <div className="space-y-2">
                {data.ai_insights.map((ins, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-0.5 rounded-full flex-shrink-0 mt-1" style={{ background:C.cyan, minHeight:14 }} />
                    <p className="text-[9px] text-slate-400 leading-relaxed">{ins}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="rounded-xl p-3" style={{ background:C.card, border:`1px solid ${C.border}` }}>
            <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-2">Legend</div>
            <div className="space-y-1.5">
              {Object.entries(NODE_CFG).filter(([k])=>k!=='default').map(([k,v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background:v.color, boxShadow:`0 0 6px ${v.glow}` }} />
                  <span className="text-[10px] text-slate-400 capitalize">{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
