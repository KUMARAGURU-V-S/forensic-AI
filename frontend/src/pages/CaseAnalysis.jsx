import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Brain, Clock, Network, AlertTriangle, Shield, Lock, Activity } from 'lucide-react'
import { api } from '../lib/api'

export default function CaseAnalysis() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState(null)
  const [autopsy, setAutopsy] = useState(null)
  const [tod, setTod] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getCase(caseId), api.analyzeAutopsy(caseId), api.estimateTOD(caseId)])
      .then(([c, a, t]) => { setCaseData(c); setAutopsy(a); setTod(t) }).catch(console.error).finally(() => setLoading(false))
  }, [caseId])

  if (loading) return <div className="flex items-center justify-center min-h-[80vh]"><div className="w-8 h-8 border-2 border-forensic-cyan border-t-transparent rounded-full animate-spin" /></div>
  if (!caseData) return <div className="text-center py-20 text-slate-400">Case not found</div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-mono text-forensic-cyan">{caseData.id}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${caseData.priority === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>{caseData.priority.toUpperCase()}</span>
        </div>
        <h1 className="text-xl font-black text-white">{caseData.title}</h1>
        <p className="text-sm text-slate-400">{caseData.classification} • {caseData.lead_investigator}</p>
      </motion.div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {[{ label: 'Timeline', path: `/timeline/${caseId}`, icon: Clock, color: 'text-forensic-green' },
          { label: 'Evidence Graph', path: `/graph/${caseId}`, icon: Network, color: 'text-forensic-purple' },
          { label: 'Risk Score', path: `/risk/${caseId}`, icon: AlertTriangle, color: 'text-forensic-red' },
          { label: 'Chain of Custody', path: `/custody/${caseId}`, icon: Lock, color: 'text-forensic-cyan' },
          { label: 'AI Agents', path: `/agents`, icon: Brain, color: 'text-forensic-amber' }
        ].map((a) => { const Icon = a.icon; return (
          <button key={a.label} onClick={() => navigate(a.path)} className="forensic-card rounded-lg p-3 text-center hover:border-forensic-cyan/50">
            <Icon size={18} className={`${a.color} mx-auto mb-1`} /><span className="text-[10px] text-slate-300">{a.label}</span></button>
        )})}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Victim Info */}
        <div className="forensic-card rounded-xl p-5">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Activity size={14} className="text-forensic-red" />VICTIM INFORMATION</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="text-white font-medium">{caseData.victim.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Age</span><span className="text-white">{caseData.victim.age}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Occupation</span><span className="text-white">{caseData.victim.occupation}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Location</span><span className="text-white text-right text-xs max-w-[200px]">{caseData.victim.last_known_location}</span></div>
          </div>
        </div>

        {/* Suspects */}
        <div className="forensic-card rounded-xl p-5">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Shield size={14} className="text-forensic-amber" />SUSPECTS</h2>
          <div className="space-y-3">
            {caseData.suspects.map(s => (
              <div key={s.id} className="p-3 rounded-lg bg-forensic-bg border border-forensic-border">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <span className={`text-sm font-black ${s.risk_score > 80 ? 'text-forensic-red' : 'text-forensic-amber'}`}>{s.risk_score}</span>
                </div>
                <div className="text-[11px] text-slate-400 mb-2">{s.relationship}</div>
                <div className="flex flex-wrap gap-1">{s.flags.map(f => <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-forensic-elevated border border-forensic-border text-slate-300">{f.replace(/_/g, ' ')}</span>)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Autopsy NLP */}
        {autopsy && (
          <div className="forensic-card rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Brain size={14} className="text-forensic-cyan" />AI AUTOPSY ANALYSIS</h2>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-forensic-bg border border-forensic-border">
                <div className="text-[10px] text-forensic-cyan font-mono mb-1">CAUSE OF DEATH</div>
                <div className="text-sm text-white">{autopsy.nlp_extraction.cause_of_death}</div>
              </div>
              <div className="p-3 rounded-lg bg-forensic-bg border border-forensic-border">
                <div className="text-[10px] text-forensic-amber font-mono mb-1">MANNER</div>
                <div className="text-sm text-white">{autopsy.nlp_extraction.manner_of_death}</div>
              </div>
              <div className="text-[10px] text-forensic-green font-mono mt-3 mb-1">AI INSIGHTS</div>
              <div className="space-y-1">{autopsy.ai_insights.map((insight, i) => <div key={i} className="text-xs text-slate-300 pl-3 border-l-2 border-forensic-cyan/30">{insight}</div>)}</div>
            </div>
          </div>
        )}

        {/* TOD Estimation */}
        {tod && (
          <div className="forensic-card rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Clock size={14} className="text-forensic-green" />TIME-OF-DEATH ESTIMATION</h2>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-forensic-bg border border-forensic-border">
                <div className="text-[10px] text-forensic-green font-mono mb-1">ESTIMATED TOD</div>
                <div className="text-lg font-black text-white">{new Date(tod.combined_estimation.estimated_tod).toLocaleString()}</div>
                <div className="text-xs text-slate-400">Confidence: {(tod.combined_estimation.overall_confidence * 100).toFixed(0)}% | {tod.combined_estimation.confidence_interval}</div>
              </div>
              <div className="text-[10px] text-forensic-cyan font-mono mt-3 mb-2">METHODS USED</div>
              {tod.methods_used.map((m, i) => (
                <div key={i} className="flex justify-between items-center text-xs p-2 rounded bg-forensic-bg">
                  <span className="text-slate-300">{m.method}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{m.estimated_pmi_hours}h PMI</span>
                    <span className="text-forensic-cyan">{(m.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
              {tod.smartwatch_corroboration && (
                <div className="mt-3 p-3 rounded-lg border border-forensic-green/30 bg-forensic-green/5">
                  <div className="text-[10px] text-forensic-green font-mono mb-1">⌚ SMARTWATCH CORROBORATION</div>
                  <div className="text-xs text-slate-300">{tod.smartwatch_corroboration.refinement}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Anomalies */}
        <div className="forensic-card rounded-xl p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><AlertTriangle size={14} className="text-forensic-red" />DETECTED ANOMALIES</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {caseData.ai_findings.anomalies.map((a, i) => (
              <div key={i} className={`p-3 rounded-lg border ${a.severity === 'critical' ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                <div className={`text-[10px] font-bold mb-1 ${a.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>{a.severity.toUpperCase()} • {a.type.replace(/_/g, ' ').toUpperCase()}</div>
                <div className="text-xs text-slate-300">{a.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
