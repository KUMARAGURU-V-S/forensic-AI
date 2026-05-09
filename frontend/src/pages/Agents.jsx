import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Zap, Check, AlertTriangle, Play, RefreshCw,
  Activity, Shield, Eye, Clock, Link2, Lightbulb,
  Target, ChevronRight, XCircle, CheckCircle, Loader2,
} from 'lucide-react'
import { api } from '../lib/api'

// ─── LangGraph agent definitions ─────────────────────────────────────────────
const LG_AGENTS = [
  { id: 'autopsy',        name: 'Autopsy',        icon: '🔬', model: 'Gemini 2.0 Flash',   phase: 1, desc: 'Injuries, COD, toxicology' },
  { id: 'timeline',       name: 'Timeline',       icon: '📅', model: 'Deterministic',       phase: 1, desc: 'Gap detection, clustering' },
  { id: 'cctv',           name: 'CCTV',           icon: '📷', model: 'Gemini 2.0 Flash',   phase: 1, desc: 'Person/vehicle/weapon' },
  { id: 'toxicology',     name: 'Toxicology',     icon: '🧪', model: 'Featherless LLM',    phase: 2, desc: 'Drug interactions, dosing' },
  { id: 'correlation',    name: 'Correlation',    icon: '🔗', model: 'Featherless + Local', phase: 2, desc: 'Cross-evidence links' },
  { id: 'risk',           name: 'Risk Scoring',   icon: '⚠️', model: 'Deterministic',       phase: 2, desc: 'Weighted risk score' },
  { id: 'explainability', name: 'Explainability', icon: '💡', model: 'Featherless LLM',    phase: 3, desc: 'SHAP-style reasoning' },
  { id: 'leads',          name: 'Lead Generator', icon: '🎯', model: 'Deterministic',       phase: 3, desc: 'Investigative actions' },
]

const RISK_COLOR = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-forensic-amber',
  MODERATE: 'text-yellow-400',
  LOW: 'text-forensic-green',
  UNKNOWN: 'text-slate-400',
}

const SEV_COLOR = {
  CRITICAL: 'border-red-500/40 bg-red-500/5',
  HIGH: 'border-forensic-amber/40 bg-forensic-amber/5',
  MODERATE: 'border-yellow-500/30 bg-yellow-500/5',
  INFO: 'border-slate-600 bg-slate-800/30',
}

