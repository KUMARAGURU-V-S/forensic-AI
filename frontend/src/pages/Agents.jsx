import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Zap, Check, AlertTriangle, Play, RefreshCw,
  Activity, Shield, Eye, Clock, Link2, Lightbulb,
  Target, ChevronRight, XCircle, CheckCircle, Loader2,
  Wifi, WifiOff,
} from 'lucide-react'
import { api } from '../lib/api'

const LG_AGENTS = [
  { id: 'autopsy',        name: 'Autopsy',        icon: '🔬', model: 'Gemini 2.5 Flash',   phase: 1, desc: 'Injuries, COD, toxicology',  color: '#ef4444' },
  { id: 'timeline',       name: 'Timeline',       icon: '📅', model: 'Deterministic',       phase: 1, desc: 'Gap detection, clustering',  color: '#00d4ff' },
  { id: 'cctv',           name: 'CCTV',           icon: '📷', model: 'Gemini 2.5 Flash',   phase: 1, desc: 'Person/vehicle/weapon',       color: '#8b5cf6' },
  { id: 'toxicology',     name: 'Toxicology',     icon: '🧪', model: 'Featherless LLM',    phase: 2, desc: 'Drug interactions, dosing',   color: '#10b981' },
  { id: 'correlation',    name: 'Correlation',    icon: '🔗', model: 'Featherless + Local', phase: 2, desc: 'Cross-evidence links',        color: '#f59e0b' },
  { id: 'risk',           name: 'Risk Scoring',   icon: '⚠️', model: 'Deterministic',       phase: 2, desc: 'Weighted risk score',         color: '#f97316' },
  { id: 'explainability', name: 'Explainability', icon: '💡', model: 'Featherless LLM',    phase: 3, desc: 'SHAP-style reasoning',        color: '#06b6d4' },
  { id: 'leads',          name: 'Lead Generator', icon: '🎯', model: 'Deterministic',       phase: 3, desc: 'Investigative actions',       color: '#ec4899' },
]

const SEQUENTIAL_ORDER = ['toxicology', 'correlation', 'risk', 'explainability', 'leads']
const RISK_COLOR = { CRITICAL: 'text-red-400', HIGH: 'text-forensic-amber', MODERATE: 'text-yellow-400', LOW: 'text-forensic-green', UNKNOWN: 'text-slate-400' }
const SEV_COLOR = { CRITICAL: 'border-red-500/40 bg-red-500/5', HIGH: 'border-forensic-amber/40 bg-forensic-amber/5', MODERATE: 'border-yellow-500/30 bg-yellow-500/5', INFO: 'border-slate-600 bg-slate-800/30' }

function HITLModal({ data, onDecide }) {
  const { message, risk_score, risk_level, top_findings } = data
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg mx-4 forensic-card rounded-2xl p-6 border-forensic-amber/50">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-forensic-amber flex-shrink-0" />
          <h2 className="text-sm font-black text-white">HUMAN REVIEW REQUIRED</h2>
        </div>
        <p className="text-xs text-forensic-amber font-mono mb-4">{message}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-2 rounded-lg bg-forensic-bg text-center"><div className={`text-lg font-black ${RISK_COLOR[risk_level] || 'text-white'}`}>{risk_score}/100</div><div className="text-[10px] text-slate-400">Risk Score</div></div>
          <div className="p-2 rounded-lg bg-forensic-bg text-center"><div className={`text-lg font-black ${RISK_COLOR[risk_level] || 'text-white'}`}>{risk_level}</div><div className="text-[10px] text-slate-400">Risk Level</div></div>
        </div>
        {top_findings?.length > 0 && (<div className="mb-5"><div className="text-[10px] text-slate-500 font-mono uppercase mb-2">Critical Findings</div><div className="space-y-1">{top_findings.map((f, i) => (<div key={i} className="text-xs text-slate-300 flex gap-2"><span className="text-red-400 flex-shrink-0">▸</span><span>{f}</span></div>))}</div></div>)}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => onDecide('approve')} className="py-2 rounded-lg bg-forensic-green/20 border border-forensic-green/40 text-forensic-green text-xs font-bold hover:bg-forensic-green/30">✓ Approve</button>
          <button onClick={() => onDecide('escalate')} className="py-2 rounded-lg bg-forensic-amber/20 border border-forensic-amber/40 text-forensic-amber text-xs font-bold hover:bg-forensic-amber/30">↑ Escalate</button>
          <button onClick={() => onDecide('reject')} className="py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/30">✗ Reject</button>
        </div>
      </motion.div>
    </div>
  )
}

