import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Shield, Clock, FileText, Brain, Network, TrendingUp, ChevronRight, Zap } from 'lucide-react'
import { api } from '../lib/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getCases(), api.getStats()]).then(([c, s]) => { setCases(c); setStats(s) }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center min-h-[80vh]"><div className="text-center"><div className="w-8 h-8 border-2 border-forensic-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" /><p className="text-sm font-mono text-slate-400">LOADING FORENSIC DATA...</p></div></div>

  const statCards = stats ? [
    { label: 'Active Cases', value: stats.active_investigations, icon: FileText, color: 'cyan' },
    { label: 'Evidence Items', value: stats.evidence_items.toLocaleString(), icon: Shield, color: 'green' },
    { label: 'AI Correlations', value: stats.ai_correlations, icon: Brain, color: 'purple' },
    { label: 'Risk Alerts', value: stats.risk_alerts, icon: AlertTriangle, color: 'red' },
  ] : []

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-black text-white mb-1">Investigation Dashboard</h1>
        <p className="text-sm text-slate-400 font-mono">Real-time forensic intelligence overview</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => {
          const Icon = stat.icon
          const colors = { cyan: 'text-forensic-cyan border-forensic-cyan/30', green: 'text-forensic-green border-forensic-green/30', purple: 'text-forensic-purple border-forensic-purple/30', red: 'text-forensic-red border-forensic-red/30' }
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="forensic-card rounded-xl p-5">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${colors[stat.color]}`}><Icon size={18} /></div>
              <div className="text-2xl font-black text-white mb-0.5">{stat.value}</div>
              <div className="text-xs text-slate-400">{stat.label}</div>
            </motion.div>
          )
        })}
      </div>

      <div className="forensic-card rounded-xl overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-forensic-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Zap size={14} className="text-forensic-cyan" />ACTIVE INVESTIGATIONS</h2>
          <span className="text-[10px] font-mono text-slate-500">{cases.length} CASES</span>
        </div>
        <div className="divide-y divide-forensic-border">
          {cases.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              className="px-5 py-4 hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => navigate(`/case/${c.id}`)}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono text-forensic-cyan">{c.id}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.priority === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>{c.priority.toUpperCase()}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-0.5">{c.title}</h3>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400"><span>{c.classification}</span><span>•</span><span>{c.lead_investigator}</span></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-lg font-black ${c.risk_score > 90 ? 'text-forensic-red' : 'text-forensic-amber'}`}>{c.risk_score}</div>
                    <div className="text-[10px] text-slate-500">RISK</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-500" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ label: 'Evidence Graph', path: '/graph/FTI-2024-0847', icon: Network, color: 'text-forensic-purple' },
          { label: 'Timeline', path: '/timeline/FTI-2024-0847', icon: Clock, color: 'text-forensic-green' },
          { label: 'Risk Analysis', path: '/risk/FTI-2024-0847', icon: TrendingUp, color: 'text-forensic-amber' },
          { label: 'AI Agents', path: '/agents', icon: Brain, color: 'text-forensic-cyan' }
        ].map((a) => { const Icon = a.icon; return (
          <motion.button key={a.label} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate(a.path)}
            className="forensic-card rounded-xl p-4 text-center"><Icon size={24} className={`${a.color} mx-auto mb-2`} /><span className="text-xs text-slate-300">{a.label}</span></motion.button>
        )})}
      </div>
    </div>
  )
}
