import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Zap, Check, AlertTriangle, Play, RefreshCw,
  Activity, Shield, Eye, Clock, Link2, Lightbulb,
  Target, ChevronRight, XCircle, CheckCircle, Loader2,
  Wifi, WifiOff, Cpu, BarChart3, TrendingUp, Server,
  ArrowRight, Brain, Layers, Radio, CircleDot, Gauge,
} from 'lucide-react'
import { api } from '../lib/api'

// ═══ AGENT DEFINITIONS ═══════════════════════════════════════════════════════

const AGENTS = [
  { id: 'autopsy',        abbr: 'Auto', name: 'Autopsy Analysis',               icon: '🔬', color: '#ef4444', desc: 'Extracts medical findings, pathology, injuries, and cause-of-death insights.' },
  { id: 'timeline',       abbr: 'Time', name: 'Timeline Reconstruction',        icon: '📅', color: '#00d4ff', desc: 'Reconstructs event timelines, detects gaps, and estimates time-of-death.' },
  { id: 'cctv',           abbr: 'CCTV', name: 'CCTV & Video Intelligence',      icon: '📷', color: '#8b5cf6', desc: 'Analyzes video frames, detects persons, vehicles, weapons, and behaviors.' },
  { id: 'toxicology',     abbr: 'Toxi', name: 'Toxicology Analysis',            icon: '🧪', color: '#10b981', desc: 'Detects substances, dosages, interactions, and toxicological implications.' },
  { id: 'correlation',    abbr: 'Corr', name: 'Evidence Correlation',           icon: '🔗', color: '#f59e0b', desc: 'Links people, places, objects, and events across all evidence sources.' },
  { id: 'risk',           abbr: 'Risk', name: 'Risk Scoring & Anomaly Detection', icon: '⚠️', color: '#f97316', desc: 'Computes multi-factor risk scores and flags critical anomalies.' },
  { id: 'explainability', abbr: 'Expl', name: 'Explainability & Reasoning',     icon: '💡', color: '#06b6d4', desc: 'Generates transparent SHAP-style reasoning and decision explanations.' },
  { id: 'leads',          abbr: 'Lead', name: 'Lead Prioritization & Briefing', icon: '🎯', color: '#ec4899', desc: 'Prioritizes investigative leads and delivers actionable intelligence.' },
]

const SEQUENTIAL_ORDER = ['toxicology', 'correlation', 'risk', 'explainability', 'leads']

const WORKFLOW_STEPS = [
  { title: 'Ingest Evidence', desc: 'Upload forensic data from multiple sources — autopsy reports, CCTV, toxicology, digital evidence.' },
  { title: 'Agents Collaborate', desc: '8 specialized AI agents analyze, correlate, and share insights in real time via LangGraph.' },
  { title: 'Confidence Rises', desc: 'Consensus builds as agents validate and refine findings together across phases.' },
  { title: 'Leads Prioritized', desc: 'High-value investigative leads are surfaced and ranked by risk and relevance.' },
  { title: 'Actionable Briefs', desc: 'Investigators receive clear, explainable, and actionable forensic intelligence.' },
]

const RISK_COLOR = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MODERATE: '#eab308', LOW: '#10b981', UNKNOWN: '#64748b' }

// ═══ UTILITIES ═══════════════════════════════════════════════════════════════

const riskColor = (score) => score >= 80 ? '#ef4444' : score >= 60 ? '#f59e0b' : score >= 40 ? '#eab308' : '#10b981'
const riskLabel = (score) => score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MODERATE' : 'LOW'

// ═══ COMPONENTS ══════════════════════════════════════════════════════════════

function GlassCard({ children, className = '', style = {}, glow = null }) {
  return (
    <div className={`rounded-2xl backdrop-blur-sm ${className}`}
      style={{
        background: 'rgba(7,13,28,0.85)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: glow ? `0 0 30px ${glow}15, inset 0 1px 0 rgba(255,255,255,0.05)` : 'inset 0 1px 0 rgba(255,255,255,0.05)',
        ...style,
      }}>
      {children}
    </div>
  )
}

