import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Zap, Check } from 'lucide-react'
import { api } from '../lib/api'

export default function Agents() {
  const [data, setData] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => { api.getAgentsStatus().then(setData).catch(console.error).finally(() => setLoading(false)) }, [])

  const runAnalysis = async () => {
    setRunning(true)
    try { const result = await api.runAgentAnalysis('FTI-2024-0847'); setAnalysis(result) } catch(e) { console.error(e) }
    setRunning(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[80vh]"><div className="w-8 h-8 border-2 border-forensic-cyan border-t-transparent rounded-full animate-spin" /></div>
  if (!data) return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl font-black text-white mb-1 flex items-center gap-2"><Bot size={20} className="text-forensic-cyan" />FEAT Multi-Agent System</h1>
        <p className="text-sm text-slate-400 font-mono">{data.agents.length} specialized AI agents • Orchestrator: {data.orchestrator.status}</p>
      </motion.div>

      {/* Orchestrator */}
      <div className="forensic-card rounded-xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-forensic-green pulse-dot" />
          <div>
            <div className="text-sm font-bold text-white">FEAT Orchestrator</div>
            <div className="text-[10px] text-slate-400 font-mono">{data.orchestrator.coordination_model} • Avg: {data.orchestrator.avg_response_time_ms}ms</div>
          </div>
        </div>
        <button onClick={runAnalysis} disabled={running}
          className="px-4 py-2 bg-forensic-cyan text-black text-xs font-bold rounded-lg hover:bg-forensic-cyan/90 disabled:opacity-50 flex items-center gap-2">
          {running ? <><div className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin" />ANALYZING...</> : <><Zap size={14} />RUN ANALYSIS</>}
        </button>
      </div>

      {/* Agent Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {data.agents.map((agent, i) => (
          <motion.div key={agent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="forensic-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-2 h-2 rounded-full bg-forensic-green pulse-dot" />
              <span className="text-[10px] font-mono text-forensic-green">{(agent.accuracy * 100).toFixed(0)}%</span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">{agent.name}</h3>
            <div className="text-[10px] text-slate-400 font-mono mb-3">{agent.model}</div>
            <div className="flex flex-wrap gap-1 mb-3">
              {agent.capabilities.slice(0, 3).map(c => <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-forensic-bg border border-forensic-border text-slate-300">{c.replace(/_/g, ' ')}</span>)}
              {agent.capabilities.length > 3 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-forensic-bg text-slate-500">+{agent.capabilities.length - 3}</span>}
            </div>
            <div className="text-[10px] text-slate-500">{agent.tasks_completed} tasks completed</div>
          </motion.div>
        ))}
      </div>

      {/* Analysis Results */}
      {analysis && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="forensic-card rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Zap size={14} className="text-forensic-cyan" />MULTI-AGENT ANALYSIS RESULTS</h3>
            <div className="grid md:grid-cols-4 gap-3 mb-6">
              <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-forensic-cyan">{analysis.orchestration.total_agents_invoked}</div><div className="text-[10px] text-slate-400">Agents Used</div></div>
              <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-forensic-green">{analysis.orchestration.execution_time_ms}ms</div><div className="text-[10px] text-slate-400">Total Time</div></div>
              <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-forensic-amber">{analysis.orchestration.parallel_tasks}</div><div className="text-[10px] text-slate-400">Parallel Tasks</div></div>
              <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-white">{(analysis.consensus.confidence * 100).toFixed(0)}%</div><div className="text-[10px] text-slate-400">Consensus</div></div>
            </div>
            {analysis.agent_outputs.map((out, i) => (
              <div key={i} className="mb-3 p-3 rounded-lg bg-forensic-bg border border-forensic-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-white">{out.agent.replace(/_/g, ' ').toUpperCase()}</span>
                  <span className="text-[10px] text-forensic-cyan font-mono">{(out.confidence * 100).toFixed(0)}% • {out.processing_time_ms}ms</span>
                </div>
                <div className="space-y-1">{out.findings.map((f, j) => <div key={j} className="text-[11px] text-slate-300 flex items-start gap-1"><Check size={10} className="text-forensic-green mt-0.5 flex-shrink-0" />{f}</div>)}</div>
              </div>
            ))}
          </div>

          {/* Consensus */}
          <div className="forensic-card rounded-xl p-5 border-forensic-green/40">
            <h3 className="text-sm font-bold text-forensic-green mb-3">🎯 CONSENSUS: {analysis.consensus.primary_suspect}</h3>
            <div className="text-xs text-slate-300 mb-3">Evidence Strength: <span className="text-white font-bold">{analysis.consensus.evidence_strength.toUpperCase()}</span></div>
            <div className="space-y-1">{analysis.consensus.recommended_actions.map((a, i) => <div key={i} className="text-xs text-slate-300 pl-3 border-l-2 border-forensic-green/40">{a}</div>)}</div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