function LGAgentCard({ agent, state, findingsCount = 0 }) {
  const { name, icon, model, desc, phase, color } = agent
  const isActive = state === 'running', isDone = state === 'done', isError = state === 'error'
  return (
    <motion.div animate={{ borderColor: isDone ? 'rgba(16,185,129,0.5)' : isActive ? `${color}80` : isError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)', boxShadow: isActive ? `0 0 20px ${color}30` : isDone ? '0 0 12px rgba(16,185,129,0.15)' : 'none' }} transition={{ duration: 0.5 }}
      className={`forensic-card rounded-xl p-3 border transition-all duration-500 ${isDone ? 'border-forensic-green/40 bg-forensic-green/5' : isActive ? 'border-forensic-cyan/50 bg-forensic-cyan/5' : isError ? 'border-red-500/30 bg-red-500/5' : 'border-forensic-border'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{icon}</span>
          <div><div className="text-xs font-bold text-white">{name}</div><div className="text-[9px] text-slate-500 font-mono">{model}</div></div>
        </div>
        {isDone ? <CheckCircle size={14} className="text-forensic-green" /> : isActive ? <Loader2 size={14} className="text-forensic-cyan animate-spin" /> : isError ? <XCircle size={14} className="text-red-400" /> : <div className="w-3 h-3 rounded-full bg-slate-700" />}
      </div>
      <div className="text-[9px] text-slate-400 mb-2">{desc}</div>
      <div className="flex items-center justify-between">
        <div className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${phase === 1 ? 'bg-blue-500/20 text-blue-300' : phase === 2 ? 'bg-purple-500/20 text-purple-300' : 'bg-forensic-cyan/20 text-forensic-cyan'}`}>Phase {phase}{phase === 1 ? ' ∥' : ''}</div>
        {isDone && findingsCount > 0 && <div className="text-[9px] font-mono text-forensic-green">{findingsCount} findings</div>}
      </div>
      {isActive && (<div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}><motion.div className="h-full rounded-full" style={{ background: color }} animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} /></div>)}
    </motion.div>
  )
}

function ConnectionChip({ state }) {
  const ok = state === 'open', connecting = state === 'connecting'
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono ${ok ? 'bg-forensic-green/10 text-forensic-green border border-forensic-green/30' : connecting ? 'bg-forensic-cyan/10 text-forensic-cyan border border-forensic-cyan/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
      {ok ? <Wifi size={10} /> : connecting ? <Loader2 size={10} className="animate-spin" /> : <WifiOff size={10} />}
      {ok ? 'SSE Live' : connecting ? 'Connecting…' : 'Idle'}
    </div>
  )
}