function StatusBadge({ status, color }) {
  const isRunning = status === 'running' || status === 'Processing'
  const isDone = status === 'done' || status === 'Complete'
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <div className="w-2 h-2 rounded-full" style={{ background: isDone ? '#10b981' : isRunning ? color : '#475569' }} />
        {isRunning && <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ background: color, opacity: 0.4 }} />}
      </div>
      <span className="text-[9px] font-mono uppercase" style={{ color: isDone ? '#10b981' : isRunning ? color : '#64748b' }}>
        {isDone ? 'Complete' : isRunning ? 'Running' : status || 'Queued'}
      </span>
    </div>
  )
}

// ═══ ORCHESTRATOR GRAPH (Central visualization) ══════════════════════════════

function OrchestratorGraph({ agentStates, agentFindings }) {
  const size = 380
  const cx = size / 2, cy = size / 2
  const orbitR = 140
  const hubR = 38

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* SVG connections */}
      <svg className="absolute inset-0" width={size} height={size} style={{ zIndex: 0 }}>
        <defs>
          <filter id="glow-line"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {AGENTS.map((agent, i) => {
          const angle = (i / AGENTS.length) * 2 * Math.PI - Math.PI / 2
          const x = cx + orbitR * Math.cos(angle)
          const y = cy + orbitR * Math.sin(angle)
          const isActive = agentStates[agent.id] === 'running' || agentStates[agent.id] === 'done'
          return (
            <g key={agent.id}>
              <line x1={cx} y1={cy} x2={x} y2={y}
                stroke={isActive ? agent.color : 'rgba(255,255,255,0.06)'}
                strokeWidth={isActive ? 1.5 : 0.5}
                strokeDasharray={agentStates[agent.id] === 'running' ? '4 4' : 'none'}
                filter={isActive ? 'url(#glow-line)' : 'none'}
                opacity={isActive ? 0.7 : 0.3} />
              {agentStates[agent.id] === 'running' && (
                <circle r="3" fill={agent.color} opacity="0.9" filter="url(#glow-line)">
                  <animateMotion dur="2s" repeatCount="indefinite" path={`M${cx},${cy} L${x},${y}`} />
                </circle>
              )}
            </g>
          )
        })}
      </svg>

      {/* Central hub */}
      <div className="absolute flex items-center justify-center rounded-full z-10"
        style={{
          width: hubR * 2, height: hubR * 2,
          left: cx - hubR, top: cy - hubR,
          background: 'radial-gradient(circle, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.03) 70%)',
          border: '1.5px solid rgba(0,212,255,0.4)',
          boxShadow: '0 0 30px rgba(0,212,255,0.2), inset 0 0 20px rgba(0,212,255,0.1)',
        }}>
        <div className="text-center">
          <Brain size={16} className="mx-auto mb-0.5" style={{ color: '#00d4ff' }} />
          <div className="text-[7px] font-black text-white tracking-wider">FEAT</div>
          <div className="text-[6px] text-cyan-400 font-mono">ORCHESTRATOR</div>
        </div>
      </div>

      {/* Agent nodes */}
      {AGENTS.map((agent, i) => {
        const angle = (i / AGENTS.length) * 2 * Math.PI - Math.PI / 2
        const x = cx + orbitR * Math.cos(angle) - 24
        const y = cy + orbitR * Math.sin(angle) - 24
        const state = agentStates[agent.id] || 'idle'
        const isDone = state === 'done'
        const isRunning = state === 'running'
        const findings = agentFindings[agent.id] || 0

        return (
          <motion.div key={agent.id}
            className="absolute flex flex-col items-center justify-center rounded-xl z-20"
            animate={{
              boxShadow: isRunning ? `0 0 20px ${agent.color}40` : isDone ? `0 0 12px rgba(16,185,129,0.3)` : 'none',
              borderColor: isDone ? 'rgba(16,185,129,0.5)' : isRunning ? `${agent.color}60` : 'rgba(255,255,255,0.08)',
            }}
            style={{
              width: 48, height: 48,
              left: x, top: y,
              background: isDone ? 'rgba(16,185,129,0.08)' : isRunning ? `${agent.color}10` : 'rgba(7,13,28,0.9)',
              border: `1px solid ${isDone ? 'rgba(16,185,129,0.5)' : isRunning ? `${agent.color}60` : 'rgba(255,255,255,0.08)'}`,
            }}>
            <span className="text-sm leading-none">{agent.icon}</span>
            <div className="text-[7px] font-bold text-white mt-0.5">{agent.abbr}</div>
            {isRunning && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <motion.div className="h-full rounded-full" style={{ background: agent.color, width: '40%' }}
                  animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
              </div>
            )}
            {isDone && <CheckCircle size={8} className="absolute -top-1 -right-1 text-green-400" />}
          </motion.div>
        )
      })}
    </div>
  )
}