// ─── Human-in-the-Loop modal ──────────────────────────────────────────────────
function HITLModal({ data, onDecide }) {
  const { message, risk_score, risk_level, top_findings } = data
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg mx-4 forensic-card rounded-2xl p-6 border-forensic-amber/50"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-forensic-amber flex-shrink-0" />
          <h2 className="text-sm font-black text-white">HUMAN REVIEW REQUIRED</h2>
        </div>
        <p className="text-xs text-forensic-amber font-mono mb-4">{message}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-2 rounded-lg bg-forensic-bg text-center">
            <div className={`text-lg font-black ${RISK_COLOR[risk_level] || 'text-white'}`}>{risk_score}/100</div>
            <div className="text-[10px] text-slate-400">Risk Score</div>
          </div>
          <div className="p-2 rounded-lg bg-forensic-bg text-center">
            <div className={`text-lg font-black ${RISK_COLOR[risk_level] || 'text-white'}`}>{risk_level}</div>
            <div className="text-[10px] text-slate-400">Risk Level</div>
          </div>
        </div>
        {top_findings?.length > 0 && (
          <div className="mb-5">
            <div className="text-[10px] text-slate-500 font-mono uppercase mb-2">Critical Findings</div>
            <div className="space-y-1">
              {top_findings.map((f, i) => (
                <div key={i} className="text-xs text-slate-300 flex gap-2">
                  <span className="text-red-400 flex-shrink-0">▸</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => onDecide('approve')}
            className="py-2 rounded-lg bg-forensic-green/20 border border-forensic-green/40 text-forensic-green text-xs font-bold hover:bg-forensic-green/30">
            ✓ Approve
          </button>
          <button onClick={() => onDecide('escalate')}
            className="py-2 rounded-lg bg-forensic-amber/20 border border-forensic-amber/40 text-forensic-amber text-xs font-bold hover:bg-forensic-amber/30">
            ↑ Escalate
          </button>
          <button onClick={() => onDecide('reject')}
            className="py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/30">
            ✗ Reject
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Single LangGraph agent card ─────────────────────────────────────────────
function LGAgentCard({ agent, state }) {
  const { id, name, icon, model, desc, phase } = agent
  const isActive = state === 'running'
  const isDone = state === 'done'

  return (
    <div className={`forensic-card rounded-xl p-3 border transition-all duration-500 ${
      isDone ? 'border-forensic-green/40 bg-forensic-green/5' :
      isActive ? 'border-forensic-cyan/50 bg-forensic-cyan/5' :
      'border-forensic-border'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-lg leading-none">{icon}</span>
        {isDone  ? <CheckCircle size={14} className="text-forensic-green" /> :
         isActive ? <Loader2 size={14} className="text-forensic-cyan animate-spin" /> :
                    <div className="w-3 h-3 rounded-full bg-slate-700" />}
      </div>
      <div className="text-xs font-bold text-white mb-0.5">{name}</div>
      <div className="text-[9px] text-slate-500 font-mono mb-1">{model}</div>
      <div className="text-[9px] text-slate-400">{desc}</div>
      <div className={`mt-2 text-[8px] font-mono px-1.5 py-0.5 rounded inline-block ${
        phase === 1 ? 'bg-blue-500/20 text-blue-300' :
        phase === 2 ? 'bg-purple-500/20 text-purple-300' :
                      'bg-forensic-cyan/20 text-forensic-cyan'
      }`}>Phase {phase}</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Agents() {
  const [tab, setTab] = useState('langgraph')

  // ── Classic mode state ──
  const [classicData, setClassicData] = useState(null)
  const [classicResult, setClassicResult] = useState(null)
  const [classicLoading, setClassicLoading] = useState(false)
  const [classicRunning, setClassicRunning] = useState(false)

  // ── LangGraph mode state ──
  const [lgStatus, setLgStatus] = useState(null)
  const [caseId, setCaseId] = useState('FTI-2024-0847')
  const [reportText, setReportText] = useState('')
  const [agentStates, setAgentStates] = useState({}) // { agentId: 'idle'|'running'|'done' }
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
  const abortRef = useRef(null)
  const logEndRef = useRef(null)

  useEffect(() => {
    // Load classic agent status and LangGraph availability in parallel
    setClassicLoading(true)
    Promise.all([
      api.getAgentsStatus().then(setClassicData).catch(console.error),
      api.getLangGraphStatus().then(setLgStatus).catch(() => setLgStatus({ available: false, error: 'Backend unreachable' })),
    ]).finally(() => setClassicLoading(false))
  }, [])

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [streamLog])

  const resetLg = () => {
    if (abortRef.current) abortRef.current()
    setRunning(false); setDone(false); setThreadId(null)
    setAgentStates({}); setFindings([]); setCorrelations([])
    setRiskScore(null); setRiskLevel('UNKNOWN'); setRiskFactors({})
    setExplanation(''); setLeads([]); setErrors([])
    setCompletedCount(0); setInterrupted(false); setInterruptData(null)
    setStreamLog([])
  }

  const addLog = (msg) => setStreamLog(prev => [...prev.slice(-49), msg])

  const handleEvent = (event) => {
    if (event.type === 'thread_id') {
      setThreadId(event.thread_id)
      addLog(`🔗 Thread: ${event.thread_id.slice(0, 8)}…`)
    } else if (event.type === 'agent_update') {
      const agent = event.agent
      if (agent === 'phase1_join') {
        addLog('⚡ Phase 1 complete — starting correlation & risk analysis')
        return
      }
      setAgentStates(prev => ({ ...prev, [agent]: 'done' }))
      setCompletedCount(c => c + 1)
      const newFindings = event.new_findings || 0
      const newCorrs = event.new_correlations || 0
      addLog(`✓ ${agent.toUpperCase()} — ${newFindings} findings, ${newCorrs} correlations`)
      if (event.risk_score != null) {
        setRiskScore(event.risk_score)
        setRiskLevel(event.risk_level || 'UNKNOWN')
      }
      if (event.errors?.length) setErrors(prev => [...prev, ...event.errors])

      // Mark next agent as running (heuristic based on graph order)
      const order = ['autopsy', 'timeline', 'cctv', 'toxicology', 'correlation', 'risk', 'explainability', 'leads']
      const idx = order.indexOf(agent)
      if (idx >= 0 && idx + 1 < order.length) {
        setAgentStates(prev => ({ ...prev, [order[idx + 1]]: prev[order[idx + 1]] === 'done' ? 'done' : 'running' }))
      }
    } else if (event.type === 'interrupt') {
      const payload = event.data?.[0]?.value || {}
      setInterrupted(true)
      setInterruptData(payload)
      setRunning(false)
      addLog('⏸ HUMAN REVIEW REQUIRED — investigation paused')
    } else if (event.type === 'complete') {
      setDone(true); setRunning(false)
      setRiskScore(event.risk_score ?? riskScore)
      setRiskLevel(event.risk_level || riskLevel)
      setFindings(event.findings || [])
      setCorrelations(event.correlations || [])
      setExplanation(event.explanation || '')
      setLeads(event.investigative_leads || [])
      setRiskFactors(event.risk_factors || {})
      if (event.errors?.length) setErrors(prev => [...prev, ...event.errors])
      // mark all agents done
      const allDone = {}
      LG_AGENTS.forEach(a => { allDone[a.id] = 'done' })
      setAgentStates(allDone)
      addLog(`🏁 Investigation complete — Risk: ${event.risk_score}/100 (${event.risk_level})`)
    } else if (event.type === 'error') {
      setErrors(prev => [...prev, event.error])
      setRunning(false)
      addLog(`❌ Error: ${event.error}`)
    }
  }

  const launchInvestigation = () => {
    resetLg()
    setRunning(true)
    // Mark phase-1 agents as running immediately
    setAgentStates({ autopsy: 'running', timeline: 'running', cctv: 'running' })
    addLog(`🚀 Launching 8-agent investigation for case ${caseId}`)

    const abort = api.streamInvestigation(
      { case_id: caseId, report_text: reportText || undefined },
      handleEvent,
    )
    abortRef.current = abort
  }

  const handleHITL = (decision) => {
    setInterrupted(false); setInterruptData(null)
    setRunning(true)
    addLog(`👤 Human decision: ${decision.toUpperCase()} — resuming pipeline`)
    const abort = api.resumeInvestigation(threadId, decision, handleEvent)
    abortRef.current = abort
  }

  // ─── Classic mode ─────────────────────────────────────────────────────────
  const runClassicAnalysis = async () => {
    setClassicRunning(true)
    try { const r = await api.runAgentAnalysis('FTI-2024-0847'); setClassicResult(r) } catch (e) { console.error(e) }
    setClassicRunning(false)
  }

  const totalPhase1Done = ['autopsy', 'timeline', 'cctv'].filter(id => agentStates[id] === 'done').length
  const pipelineProgress = Math.round((completedCount / LG_AGENTS.length) * 100)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <h1 className="text-xl font-black text-white flex items-center gap-2 mb-1">
          <Bot size={20} className="text-forensic-cyan" />FEAT Multi-Agent System
        </h1>
        <p className="text-xs text-slate-400 font-mono">Forensic Evidence Analysis & Triage — 8 specialized AI agents</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-forensic-bg rounded-xl w-fit">
        {[
          { id: 'langgraph', label: 'LangGraph Pipeline', icon: <Activity size={13} /> },
          { id: 'classic',   label: 'Classic Agents',    icon: <Bot size={13} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.id ? 'bg-forensic-cyan text-black' : 'text-slate-400 hover:text-white'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ═══ LANGGRAPH TAB ═══════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
      {tab === 'langgraph' && (
        <motion.div key="lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

          {/* LangGraph availability banner */}
          {lgStatus && !lgStatus.available && (
            <div className="mb-4 p-3 rounded-xl bg-forensic-amber/10 border border-forensic-amber/30 flex gap-2 items-start">
              <AlertTriangle size={14} className="text-forensic-amber mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-forensic-amber">LangGraph not installed</div>
                <div className="text-[11px] text-slate-400 font-mono">{lgStatus.error}</div>
                <div className="text-[11px] text-slate-500 mt-1">Run: <code className="text-forensic-cyan">pip install -r langgraph-agents/requirements.txt</code></div>
              </div>
            </div>
          )}

          {/* Input panel */}
          {!running && !done && (
            <div className="forensic-card rounded-xl p-5 mb-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Play size={14} className="text-forensic-cyan" />LAUNCH INVESTIGATION
              </h3>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] text-slate-400 font-mono uppercase mb-1.5 block">Case ID</label>
                  <input value={caseId} onChange={e => setCaseId(e.target.value)}
                    className="w-full bg-forensic-bg border border-forensic-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-forensic-cyan focus:outline-none" />
                </div>
                <div className="flex items-end">
                  <div className="text-[10px] text-slate-500 font-mono">
                    {lgStatus?.available
                      ? <span className="text-forensic-green">● LangGraph ready — {lgStatus.agents} agents</span>
                      : <span className="text-slate-500">● LangGraph unavailable — install deps first</span>}
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-[10px] text-slate-400 font-mono uppercase mb-1.5 block">
                  Autopsy Report Text <span className="text-slate-600">(optional — agents use demo data if empty)</span>
                </label>
                <textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={4}
                  placeholder="Paste autopsy report text here, or leave empty to run with demo evidence..."
                  className="w-full bg-forensic-bg border border-forensic-border rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:border-forensic-cyan focus:outline-none resize-none" />
              </div>
              <button onClick={launchInvestigation}
                className="px-6 py-2.5 bg-forensic-cyan text-black text-xs font-black rounded-lg hover:bg-forensic-cyan/90 flex items-center gap-2">
                <Zap size={14} />LAUNCH 8-AGENT INVESTIGATION
              </button>
            </div>
          )}

          {/* Active / Done — pipeline visualization */}
          {(running || done || interrupted) && (
            <div className="space-y-5">
              {/* Progress bar */}
              <div className="forensic-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    {running && <Loader2 size={13} className="text-forensic-cyan animate-spin" />}
                    {done   && <CheckCircle size={13} className="text-forensic-green" />}
                    {interrupted && <AlertTriangle size={13} className="text-forensic-amber" />}
                    {running ? 'Investigation Running…' : done ? 'Investigation Complete' : 'Awaiting Human Review'}
                  </div>
                  <div className="flex items-center gap-3">
                    {riskScore != null && (
                      <span className={`text-sm font-black ${RISK_COLOR[riskLevel]}`}>{riskScore}/100 {riskLevel}</span>
                    )}
                    <button onClick={resetLg} className="text-slate-500 hover:text-white">
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 bg-forensic-bg rounded-full overflow-hidden">
                  <motion.div className="h-full bg-forensic-cyan rounded-full"
                    animate={{ width: `${pipelineProgress}%` }} transition={{ duration: 0.5 }} />
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">{completedCount}/{LG_AGENTS.length} agents • Thread: {threadId?.slice(0, 8) ?? '—'}</div>
              </div>

              {/* Agent grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {LG_AGENTS.map(agent => (
                  <LGAgentCard key={agent.id} agent={agent} state={agentStates[agent.id] || 'idle'} />
                ))}
              </div>

              {/* Stream log */}
              <div className="forensic-card rounded-xl p-4 max-h-36 overflow-y-auto">
                <div className="text-[10px] text-slate-500 font-mono uppercase mb-2">Stream Log</div>
                {streamLog.map((msg, i) => (
                  <div key={i} className="text-[11px] text-slate-400 font-mono leading-5">{msg}</div>
                ))}
                <div ref={logEndRef} />
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="forensic-card rounded-xl p-4 border-red-500/30">
                  <div className="text-[10px] text-red-400 font-mono uppercase mb-2 flex items-center gap-1"><XCircle size={10} />Errors ({errors.length})</div>
                  {errors.map((e, i) => <div key={i} className="text-[11px] text-slate-400">{e}</div>)}
                </div>
              )}

              {/* ─── Final results (shown when done) ─── */}
              {done && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                  {/* Risk factors */}
                  {Object.keys(riskFactors).length > 0 && (
                    <div className="forensic-card rounded-xl p-5">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Shield size={14} className="text-forensic-cyan" />RISK BREAKDOWN</h3>
                      <div className="space-y-2">
                        {Object.entries(riskFactors).map(([k, v]) => (
                          <div key={k}>
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-slate-400 capitalize">{k}</span>
                              <span className={`font-bold ${v >= 70 ? 'text-red-400' : v >= 40 ? 'text-forensic-amber' : 'text-forensic-green'}`}>{v}/100</span>
                            </div>
                            <div className="w-full h-1.5 bg-forensic-bg rounded-full overflow-hidden">
                              <motion.div className={`h-full rounded-full ${v >= 70 ? 'bg-red-400' : v >= 40 ? 'bg-forensic-amber' : 'bg-forensic-green'}`}
                                initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ delay: 0.1 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Findings */}
                  {findings.length > 0 && (
                    <div className="forensic-card rounded-xl p-5">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Eye size={14} className="text-forensic-cyan" />FINDINGS ({findings.length})</h3>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {findings.map((f, i) => (
                          <div key={i} className={`p-2.5 rounded-lg border text-[11px] ${SEV_COLOR[f.severity] || SEV_COLOR.INFO}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-mono text-slate-500 bg-forensic-bg px-1.5 py-0.5 rounded">{f.type}</span>
                              <span className="text-[9px] font-mono text-slate-500">{f.agent} • {((f.confidence || 0) * 100).toFixed(0)}%</span>
                            </div>
                            <div className="text-slate-200">{f.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Correlations */}
                  {correlations.length > 0 && (
                    <div className="forensic-card rounded-xl p-5">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Link2 size={14} className="text-forensic-cyan" />CORRELATIONS ({correlations.length})</h3>
                      <div className="space-y-2">
                        {correlations.map((c, i) => (
                          <div key={i} className="p-3 rounded-lg bg-forensic-bg border border-forensic-border">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-bold text-forensic-cyan">{c.source}</span>
                              <ChevronRight size={10} className="text-slate-500" />
                              <span className="text-xs font-bold text-white">{c.target}</span>
                              <span className={`ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded ${c.type === 'causal' ? 'bg-red-500/20 text-red-300' : c.type === 'temporal' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>{c.type}</span>
                              <span className="text-[10px] text-forensic-green">{((c.strength || 0) * 100).toFixed(0)}%</span>
                            </div>
                            <div className="text-[11px] text-slate-400">{c.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Investigative leads */}
                  {leads.length > 0 && (
                    <div className="forensic-card rounded-xl p-5 border-forensic-green/30">
                      <h3 className="text-sm font-bold text-forensic-green mb-4 flex items-center gap-2"><Target size={14} />INVESTIGATIVE LEADS</h3>
                      <div className="space-y-2">
                        {leads.map((lead, i) => (
                          <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                            <ChevronRight size={12} className="text-forensic-green mt-0.5 flex-shrink-0" />
                            {lead}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  {explanation && (
                    <div className="forensic-card rounded-xl p-5">
                      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Lightbulb size={14} className="text-forensic-cyan" />AI EXPLANATION</h3>
                      <div className="text-xs text-slate-300 leading-6 whitespace-pre-wrap font-mono">{explanation}</div>
                    </div>
                  )}

                  {/* Re-run button */}
                  <button onClick={resetLg}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-forensic-border text-slate-400 hover:text-white text-xs">
                    <RefreshCw size={13} />New Investigation
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ CLASSIC TAB ═════════════════════════════════════════════════════ */}
      {tab === 'classic' && (
        <motion.div key="classic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {classicLoading
            ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-forensic-cyan border-t-transparent rounded-full animate-spin" /></div>
            : classicData && (
              <>
                {/* Orchestrator */}
                <div className="forensic-card rounded-xl p-4 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-forensic-green pulse-dot" />
                    <div>
                      <div className="text-sm font-bold text-white">FEAT Orchestrator</div>
                      <div className="text-[10px] text-slate-400 font-mono">{classicData.orchestrator.coordination_model} • Avg: {classicData.orchestrator.avg_response_time_ms}ms</div>
                    </div>
                  </div>
                  <button onClick={runClassicAnalysis} disabled={classicRunning}
                    className="px-4 py-2 bg-forensic-cyan text-black text-xs font-bold rounded-lg hover:bg-forensic-cyan/90 disabled:opacity-50 flex items-center gap-2">
                    {classicRunning ? <><div className="w-3 h-3 border border-black border-t-transparent rounded-full animate-spin" />ANALYZING…</> : <><Zap size={14} />RUN ANALYSIS</>}
                  </button>
                </div>

                {/* Agent grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                  {classicData.agents.map((agent, i) => (
                    <motion.div key={agent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="forensic-card rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-2 h-2 rounded-full bg-forensic-green pulse-dot" />
                        <span className="text-[10px] font-mono text-forensic-green">{(agent.accuracy * 100).toFixed(0)}%</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1">{agent.name}</h3>
                      <div className="text-[10px] text-slate-400 font-mono mb-3">{agent.model}</div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.capabilities.slice(0, 3).map(c => (
                          <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-forensic-bg border border-forensic-border text-slate-300">{c.replace(/_/g, ' ')}</span>
                        ))}
                        {agent.capabilities.length > 3 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-forensic-bg text-slate-500">+{agent.capabilities.length - 3}</span>}
                      </div>
                      <div className="text-[10px] text-slate-500">{agent.tasks_completed} tasks completed</div>
                    </motion.div>
                  ))}
                </div>

                {/* Classic results */}
                {classicResult && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="forensic-card rounded-xl p-5">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Zap size={14} className="text-forensic-cyan" />MULTI-AGENT ANALYSIS RESULTS</h3>
                      <div className="grid md:grid-cols-4 gap-3 mb-6">
                        <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-forensic-cyan">{classicResult.orchestration.total_agents_invoked}</div><div className="text-[10px] text-slate-400">Agents Used</div></div>
                        <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-forensic-green">{classicResult.orchestration.execution_time_ms}ms</div><div className="text-[10px] text-slate-400">Total Time</div></div>
                        <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-forensic-amber">{classicResult.orchestration.parallel_tasks}</div><div className="text-[10px] text-slate-400">Parallel Tasks</div></div>
                        <div className="text-center p-3 rounded-lg bg-forensic-bg"><div className="text-xl font-black text-white">{(classicResult.consensus.confidence * 100).toFixed(0)}%</div><div className="text-[10px] text-slate-400">Consensus</div></div>
                      </div>
                      {classicResult.agent_outputs.map((out, i) => (
                        <div key={i} className="mb-3 p-3 rounded-lg bg-forensic-bg border border-forensic-border">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-white">{out.agent.replace(/_/g, ' ').toUpperCase()}</span>
                            <span className="text-[10px] text-forensic-cyan font-mono">{(out.confidence * 100).toFixed(0)}% • {out.processing_time_ms}ms</span>
                          </div>
                          <div className="space-y-1">{out.findings.map((f, j) => <div key={j} className="text-[11px] text-slate-300 flex items-start gap-1"><Check size={10} className="text-forensic-green mt-0.5 flex-shrink-0" />{f}</div>)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="forensic-card rounded-xl p-5 border-forensic-green/40">
                      <h3 className="text-sm font-bold text-forensic-green mb-3">🎯 CONSENSUS: {classicResult.consensus.primary_suspect}</h3>
                      <div className="text-xs text-slate-300 mb-3">Evidence Strength: <span className="text-white font-bold">{classicResult.consensus.evidence_strength.toUpperCase()}</span></div>
                      <div className="space-y-1">{classicResult.consensus.recommended_actions.map((a, i) => <div key={i} className="text-xs text-slate-300 pl-3 border-l-2 border-forensic-green/40">{a}</div>)}</div>
                    </div>
                  </motion.div>
                )}
              </>
            )
          }
        </motion.div>
      )}
      </AnimatePresence>

      {/* Human-in-the-loop modal */}
      <AnimatePresence>
        {interrupted && interruptData && (
          <HITLModal data={interruptData} onDecide={handleHITL} />
        )}
      </AnimatePresence>
    </div>
  )
}
