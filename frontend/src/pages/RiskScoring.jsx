import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, TrendingUp, Shield } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { api } from '../lib/api'
import { useForensicStore } from '../lib/store'

export default function RiskScoring() {
  const { caseId: paramId } = useParams()
  const storeCaseId = useForensicStore(s => s.caseId)
  const caseId = paramId || storeCaseId || 'FTI-2024-0847'
  const [data, setData] = useState(null)
  const [explainability, setExplainability] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getRisk(caseId), api.getExplainability(caseId)])
      .then(([r, e]) => { setData(r); setExplainability(e) }).catch(console.error).finally(() => setLoading(false))
  }, [caseId])

  if (loading) return <div className="flex items-center justify-center min-h-[80vh]"><div className="w-8 h-8 border-2 border-forensic-cyan border-t-transparent rounded-full animate-spin" /></div>
  if (!data) return null

  const radarData = data.risk_matrix.categories.map(c => ({ category: c.name.replace(' ', '\n'), score: c.score, fullMark: 100 }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl font-black text-white mb-1 flex items-center gap-2"><TrendingUp size={20} className="text-forensic-amber" />Risk Assessment Engine</h1>
        <p className="text-sm text-slate-400 font-mono">{caseId} • SHAP + LIME Explainability</p>
      </motion.div>

      {/* Overall Risk */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="forensic-card rounded-xl p-6 text-center glow-red">
          <div className="text-5xl font-black text-forensic-red mb-2">{data.case_risk.overall_score}</div>
          <div className="text-xs font-mono text-slate-400 uppercase">Case Risk Score</div>
          <div className="text-xs text-red-400 mt-1 font-bold">{data.case_risk.severity_level.toUpperCase()}</div>
        </div>
        <div className="forensic-card rounded-xl p-6 text-center">
          <div className="text-5xl font-black text-forensic-amber mb-2">{data.case_risk.anomaly_count}</div>
          <div className="text-xs font-mono text-slate-400 uppercase">Anomalies Detected</div>
          <div className="text-xs text-amber-400 mt-1">{data.case_risk.anomaly_severity_score}/100 severity</div>
        </div>
        <div className="forensic-card rounded-xl p-6 text-center">
          <div className="text-5xl font-black text-forensic-cyan mb-2">{data.ai_confidence.validation_accuracy * 100}%</div>
          <div className="text-xs font-mono text-slate-400 uppercase">Model Accuracy</div>
          <div className="text-xs text-slate-400 mt-1">{data.ai_confidence.training_cases.toLocaleString()} training cases</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Risk Matrix Radar */}
        <div className="forensic-card rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">RISK MATRIX</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1e3a5f" />
              <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
              <Radar name="Risk" dataKey="score" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* SHAP Explainability */}
        {explainability && (
          <div className="forensic-card rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Shield size={14} className="text-forensic-green" />SHAP FACTOR ATTRIBUTION</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={explainability.overall_risk_explanation.top_contributing_factors} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis type="number" domain={[0, 0.4]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis type="category" dataKey="factor" tick={{ fill: '#94a3b8', fontSize: 9 }} width={180} />
                <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px' }} labelStyle={{ color: '#e2e8f0' }} />
                <Bar dataKey="contribution" fill="#00d4ff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Suspect Risk Cards */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-white mb-4">SUSPECT RISK PROFILES</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {data.suspects_risk.map(s => (
            <div key={s.suspect_id} className={`forensic-card rounded-xl p-5 ${s.risk_level === 'critical' ? 'border-red-500/40' : 'border-amber-500/30'}`}>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-sm font-bold text-white">{s.name}</div>
                  <div className="text-[10px] text-slate-400">{s.suspect_id}</div>
                </div>
                <div className={`text-2xl font-black ${s.risk_level === 'critical' ? 'text-forensic-red' : 'text-forensic-amber'}`}>{s.overall_risk_score}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {Object.entries(s.behavioral_indicators).map(([k, v]) => (
                  <div key={k} className={`text-[10px] px-2 py-1 rounded ${v ? 'bg-red-500/10 text-red-400' : 'bg-slate-700/30 text-slate-500'}`}>
                    {v ? '⚠️' : '✓'} {k.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
              <div className="text-xs text-forensic-cyan font-medium">{s.recommendation}</div>
            </div>
          ))}
        </div>
      </div>

      {/* LIME */}
      {explainability?.lime_local_explanations?.[0] && (
        <div className="forensic-card rounded-xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">LIME LOCAL EXPLANATION - Evidence Sensitivity</h3>
          <p className="text-xs text-slate-400 mb-4">What happens to the prediction when each evidence type is removed?</p>
          <div className="grid md:grid-cols-4 gap-3">
            {explainability.lime_local_explanations[0].if_removed.map((item, i) => (
              <div key={i} className="p-3 rounded-lg bg-forensic-bg border border-forensic-border text-center">
                <div className="text-xs text-slate-400 mb-1">Without {item.evidence}</div>
                <div className="text-lg font-black text-white">{item.new_score}</div>
                <div className="text-xs text-red-400 font-mono">{item.impact}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