export default function Agents() {
  const [tab, setTab] = useState('langgraph')
  const [classicData, setClassicData] = useState(null)
  const [classicResult, setClassicResult] = useState(null)
  const [classicLoading, setClassicLoading] = useState(false)
  const [classicRunning, setClassicRunning] = useState(false)
  const [lgStatus, setLgStatus] = useState(null)
  const [caseId, setCaseId] = useState('FTI-2024-0847')
  const [reportText, setReportText] = useState('')
  const [agentStates, setAgentStates] = useState({})
  const [agentFindings, setAgentFindings] = useState({})
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [threadId, setThreadId] = useState(null)
  const [findings, setFindings] = useState([])
  const [correlations, setCorrelations] = useState([])
  const [riskScore, setRiskScore] = useState(null)
  const [riskLevel, setRiskLevel] = useState('UNKNOWN')
  const [riskFactors, setRiskFactors] = useState({})
  const [explanation, setExplanation] = useState('')
  const [leads, setLeads] = useState([])
  const [errors, setErrors] = useState([])
  const [completedCount, setCompletedCount] = useState(0)
  const [interrupted, setInterrupted] = useState(false)
  const [interruptData, setInterruptData] = useState(null)
  const [streamLog, setStreamLog] = useState([])
  const [connectionState, setConnectionState] = useState('idle')
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState('00:00')
  const abortRef = useRef(null)
  const logEndRef = useRef(null)

  useEffect(() => {
    setClassicLoading(true)
    Promise.all([
      api.getAgentsStatus().then(setClassicData).catch(console.error),
      api.getLangGraphStatus().then(setLgStatus).catch(() => setLgStatus({ available: false, error: 'Backend unreachable' })),
    ]).finally(() => setClassicLoading(false))
  }, [])

  useEffect(() => { if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' }) }, [streamLog])

  useEffect(() => {
    if (!running || !startedAt) return
    const timer = setInterval(() => {
      const t = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      setElapsed(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [running, startedAt])

  const resetLg = () => {
    if (abortRef.current) abortRef.current()
    setRunning(false); setDone(false); setThreadId(null); setAgentStates({}); setAgentFindings({})
    setFindings([]); setCorrelations([]); setRiskScore(null); setRiskLevel('UNKNOWN'); setRiskFactors({})
    setExplanation(''); setLeads([]); setErrors([]); setCompletedCount(0)
    setInterrupted(false); setInterruptData(null); setStreamLog([])
    setConnectionState('idle'); setStartedAt(null); setElapsed('00:00')
  }

  const addLog = (msg) => setStreamLog(prev => [...prev.slice(-99), msg])

  const handleEvent = (event) => {
    if (event.type === 'connection') {
      setConnectionState(event.state || 'unknown')
      if (event.state === 'open') addLog('🔌 SSE connected')
      else if (event.state === 'error') addLog(`❌ Connection: ${event.error || 'failed'}`)
      else if (event.state === 'closed') addLog('📡 Stream closed')
      return
    }
    if (event.type === 'thread_id') { setThreadId(event.thread_id); addLog(`🔗 Thread: ${event.thread_id.slice(0, 8)}…`) }
    else if (event.type === 'agent_update') {
      const agent = event.agent
      if (agent === 'phase1_join') {
        addLog('⚡ Phase 1 complete → Phase 2')
        setAgentStates(prev => ({ ...prev, toxicology: prev.toxicology === 'done' ? 'done' : 'running' }))
        return
      }
      setAgentStates(prev => ({ ...prev, [agent]: 'done' }))
      setCompletedCount(c => c + 1)
      const nf = event.new_findings || 0
      if (nf > 0) setAgentFindings(prev => ({ ...prev, [agent]: (prev[agent] || 0) + nf }))
      addLog(`✓ ${agent.toUpperCase()} — ${nf} findings`)
      if (event.risk_score != null) { setRiskScore(event.risk_score); setRiskLevel(event.risk_level || 'UNKNOWN') }
      if (event.errors?.length) setErrors(prev => [...prev, ...event.errors])
      const idx = SEQUENTIAL_ORDER.indexOf(agent)
      if (idx >= 0 && idx + 1 < SEQUENTIAL_ORDER.length) {
        const next = SEQUENTIAL_ORDER[idx + 1]
        setAgentStates(prev => ({ ...prev, [next]: prev[next] === 'done' ? 'done' : 'running' }))
      }
    } else if (event.type === 'interrupt') {
      setInterrupted(true); setInterruptData(event.data?.[0]?.value || {}); setRunning(false); addLog('⏸ HUMAN REVIEW REQUIRED')
    } else if (event.type === 'complete') {
      setDone(true); setRunning(false)
      setRiskScore(event.risk_score ?? riskScore); setRiskLevel(event.risk_level || riskLevel)
      setFindings(event.findings || []); setCorrelations(event.correlations || [])
      setExplanation(event.explanation || ''); setLeads(event.investigative_leads || [])
      setRiskFactors(event.risk_factors || {})
      if (event.errors?.length) setErrors(prev => [...prev, ...event.errors])
      const allDone = {}; LG_AGENTS.forEach(a => { allDone[a.id] = 'done' }); setAgentStates(allDone)
      setCompletedCount(LG_AGENTS.length)
      addLog(`🏁 Complete — Risk: ${event.risk_score}/100 (${event.risk_level})`)
    } else if (event.type === 'error') { setErrors(prev => [...prev, event.error]); setRunning(false); addLog(`❌ ${event.error}`) }
  }

  const launchInvestigation = () => {
    resetLg(); setRunning(true); setStartedAt(Date.now())
    setAgentStates({ autopsy: 'running', timeline: 'running', cctv: 'running' })
    addLog(`🚀 Launching for ${caseId}`); addLog('📊 Phase 1: Autopsy+Timeline+CCTV PARALLEL')
    const abort = api.streamInvestigation({ case_id: caseId, report_text: reportText || undefined }, handleEvent)
    abortRef.current = abort
  }

  const handleHITL = (decision) => {
    setInterrupted(false); setInterruptData(null); setRunning(true)
    addLog(`👤 ${decision.toUpperCase()} — resuming`)
    abortRef.current = api.resumeInvestigation(threadId, decision, handleEvent)
  }

  const runClassicAnalysis = async () => {
    setClassicRunning(true)
    try { setClassicResult(await api.runAgentAnalysis('FTI-2024-0847')) } catch (e) { console.error(e) }
    setClassicRunning(false)
  }

  const progress = Math.round((completedCount / LG_AGENTS.length) * 100)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <h1 className="text-xl font-black text-white flex items-center gap-2 mb-1"><Bot size={20} className="text-forensic-cyan" />FEAT Multi-Agent System</h1>
        <p className="text-xs text-slate-400 font-mono">8 AI agents • Real-time SSE • Human-in-the-Loop</p>
        <div className="flex items-center gap-1.5 mt-3">{LG_AGENTS.map((a, i) => (<div key={a.id} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: a.color, opacity: agentStates[a.id] === 'done' ? 1 : 0.3 }} />{i < LG_AGENTS.length - 1 && <div className="w-3 h-px" style={{ background: agentStates[a.id] === 'done' ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.06)' }} />}</div>))}</div>
      </motion.div>

      <div className="flex gap-1 mb-6 p-1 bg-forensic-bg rounded-xl w-fit">
        {[{ id: 'langgraph', label: 'LangGraph Pipeline', icon: <Activity size={13} /> }, { id: 'classic', label: 'Classic Agents', icon: <Bot size={13} /> }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === t.id ? 'bg-forensic-cyan text-black' : 'text-slate-400 hover:text-white'}`}>{t.icon}{t.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
      {tab === 'langgraph' && (
        <motion.div key="lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {lgStatus && !lgStatus.available && (
            <div className="mb-4 p-3 rounded-xl bg-forensic-amber/10 border border-forensic-amber/30 flex gap-2 items-start">
              <AlertTriangle size={14} className="text-forensic-amber mt-0.5 flex-shrink-0" />
              <div><div className="text-xs font-bold text-forensic-amber">LangGraph not available</div><div className="text-[11px] text-slate-400 font-mono">{lgStatus.error}</div></div>
            </div>
          )}

          {!running && !done && !interrupted && (
            <div className="forensic-card rounded-xl p-5 mb-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Play size={14} className="text-forensic-cyan" />LAUNCH INVESTIGATION</h3>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div><label className="text-[10px] text-slate-400 font-mono uppercase mb-1.5 block">Case ID</label><input value={caseId} onChange={e => setCaseId(e.target.value)} className="w-full bg-forensic-bg border border-forensic-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-forensic-cyan focus:outline-none" /></div>
                <div className="flex items-end"><div className="text-[10px] font-mono">{lgStatus?.available ? <span className="text-forensic-green">● Ready — {lgStatus.agents} agents</span> : <span className="text-slate-500">● Unavailable</span>}</div></div>
              </div>
              <div className="mb-4"><label className="text-[10px] text-slate-400 font-mono uppercase mb-1.5 block">Autopsy Report <span className="text-slate-600">(optional)</span></label><textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={4} placeholder="Paste report or leave empty for demo…" className="w-full bg-forensic-bg border border-forensic-border rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:border-forensic-cyan focus:outline-none resize-none" /></div>
              <button onClick={launchInvestigation} className="px-6 py-2.5 bg-forensic-cyan text-black text-xs font-black rounded-lg hover:bg-forensic-cyan/90 flex items-center gap-2"><Zap size={14} />LAUNCH 8-AGENT INVESTIGATION</button>
            </div>
          )}

          {(running || done || interrupted) && (
            <div className="space-y-5">
              <div className="forensic-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    {running && <Loader2 size={13} className="text-forensic-cyan animate-spin" />}{done && <CheckCircle size={13} className="text-forensic-green" />}{interrupted && <AlertTriangle size={13} className="text-forensic-amber" />}
                    {running ? 'Running…' : done ? 'Complete' : 'Human Review'}
                  </div>
                  <div className="flex items-center gap-3">
                    <ConnectionChip state={connectionState} />
                    <span className="text-[10px] font-mono text-slate-400">{elapsed}</span>
                    {riskScore != null && <span className={`text-sm font-black ${RISK_COLOR[riskLevel]}`}>{riskScore}/100</span>}
                    <button onClick={resetLg} className="text-slate-500 hover:text-white"><RefreshCw size={13} /></button>
                  </div>
                </div>
                <div className="w-full h-2 bg-forensic-bg rounded-full overflow-hidden"><motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #00d4ff, #10b981, #ec4899)' }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} /></div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">{completedCount}/{LG_AGENTS.length} agents • Thread: {threadId?.slice(0, 8) ?? '—'}</div>
              </div>

              <div>
                <div className="text-[10px] font-mono text-blue-300 uppercase mb-2">⚡ Phase 1 — Parallel Evidence Intake</div>
                <div className="grid grid-cols-3 gap-3 mb-2">{LG_AGENTS.filter(a => a.phase === 1).map(a => <LGAgentCard key={a.id} agent={a} state={agentStates[a.id] || 'idle'} findingsCount={agentFindings[a.id] || 0} />)}</div>
                <div className="flex justify-center my-3"><div className={`px-3 py-1 rounded-full text-[9px] font-mono ${LG_AGENTS.filter(a => a.phase === 1).every(a => agentStates[a.id] === 'done') ? 'bg-forensic-green/10 text-forensic-green border border-forensic-green/30' : 'bg-slate-800/50 text-slate-600 border border-slate-700'}`}>{LG_AGENTS.filter(a => a.phase === 1).every(a => agentStates[a.id] === 'done') ? '✓ Phase 1 done' : '⋯ Collecting'}</div></div>
                <div className="text-[10px] font-mono text-purple-300 uppercase mb-2">🔄 Phase 2 — Sequential Analysis</div>
                <div className="grid grid-cols-3 gap-3 mb-2">{LG_AGENTS.filter(a => a.phase === 2).map(a => <LGAgentCard key={a.id} agent={a} state={agentStates[a.id] || 'idle'} findingsCount={agentFindings[a.id] || 0} />)}</div>
                <div className="text-[10px] font-mono text-cyan-300 uppercase mb-2 mt-4">🎯 Phase 3 — Synthesis</div>
                <div className="grid grid-cols-2 gap-3">{LG_AGENTS.filter(a => a.phase === 3).map(a => <LGAgentCard key={a.id} agent={a} state={agentStates[a.id] || 'idle'} findingsCount={agentFindings[a.id] || 0} />)}</div>
              </div>

              <div className="forensic-card rounded-xl p-4 max-h-40 overflow-y-auto">
                <div className="text-[10px] text-slate-500 font-mono uppercase mb-2">Stream Log ({streamLog.length})</div>
                {streamLog.map((msg, i) => <div key={i} className="text-[11px] text-slate-400 font-mono leading-5">{msg}</div>)}
                <div ref={logEndRef} />
              </div>

              {errors.length > 0 && (<div className="forensic-card rounded-xl p-4 border-red-500/30"><div className="text-[10px] text-red-400 font-mono uppercase mb-2 flex items-center gap-1"><XCircle size={10} />Errors ({errors.length})</div>{errors.map((e, i) => <div key={i} className="text-[11px] text-slate-400">{e}</div>)}</div>)}

              {done && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {Object.keys(riskFactors).length > 0 && (
                    <div className="forensic-card rounded-xl p-5"><h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Shield size={14} className="text-forensic-cyan" />RISK BREAKDOWN</h3><div className="space-y-2">{Object.entries(riskFactors).map(([k, v]) => (<div key={k}><div className="flex justify-between text-[11px] mb-1"><span className="text-slate-400 capitalize">{k}</span><span className={`font-bold ${v >= 70 ? 'text-red-400' : v >= 40 ? 'text-forensic-amber' : 'text-forensic-green'}`}>{v}/100</span></div><div className="w-full h-1.5 bg-forensic-bg rounded-full overflow-hidden"><motion.div className={`h-full rounded-full ${v >= 70 ? 'bg-red-400' : v >= 40 ? 'bg-forensic-amber' : 'bg-forensic-green'}`} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ delay: 0.1 }} /></div></div>))}</div></div>
                  )}
                  {findings.length > 0 && (
                    <div className="forensic-card rounded-xl p-5"><h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Eye size={14} className="text-forensic-cyan" />FINDINGS ({findings.length})</h3><div className="space-y-2 max-h-72 overflow-y-auto pr-1">{findings.map((f, i) => (<div key={i} className={`p-2.5 rounded-lg border text-[11px] ${SEV_COLOR[f.severity] || SEV_COLOR.INFO}`}><div className="flex items-center justify-between mb-1"><span className="text-[9px] font-mono text-slate-500 bg-forensic-bg px-1.5 py-0.5 rounded">{f.type}</span><span className="text-[9px] font-mono text-slate-500">{f.agent} • {((f.confidence || 0) * 100).toFixed(0)}%</span></div><div className="text-slate-200">{f.content}</div></div>))}</div></div>
                  )}
                  {correlations.length > 0 && (
                    <div className="forensic-card rounded-xl p-5"><h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Link2 size={14} className="text-forensic-cyan" />CORRELATIONS ({correlations.length})</h3><div className="space-y-2">{correlations.map((c, i) => (<div key={i} className="p-3 rounded-lg bg-forensic-bg border border-forensic-border"><div className="flex items-center gap-2 mb-1 flex-wrap"><span className="text-xs font-bold text-forensic-cyan">{c.source}</span><ChevronRight size={10} className="text-slate-500" /><span className="text-xs font-bold text-white">{c.target}</span><span className={`ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded ${c.type === 'causal' ? 'bg-red-500/20 text-red-300' : c.type === 'temporal' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>{c.type}</span><span className="text-[10px] text-forensic-green">{((c.strength || 0) * 100).toFixed(0)}%</span></div><div className="text-[11px] text-slate-400">{c.description}</div></div>))}</div></div>
                  )}
                  {leads.length > 0 && (<div className="forensic-card rounded-xl p-5 border-forensic-green/30"><h3 className="text-sm font-bold text-forensic-green mb-4 flex items-center gap-2"><Target size={14} />INVESTIGATIVE LEADS</h3><div className="space-y-2">{leads.map((l, i) => <div key={i} className="text-xs text-slate-300 flex items-start gap-2"><ChevronRight size={12} className="text-forensic-green mt-0.5 flex-shrink-0" />{l}</div>)}</div></div>)}
                  {explanation && (<div className="forensic-card rounded-xl p-5"><h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Lightbulb size={14} className="text-forensic-cyan" />AI EXPLANATION</h3><div className="text-xs text-slate-300 leading-6 whitespace-pre-wrap font-mono">{explanation}</div></div>)}
                  <button onClick={resetLg} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-forensic-border text-slate-400 hover:text-white text-xs"><RefreshCw size={13} />New Investigation</button>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {tab === 'classic' && (
        <motion.div key="classic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {classicLoading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-forensic-cyan border-t-transparent rounded-full animate-spin" /></div>
          : classicData && (
            <>
              <div className="forensic-card rounded-xl p-4 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-forensic-green pulse-dot" /><div><div className="text-sm font-bold text-white">FEAT Orchestrator</div><div className="text-[10px] text-slate-400 font-mono">{classicData.orchestrator.coordination_model} • Avg: {classicData.orchestrator.avg_response_time_ms}ms</div></div></div>
                <button onClick={runClassicAnalysis} disabled={classicRunning} className="px-4 py-2 bg-forensic-cyan text-black text-xs font-bold rounded-lg hover:bg-forensic-cyan/90 disabled:opacity-50 flex items-center gap-2">{classicRunning ? <><div className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin" />ANALYZING…</> : <><Zap size={14} />RUN ANALYSIS</>}</button>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                {classicData.agents.map((agent, i) => (
                  <motion.div key={agent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="forensic-card rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3"><div className="w-2 h-2 rounded-full bg-forensic-green pulse-dot" /><span className="text-[10px] font-mono text-forensic-green">{((agent.accuracy || 0) * 100).toFixed(0)}%</span></div>
                    <h3 className="text-sm font-bold text-white mb-1">{agent.name}</h3>
                    <div className="text-[10px] text-slate-400 font-mono mb-3">{agent.model}</div>
                    <div className="flex flex-wrap gap-1 mb-3">{(agent.capabilities || []).slice(0, 3).map(c => <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-forensic-bg border border-forensic-border text-slate-300">{c.replace(/_/g, ' ')}</span>)}{(agent.capabilities || []).length > 3 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-forensic-bg text-slate-500">+{agent.capabilities.length - 3}</span>}</div>
                    <div className="flex items-center justify-between"><div className="text-[10px] text-slate-500">{agent.tasks_completed || 0} tasks</div><div className="text-[9px] text-slate-600 font-mono">{agent.avg_response_ms || 0}ms</div></div>
                  </motion.div>
                ))}
              </div>
              {classicResult && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="forensic-card rounded-xl p-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Zap size={14} className="text-forensic-cyan" />RESULTS</h3>
                    <div className="grid md:grid-cols-4 gap-3 mb-6">
                      <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-forensic-cyan">{classicResult.orchestration.total_agents_invoked}</div><div className="text-[10px] text-slate-400">Agents</div></div>
                      <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-forensic-green">{classicResult.orchestration.execution_time_ms}ms</div><div className="text-[10px] text-slate-400">Time</div></div>
                      <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-forensic-amber">{classicResult.orchestration.parallel_tasks}</div><div className="text-[10px] text-slate-400">Parallel</div></div>
                      <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-white">{(classicResult.consensus.confidence * 100).toFixed(0)}%</div><div className="text-[10px] text-slate-400">Consensus</div></div>
                    </div>
                    {classicResult.agent_outputs.map((out, i) => (<div key={i} className="mb-3 p-3 rounded-lg bg-forensic-bg border border-forensic-border"><div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-white">{out.agent.replace(/_/g, ' ').toUpperCase()}</span><span className="text-[10px] text-forensic-cyan font-mono">{(out.confidence * 100).toFixed(0)}% • {out.processing_time_ms}ms</span></div><div className="space-y-1">{out.findings.map((f, j) => <div key={j} className="text-[11px] text-slate-300 flex items-start gap-1"><Check size={10} className="text-forensic-green mt-0.5 flex-shrink-0" />{f}</div>)}</div></div>))}
                  </div>
                  <div className="forensic-card rounded-xl p-5 border-forensic-green/40">
                    <h3 className="text-sm font-bold text-forensic-green mb-3">🎯 {classicResult.consensus.primary_suspect}</h3>
                    <div className="text-xs text-slate-300 mb-3">Strength: <span className="text-white font-bold">{classicResult.consensus.evidence_strength.toUpperCase()}</span></div>
                    <div className="space-y-1">{classicResult.consensus.recommended_actions.map((a, i) => <div key={i} className="text-xs text-slate-300 pl-3 border-l-2 border-forensic-green/40">{a}</div>)}</div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      )}
      </AnimatePresence>
      <AnimatePresence>{interrupted && interruptData && <HITLModal data={interruptData} onDecide={handleHITL} />}</AnimatePresence>
    </div>
  )
}
