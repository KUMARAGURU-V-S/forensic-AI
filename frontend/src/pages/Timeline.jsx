import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Camera, Phone, Cpu, Heart, MapPin, Skull } from 'lucide-react'
import { api } from '../lib/api'

const iconMap = { camera: Camera, phone: Phone, sensor: Cpu, heart: Heart, 'map-pin': MapPin, skull: Skull }
const sevColors = { critical: 'border-red-500 bg-red-500/10 text-red-400', high: 'border-amber-500 bg-amber-500/10 text-amber-400', medium: 'border-blue-500 bg-blue-500/10 text-blue-400', low: 'border-slate-500 bg-slate-500/10 text-slate-400' }

export default function Timeline() {
  const { caseId } = useParams()
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.getTimeline(caseId).then(setData).catch(console.error).finally(() => setLoading(false)) }, [caseId])

  if (loading) return <div className="flex items-center justify-center min-h-[80vh]"><div className="w-8 h-8 border-2 border-forensic-cyan border-t-transparent rounded-full animate-spin" /></div>
  if (!data) return null

  const categories = ['all', ...data.categories]
  const filtered = filter === 'all' ? data.events : data.events.filter(e => e.category === filter)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl font-black text-white mb-1 flex items-center gap-2"><Clock size={20} className="text-forensic-green" />Unified Forensic Timeline</h1>
        <p className="text-sm text-slate-400 font-mono">{caseId} • {data.total_events} events reconstructed</p>
      </motion.div>

      {/* Critical Window */}
      <div className="forensic-card rounded-xl p-4 mb-6 border-forensic-red/30">
        <div className="flex items-center gap-2 text-forensic-red text-xs font-bold mb-1">⚠️ CRITICAL WINDOW</div>
        <div className="text-sm text-slate-300">{data.critical_window.description}</div>
        <div className="text-xs text-slate-400 mt-1 font-mono">{data.critical_window.start} → {data.critical_window.end}</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} className={`text-[10px] px-3 py-1.5 rounded-full font-medium transition-all ${filter === cat ? 'bg-forensic-cyan/20 text-forensic-cyan border border-forensic-cyan/30' : 'bg-forensic-card border border-forensic-border text-slate-400 hover:text-white'}`}>
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-forensic-border" />
        <div className="space-y-4">
          {filtered.map((event, i) => {
            const Icon = iconMap[event.icon] || Clock
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="relative pl-14">
                <div className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-forensic-bg ${
                  event.severity === 'critical' ? 'border-red-500' : event.severity === 'high' ? 'border-amber-500' : 'border-slate-500'}`}>
                  <Icon size={10} className={event.severity === 'critical' ? 'text-red-400' : event.severity === 'high' ? 'text-amber-400' : 'text-slate-400'} />
                </div>
                <div className={`forensic-card rounded-lg p-3 border-l-2 ${event.severity === 'critical' ? 'border-l-red-500' : event.severity === 'high' ? 'border-l-amber-500' : event.severity === 'medium' ? 'border-l-blue-500' : 'border-l-slate-600'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-forensic-cyan">{event.timestamp.replace('T', ' ').replace('Z', '')}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${sevColors[event.severity]}`}>{event.severity.toUpperCase()}</span>
                  </div>
                  <div className="text-sm font-medium text-white mb-0.5">{event.title}</div>
                  <div className="text-xs text-slate-400">{event.description}</div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                    <span>{event.source}</span><span>•</span><span>Confidence: {(event.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
