import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Network, Zap } from 'lucide-react'
import { api } from '../lib/api'

export default function EvidenceGraph() {
  const { caseId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState(null)
  const canvasRef = useRef(null)
  const nodesRef = useRef([])

  useEffect(() => { api.getGraph(caseId).then(setData).catch(console.error).finally(() => setLoading(false)) }, [caseId])

  useEffect(() => {
    if (!data || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const w = canvas.width = canvas.offsetWidth * 2
    const h = canvas.height = canvas.offsetHeight * 2
    ctx.scale(2, 2)
    const cw = w / 2, ch = h / 2

    // Position nodes in a force-like layout
    const nodes = data.graph.nodes.map((n, i) => {
      const angle = (i / data.graph.nodes.length) * Math.PI * 2
      const radius = n.id === 'victim' ? 0 : (n.category === 'suspect' ? 100 : 180 + Math.random() * 60)
      return { ...n, x: cw / 2 + Math.cos(angle) * radius, y: ch / 2 + Math.sin(angle) * radius, vx: 0, vy: 0 }
    })
    nodesRef.current = nodes

    // Simple force simulation
    function simulate() {
      for (let iter = 0; iter < 100; iter++) {
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x
            const dy = nodes[j].y - nodes[i].y
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
            const force = 5000 / (dist * dist)
            nodes[i].x -= (dx / dist) * force
            nodes[i].y -= (dy / dist) * force
            nodes[j].x += (dx / dist) * force
            nodes[j].y += (dy / dist) * force
          }
        }
        // Attraction along edges
        for (const edge of data.graph.edges) {
          const source = nodes.find(n => n.id === edge.source)
          const target = nodes.find(n => n.id === edge.target)
          if (source && target) {
            const dx = target.x - source.x
            const dy = target.y - source.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const force = (dist - 120) * 0.01
            source.x += (dx / dist) * force
            source.y += (dy / dist) * force
            target.x -= (dx / dist) * force
            target.y -= (dy / dist) * force
          }
        }
        // Center gravity
        for (const n of nodes) {
          n.x += (cw / 2 - n.x) * 0.01
          n.y += (ch / 2 - n.y) * 0.01
        }
      }
    }
    simulate()

    function draw() {
      ctx.clearRect(0, 0, cw, ch)
      // Draw edges
      for (const edge of data.graph.edges) {
        const source = nodes.find(n => n.id === edge.source)
        const target = nodes.find(n => n.id === edge.target)
        if (source && target) {
          ctx.beginPath()
          ctx.moveTo(source.x, source.y)
          ctx.lineTo(target.x, target.y)
          ctx.strokeStyle = edge.color + '60'
          ctx.lineWidth = edge.weight * 2
          ctx.stroke()
          // Label
          const mx = (source.x + target.x) / 2, my = (source.y + target.y) / 2
          ctx.font = '8px JetBrains Mono, monospace'
          ctx.fillStyle = '#64748b'
          ctx.textAlign = 'center'
          ctx.fillText(edge.label.substring(0, 20), mx, my - 4)
        }
      }
      // Draw nodes
      for (const node of nodes) {
        // Glow
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.size / 2 + 4, 0, Math.PI * 2)
        ctx.fillStyle = node.color + '20'
        ctx.fill()
        // Node
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.size / 2, 0, Math.PI * 2)
        ctx.fillStyle = node.color + '80'
        ctx.strokeStyle = node.color
        ctx.lineWidth = 2
        ctx.fill()
        ctx.stroke()
        // Label
        ctx.font = '9px Inter, sans-serif'
        ctx.fillStyle = '#e2e8f0'
        ctx.textAlign = 'center'
        ctx.fillText(node.label.substring(0, 18), node.x, node.y + node.size / 2 + 14)
      }
    }
    draw()

    // Click handler
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left)
      const y = (e.clientY - rect.top)
      for (const node of nodes) {
        const dx = node.x - x, dy = node.y - y
        if (Math.sqrt(dx*dx + dy*dy) < node.size) {
          setSelectedNode(node)
          return
        }
      }
      setSelectedNode(null)
    }
    canvas.addEventListener('click', handleClick)
    return () => canvas.removeEventListener('click', handleClick)
  }, [data])

  if (loading) return <div className="flex items-center justify-center min-h-[80vh]"><div className="w-8 h-8 border-2 border-forensic-cyan border-t-transparent rounded-full animate-spin" /></div>
  if (!data) return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl font-black text-white mb-1 flex items-center gap-2"><Network size={20} className="text-forensic-purple" />Evidence Relationship Graph</h1>
        <p className="text-sm text-slate-400 font-mono">{caseId} • {data.graph.node_count} nodes • {data.graph.edge_count} edges</p>
      </motion.div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 forensic-card rounded-xl overflow-hidden" style={{height: '500px'}}>
          <canvas ref={canvasRef} className="w-full h-full" style={{cursor: 'pointer'}} />
        </div>

        <div className="space-y-4">
          {/* Graph Metrics */}
          <div className="forensic-card rounded-xl p-4">
            <h3 className="text-xs font-bold text-white mb-3">GRAPH METRICS</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Density</span><span className="text-white">{data.graph_metrics.density}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Central Node</span><span className="text-forensic-red">{data.graph_metrics.central_node}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Highest Degree</span><span className="text-forensic-amber">{data.graph_metrics.highest_degree}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Clusters</span><span className="text-forensic-cyan">{data.graph_metrics.clusters_detected}</span></div>
            </div>
          </div>

          {/* Selected Node */}
          {selectedNode && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="forensic-card rounded-xl p-4">
              <h3 className="text-xs font-bold text-white mb-2">SELECTED: {selectedNode.label}</h3>
              <div className="text-[10px] text-slate-400 space-y-1">
                <div>Type: <span className="text-white">{selectedNode.type}</span></div>
                <div>Category: <span className="text-white">{selectedNode.category}</span></div>
                {selectedNode.metadata?.risk_score && <div>Risk: <span className="text-forensic-red font-bold">{selectedNode.metadata.risk_score}</span></div>}
              </div>
            </motion.div>
          )}

          {/* AI Insights */}
          <div className="forensic-card rounded-xl p-4">
            <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-1"><Zap size={12} className="text-forensic-cyan" />AI INSIGHTS</h3>
            <div className="space-y-2">{data.ai_insights.map((insight, i) => <div key={i} className="text-[11px] text-slate-300 pl-2 border-l border-forensic-cyan/40">{insight}</div>)}</div>
          </div>

          {/* Legend */}
          <div className="forensic-card rounded-xl p-4">
            <h3 className="text-xs font-bold text-white mb-3">LEGEND</h3>
            <div className="space-y-1.5 text-[10px]">
              {[{color: '#ff3333', label: 'Victim'}, {color: '#ffaa00', label: 'Suspect'}, {color: '#00d4ff', label: 'Device'},
                {color: '#00ff88', label: 'Camera'}, {color: '#cc00ff', label: 'Substance'}, {color: '#ff5555', label: 'Location'},
                {color: '#ff8800', label: 'Anomaly'}
              ].map(l => <div key={l.label} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{background: l.color}} /><span className="text-slate-300">{l.label}</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