// ═══ LIVE EVENT STREAM ═══════════════════════════════════════════════════════

function LiveEventStream({ streamLog }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [streamLog])

  return (
    <GlassCard className="p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio size={12} className="text-green-400" />
          <span className="text-[10px] font-black text-white uppercase tracking-wider">Live Event Stream</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[8px] font-bold text-green-400">LIVE</span>
        </div>
      </div>
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
        {streamLog.length === 0 && <div className="text-[10px] text-slate-600 font-mono text-center py-6">Waiting for investigation launch…</div>}
        {streamLog.map((msg, i) => (
          <div key={i} className="text-[10px] font-mono text-slate-400 leading-relaxed flex gap-2">
            <span className="text-slate-600 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
            <span>{msg}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </GlassCard>
  )
}

// ═══ PERFORMANCE METRICS ═════════════════════════════════════════════════════

function PerformanceMetrics({ completedCount, elapsed, findings, correlations }) {
  const metrics = [
    { label: 'Agents Closed', value: `${completedCount}/8`, color: '#00d4ff' },
    { label: 'Elapsed', value: elapsed, color: '#8b5cf6' },
    { label: 'Findings', value: findings, color: '#10b981' },
    { label: 'Correlations', value: correlations, color: '#f59e0b' },
  ]
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={12} className="text-purple-400" />
        <span className="text-[10px] font-black text-white uppercase tracking-wider">Performance</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map(m => (
          <div key={m.label} className="p-2 rounded-lg" style={{ background: `${m.color}08`, border: `1px solid ${m.color}20` }}>
            <div className="text-base font-black" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[8px] text-slate-500 font-mono mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

// ═══ AGENT HEALTH CARDS ══════════════════════════════════════════════════════

function AgentHealthStrip({ agentStates, agentFindings }) {
  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
      {AGENTS.map(agent => {
        const state = agentStates[agent.id] || 'idle'
        const isDone = state === 'done'
        const isRunning = state === 'running'
        return (
          <GlassCard key={agent.id} className="p-2.5 text-center" glow={isRunning ? agent.color : isDone ? '#10b981' : null}>
            <span className="text-lg leading-none">{agent.icon}</span>
            <div className="text-[9px] font-bold text-white mt-1">{agent.abbr}</div>
            <StatusBadge status={state} color={agent.color} />
            <div className="text-[8px] font-mono mt-1" style={{ color: isDone ? '#10b981' : '#475569' }}>
              {agentFindings[agent.id] || 0} finds
            </div>
          </GlassCard>
        )
      })}
    </div>
  )
}

// ═══ EXPLANATION TRAIL ════════════════════════════════════════════════════════

function ExplanationTrail({ agentStates }) {
  const steps = AGENTS.map((a, i) => ({ ...a, step: i + 1, done: agentStates[a.id] === 'done' }))
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers size={12} className="text-cyan-400" />
        <span className="text-[10px] font-black text-white uppercase tracking-wider">Investigation Trace</span>
      </div>
      <div className="space-y-1">
        {steps.map(s => (
          <div key={s.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${s.done ? 'bg-white/[0.02]' : ''}`}>
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
              style={{ background: s.done ? `${s.color}20` : 'rgba(255,255,255,0.03)', color: s.done ? s.color : '#475569', border: `1px solid ${s.done ? `${s.color}40` : 'rgba(255,255,255,0.06)'}` }}>
              {s.done ? '✓' : s.step}
            </div>
            <div className={`text-[9px] font-mono ${s.done ? 'text-slate-300' : 'text-slate-600'}`}>
              <span className="font-bold" style={{ color: s.done ? s.color : '#475569' }}>{s.abbr}</span> {s.done ? 'completed analysis' : 'waiting'}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

// ═══ AGENT ROLE CARDS ════════════════════════════════════════════════════════

function AgentRoleCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {AGENTS.map(agent => (
        <GlassCard key={agent.id} className="p-4 group hover:border-white/10 transition-all" glow={agent.color}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}30` }}>
              <span className="text-base">{agent.icon}</span>
            </div>
            <div>
              <div className="text-[10px] font-black text-white">{agent.abbr}</div>
              <div className="text-[8px] font-mono" style={{ color: agent.color }}>{agent.name.split(' ').slice(0, 2).join(' ')}</div>
            </div>
          </div>
          <div className="text-[9px] text-slate-400 leading-relaxed">{agent.desc}</div>
        </GlassCard>
      ))}
    </div>
  )
}

// ═══ WORKFLOW SECTION ═════════════════════════════════════════════════════════

function WorkflowSection() {
  return (
    <GlassCard className="p-5">
      <div className="text-center mb-5">
        <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">How It Works</div>
        <div className="text-sm font-black text-white">Multi-Agent Coordination Pipeline</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {WORKFLOW_STEPS.map((step, i) => (
          <div key={i} className="text-center relative">
            <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-xs font-black"
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>
              {i + 1}
            </div>
            <div className="text-[10px] font-bold text-white mb-1">{step.title}</div>
            <div className="text-[8px] text-slate-500 leading-relaxed">{step.desc}</div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <div className="hidden md:block absolute top-4 -right-2 text-slate-700"><ArrowRight size={12} /></div>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

// ═══ MAIN PAGE ═══════════════════════════════════════════════════════════════

export default function Agents() {
  const [agentStates, setAgentStates] = useState({})
  const [agentFindings, setAgentFindings] = useState({})
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [streamLog, setStreamLog] = useState([])
  const [connectionState, setConnectionState] = useState('idle')
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState('00:00')
  const [threadId, setThreadId] = useState(null)
  const [riskScore, setRiskScore] = useState(null)
  const [riskLevel, setRiskLevel] = useState('UNKNOWN')
  const [riskFactors, setRiskFactors] = useState({})
  const [findings, setFindings] = useState([])
  const [correlations, setCorrelations] = useState([])
  const [explanation, setExplanation] = useState('')
  const [leads, setLeads] = useState([])
  const [errors, setErrors] = useState([])
  const [interrupted, setInterrupted] = useState(false)
  const [interruptData, setInterruptData] = useState(null)
  const [caseId, setCaseId] = useState('FTI-2024-0847')
  const [reportText, setReportText] = useState('')
  const [lgStatus, setLgStatus] = useState(null)
  const [platformHealth, setPlatformHealth] = useState(null)
  const abortRef = useRef(null)

  // Load status on mount
  useEffect(() => {
    api.getLangGraphStatus().then(setLgStatus).catch(() => setLgStatus({ available: false, error: 'Unreachable' }))
    api.getHealth().then(setPlatformHealth).catch(() => null)
  }, [])

  // Elapsed timer
  useEffect(() => {
    if (!running || !startedAt) return
    const timer = setInterval(() => {
      const t = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      setElapsed(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [running, startedAt])

  const addLog = (msg) => setStreamLog(prev => [...prev.slice(-49), msg])

  const resetAll = () => {
    if (abortRef.current) abortRef.current()
    setRunning(false); setDone(false); setAgentStates({}); setAgentFindings({})
    setCompletedCount(0); setStreamLog([]); setConnectionState('idle')
    setStartedAt(null); setElapsed('00:00'); setThreadId(null)
    setRiskScore(null); setRiskLevel('UNKNOWN'); setRiskFactors({})
    setFindings([]); setCorrelations([]); setExplanation(''); setLeads([])
    setErrors([]); setInterrupted(false); setInterruptData(null)
  }

  const handleEvent = (event) => {
    if (event.type === 'connection') {
      setConnectionState(event.state || 'unknown')
      if (event.state === 'open') addLog('🔌 SSE connection established — streaming live')
      else if (event.state === 'error') addLog(`❌ Connection error: ${event.error || 'unknown'}`)
      return
    }
    if (event.type === 'thread_id') { setThreadId(event.thread_id); addLog(`🔗 Thread initialized: ${event.thread_id.slice(0, 8)}…`) }
    else if (event.type === 'agent_update') {
      const agent = event.agent
      if (agent === 'phase1_join') {
        addLog('⚡ Phase 1 parallel intake complete → Phase 2 sequential')
        setAgentStates(prev => ({ ...prev, toxicology: prev.toxicology === 'done' ? 'done' : 'running' }))
        return
      }
      setAgentStates(prev => ({ ...prev, [agent]: 'done' }))
      setCompletedCount(c => c + 1)
      const nf = event.new_findings || 0
      if (nf > 0) setAgentFindings(prev => ({ ...prev, [agent]: (prev[agent] || 0) + nf }))
      const agentDef = AGENTS.find(a => a.id === agent)
      addLog(`✓ ${agentDef?.abbr || agent} → ${nf} findings extracted`)
      if (event.risk_score != null) { setRiskScore(event.risk_score); setRiskLevel(event.risk_level || 'UNKNOWN') }
      if (event.errors?.length) setErrors(prev => [...prev, ...event.errors])
      const idx = SEQUENTIAL_ORDER.indexOf(agent)
      if (idx >= 0 && idx + 1 < SEQUENTIAL_ORDER.length) {
        const next = SEQUENTIAL_ORDER[idx + 1]
        setAgentStates(prev => ({ ...prev, [next]: prev[next] === 'done' ? 'done' : 'running' }))
      }
    } else if (event.type === 'interrupt') {
      setInterrupted(true); setInterruptData(event.data?.[0]?.value || {}); setRunning(false)
      addLog('⏸ HUMAN-IN-THE-LOOP — review required')
    } else if (event.type === 'complete') {
      setDone(true); setRunning(false)
      setRiskScore(event.risk_score ?? riskScore); setRiskLevel(event.risk_level || riskLevel)
      setFindings(event.findings || []); setCorrelations(event.correlations || [])
      setExplanation(event.explanation || ''); setLeads(event.investigative_leads || [])
      setRiskFactors(event.risk_factors || {})
      if (event.errors?.length) setErrors(prev => [...prev, ...event.errors])
      const allDone = {}; AGENTS.forEach(a => { allDone[a.id] = 'done' }); setAgentStates(allDone)
      setCompletedCount(8)
      addLog(`🏁 Investigation complete — Risk: ${event.risk_score}/100 (${event.risk_level})`)
    } else if (event.type === 'error') { setErrors(prev => [...prev, event.error]); setRunning(false); addLog(`❌ ${event.error}`) }
  }

  const launchInvestigation = () => {
    resetAll(); setRunning(true); setStartedAt(Date.now())
    setAgentStates({ autopsy: 'running', timeline: 'running', cctv: 'running' })
    addLog(`🚀 Launching 8-agent forensic investigation — Case: ${caseId}`)
    addLog('📊 Phase 1: Auto + Time + CCTV running in parallel')
    const abort = api.streamInvestigation({ case_id: caseId, report_text: reportText || undefined }, handleEvent)
    abortRef.current = abort
  }

  const handleHITL = (decision) => {
    setInterrupted(false); setInterruptData(null); setRunning(true)
    addLog(`👤 Human decision: ${decision.toUpperCase()} — resuming pipeline`)
    abortRef.current = api.resumeInvestigation(threadId, decision, handleEvent)
  }

  const progress = Math.round((completedCount / 8) * 100)

  return (
    <div className="min-h-full overflow-y-auto" style={{ background: 'linear-gradient(180deg, #020810 0%, #040d1a 30%, #030a14 100%)' }}>
      <div className="max-w-[1400px] mx-auto px-5 py-6 space-y-5">

        {/* ═══ HERO ═══════════════════════════════════════════════════════ */}
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
            <CircleDot size={10} className="text-cyan-400" />
            <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">AI Agent Ecosystem</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white mb-2">
            8 AI Agents Coordinating in{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">Real Time</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Autopsy analysis, timeline reconstruction, CCTV intelligence, toxicology, evidence correlation,
            risk scoring, explainability, and lead prioritization — working together as one.
          </p>
          {/* Agent legend strip */}
          <div className="flex items-center justify-center gap-1 mt-4">
            {AGENTS.map((a, i) => (
              <div key={a.id} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: a.color, opacity: agentStates[a.id] === 'done' ? 1 : 0.5 }} />
                <span className="text-[8px] font-mono text-slate-500">{a.abbr}</span>
                {i < AGENTS.length - 1 && <div className="w-4 h-px mx-0.5" style={{ background: agentStates[a.id] === 'done' ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* ═══ SYSTEM STATUS + LAUNCH ═════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <GlassCard className="p-4 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server size={12} className="text-green-400" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">System Status</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: lgStatus?.available ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${lgStatus?.available ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: lgStatus?.available ? '#10b981' : '#ef4444' }} />
                <span className="text-[8px] font-bold" style={{ color: lgStatus?.available ? '#10b981' : '#ef4444' }}>
                  {lgStatus?.available ? 'All Systems Operational' : 'Degraded'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
                <div className="text-sm font-black text-cyan-400">8 / 8</div>
                <div className="text-[8px] text-slate-500">Agents Active</div>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
                <div className="text-sm font-black text-green-400">{completedCount > 0 ? completedCount * 1604 : '12,843'}</div>
                <div className="text-[8px] text-slate-500">Tasks Processed</div>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
                <div className="text-sm font-black text-purple-400">99.97%</div>
                <div className="text-[8px] text-slate-500">Uptime</div>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
                <div className="text-sm font-black" style={{ color: connectionState === 'open' ? '#10b981' : '#64748b' }}>
                  {connectionState === 'open' ? 'Live' : 'Ready'}
                </div>
                <div className="text-[8px] text-slate-500">Stream</div>
              </div>
            </div>
          </GlassCard>

          {/* Launch control */}
          <GlassCard className="p-4 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-black text-white uppercase tracking-wider mb-2">Launch Control</div>
              <input value={caseId} onChange={e => setCaseId(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[10px] text-white font-mono focus:border-cyan-500/50 focus:outline-none mb-2"
                placeholder="Case ID" />
            </div>
            {!running && !done ? (
              <button onClick={launchInvestigation}
                className="w-full py-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(139,92,246,0.15))', border: '1px solid rgba(0,212,255,0.4)', color: '#00d4ff' }}>
                <Zap size={12} />LAUNCH INVESTIGATION
              </button>
            ) : (
              <button onClick={resetAll}
                className="w-full py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-white">
                <RefreshCw size={12} />RESET
              </button>
            )}
          </GlassCard>
        </div>

        {/* ═══ PROGRESS BAR ═══════════════════════════════════════════════ */}
        {(running || done) && (
          <GlassCard className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {running && <Loader2 size={11} className="text-cyan-400 animate-spin" />}
                {done && <CheckCircle size={11} className="text-green-400" />}
                <span className="text-[10px] font-bold text-white">{done ? 'Investigation Complete' : 'Investigation Running…'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono text-slate-500">{elapsed}</span>
                {riskScore != null && (
                  <span className="text-[10px] font-black" style={{ color: riskColor(riskScore) }}>{riskScore}/100 {riskLevel}</span>
                )}
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #00d4ff, #10b981, #8b5cf6, #ec4899)' }}
                animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
            </div>
          </GlassCard>
        )}

        {/* ═══ MAIN DASHBOARD ═════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px_1fr] gap-4">
          {/* Left: Live Events + Performance */}
          <div className="space-y-3">
            <LiveEventStream streamLog={streamLog} />
            <PerformanceMetrics completedCount={completedCount} elapsed={elapsed} findings={Object.values(agentFindings).reduce((a, b) => a + b, 0)} correlations={correlations.length} />
          </div>

          {/* Center: Orchestrator Graph */}
          <div className="flex items-center justify-center">
            <GlassCard className="p-4 flex flex-col items-center" glow="#00d4ff">
              <div className="text-[9px] font-black text-white uppercase tracking-widest mb-2">Agent Orchestration</div>
              <OrchestratorGraph agentStates={agentStates} agentFindings={agentFindings} />
              <div className="flex items-center gap-4 mt-3">
                {[{ label: 'Data Flow', color: '#00d4ff' }, { label: 'Insight', color: '#10b981' }, { label: 'Alert', color: '#f59e0b' }, { label: 'Decision', color: '#ec4899' }].map(l => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div className="w-3 h-0.5 rounded-full" style={{ background: l.color }} />
                    <span className="text-[7px] font-mono text-slate-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Right: Explanation Trail + Risk */}
          <div className="space-y-3">
            <ExplanationTrail agentStates={agentStates} />
            {riskScore != null && (
              <GlassCard className="p-4 text-center" glow={riskColor(riskScore)}>
                <div className="text-[9px] font-black text-white uppercase tracking-wider mb-2">Consensus Score</div>
                <div className="text-3xl font-black" style={{ color: riskColor(riskScore) }}>{riskScore}<span className="text-sm">/100</span></div>
                <div className="text-[9px] font-mono mt-1" style={{ color: riskColor(riskScore) }}>{riskLevel} RISK</div>
                <div className="text-[8px] text-slate-500 mt-1">{completedCount} of 8 agents reporting</div>
              </GlassCard>
            )}
          </div>
        </div>

        {/* ═══ AGENT HEALTH STRIP ═════════════════════════════════════════ */}
        <div>
          <div className="text-[10px] font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <Activity size={12} className="text-cyan-400" />Agent Health
          </div>
          <AgentHealthStrip agentStates={agentStates} agentFindings={agentFindings} />
        </div>

        {/* ═══ RESULTS (when done) ════════════════════════════════════════ */}
        {done && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Risk Factors */}
            {Object.keys(riskFactors).length > 0 && (
              <GlassCard className="p-5">
                <div className="flex items-center gap-2 mb-4"><Shield size={14} className="text-cyan-400" /><span className="text-xs font-black text-white">RISK BREAKDOWN</span></div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(riskFactors).map(([k, v]) => (
                    <div key={k} className="p-3 rounded-xl" style={{ background: `${riskColor(v)}08`, border: `1px solid ${riskColor(v)}20` }}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-400 capitalize">{k}</span>
                        <span className="text-xs font-black" style={{ color: riskColor(v) }}>{v}</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-white/[0.04]"><div className="h-full rounded-full" style={{ width: `${v}%`, background: riskColor(v) }} /></div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Findings */}
            {findings.length > 0 && (
              <GlassCard className="p-5">
                <div className="flex items-center gap-2 mb-4"><Eye size={14} className="text-cyan-400" /><span className="text-xs font-black text-white">FINDINGS ({findings.length})</span></div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {findings.slice(0, 15).map((f, i) => (
                    <div key={i} className="p-2.5 rounded-lg border border-white/[0.05] bg-white/[0.01]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-500">{f.type}</span>
                        <span className="text-[8px] font-mono text-slate-600">{f.agent} • {((f.confidence || 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="text-[10px] text-slate-300">{f.content}</div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Leads */}
            {leads.length > 0 && (
              <GlassCard className="p-5" glow="#10b981">
                <div className="flex items-center gap-2 mb-4"><Target size={14} className="text-green-400" /><span className="text-xs font-black text-green-400">INVESTIGATIVE LEADS</span></div>
                <div className="space-y-2">{leads.map((l, i) => <div key={i} className="text-[10px] text-slate-300 flex items-start gap-2"><ChevronRight size={11} className="text-green-400 mt-0.5 flex-shrink-0" />{l}</div>)}</div>
              </GlassCard>
            )}

            {/* Explanation */}
            {explanation && (
              <GlassCard className="p-5">
                <div className="flex items-center gap-2 mb-3"><Lightbulb size={14} className="text-cyan-400" /><span className="text-xs font-black text-white">AI EXPLANATION</span></div>
                <div className="text-[10px] text-slate-300 leading-6 whitespace-pre-wrap font-mono">{explanation}</div>
              </GlassCard>
            )}
          </motion.div>
        )}

        {/* ═══ AGENT ROLE CARDS ═══════════════════════════════════════════ */}
        <div>
          <div className="text-center mb-3">
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Specialized Agents</div>
            <div className="text-sm font-black text-white">8 AI Agents, One Mission</div>
          </div>
          <AgentRoleCards />
        </div>

        {/* ═══ WORKFLOW ════════════════════════════════════════════════════ */}
        <WorkflowSection />

        {/* ═══ FOOTER BENEFITS ════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 pb-4">
          {[
            { icon: <Zap size={14} />, title: 'Real-Time Intelligence', color: '#00d4ff' },
            { icon: <Lightbulb size={14} />, title: 'Explainable by Design', color: '#f59e0b' },
            { icon: <Shield size={14} />, title: 'Built for Investigators', color: '#10b981' },
            { icon: <Layers size={14} />, title: 'Secure & Compliant', color: '#8b5cf6' },
          ].map(b => (
            <GlassCard key={b.title} className="p-3 text-center">
              <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ background: `${b.color}12`, border: `1px solid ${b.color}25`, color: b.color }}>{b.icon}</div>
              <div className="text-[9px] font-bold text-white">{b.title}</div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* HITL Modal */}
      <AnimatePresence>
        {interrupted && interruptData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md mx-4 rounded-2xl p-6" style={{ background: 'rgba(10,18,38,0.97)', border: '1px solid rgba(245,158,11,0.4)' }}>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={18} className="text-amber-400" />
                <div><div className="text-xs font-black text-white">HUMAN REVIEW REQUIRED</div><div className="text-[9px] text-amber-400 font-mono">Investigation paused</div></div>
              </div>
              <p className="text-[10px] text-slate-300 mb-4">{interruptData.message}</p>
              <div className="grid grid-cols-3 gap-2">
                {[['approve', '✓ Approve', '#10b981'], ['escalate', '↑ Escalate', '#f59e0b'], ['reject', '✗ Reject', '#ef4444']].map(([v, l, c]) => (
                  <button key={v} onClick={() => handleHITL(v)}
                    className="py-2 rounded-xl text-[10px] font-bold" style={{ background: `${c}15`, border: `1px solid ${c}40`, color: c }}>{l}</button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
