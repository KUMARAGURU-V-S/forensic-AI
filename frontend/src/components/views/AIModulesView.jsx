/**
 * AIModulesView — Production-ready Forensic Investigation Hub
 *
 * Stage 0 : Evidence Input  — upload autopsy report, CCTV, toxicology, evidence
 * Stage 1 : Live Pipeline   — 8 agents running with real-time SSE + HITL modal
 * Stage 2 : Results         — risk gauge, findings, correlations, leads, AI explanation
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, ImagePlus, FlaskConical, MapPin, StickyNote, Play,
  CheckCircle, XCircle, Loader2, AlertTriangle, RefreshCw,
  ChevronRight, Link2, Target, Lightbulb, Shield, Zap, Upload,
  Plus, Trash2, Eye, BarChart3, ArrowRight, Brain, Activity,
  Clock, X, Users,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useForensicStore } from '../../lib/store'

// ═══ CONSTANTS ═══════════════════════════════════════════════════════════════

const C = {
  cyan:   '#00d4ff', green:  '#10b981', amber:  '#f59e0b', red:    '#ef4444',
  purple: '#8b5cf6', pink:   '#ec4899', teal:   '#06b6d4', orange: '#f97316',
  border: 'rgba(0,212,255,0.1)', card:   'rgba(7,13,26,0.88)', bg: '#04080f',
}

const AGENTS = [
  { id: 'autopsy',        name: 'Autopsy',        icon: '🔬', model: 'Gemini 2.0 Flash',   phase: 1, color: C.red    },
  { id: 'timeline',       name: 'Timeline',       icon: '📅', model: 'Deterministic',       phase: 1, color: C.cyan   },
  { id: 'cctv',           name: 'CCTV',           icon: '📷', model: 'Gemini 2.0 Flash',   phase: 1, color: C.purple },
  { id: 'toxicology',     name: 'Toxicology',     icon: '🧪', model: 'Featherless LLM',    phase: 2, color: C.green  },
  { id: 'correlation',    name: 'Correlation',    icon: '🔗', model: 'LLM + Local',         phase: 2, color: C.amber  },
  { id: 'risk',           name: 'Risk Scoring',   icon: '⚠️',  model: 'Deterministic',       phase: 2, color: C.orange },
  { id: 'explainability', name: 'Explainability', icon: '💡', model: 'Featherless LLM',    phase: 3, color: C.teal   },
  { id: 'leads',          name: 'Lead Generator', icon: '🎯', model: 'Deterministic',       phase: 3, color: C.pink   },
]

// what agent comes next in the pipeline (for marking "running" ahead of time)
const NEXT_AGENT = {
  autopsy: null, timeline: null, cctv: null,
  phase1_join: 'toxicology', toxicology: 'correlation',
  correlation: 'risk', risk: 'explainability', explainability: 'leads', leads: null,
}

const SEV = {
  CRITICAL: { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.35)',  text: '#f87171',  label: 'CRITICAL' },
  HIGH:     { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#fb923c',  label: 'HIGH'     },
  MODERATE: { bg: 'rgba(245,158,11,0.09)',border: 'rgba(245,158,11,0.25)',text: '#fbbf24',  label: 'MODERATE' },
  LOW:      { bg: 'rgba(16,185,129,0.08)',border: 'rgba(16,185,129,0.2)', text: '#34d399',  label: 'LOW'      },
  INFO:     { bg: 'rgba(100,116,139,0.08)',border:'rgba(100,116,139,0.2)',text: '#94a3b8',  label: 'INFO'     },
}

// ═══ UTILITIES ════════════════════════════════════════════════════════════════

const readImgBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(r.result.split(',')[1])
  r.onerror = rej
  r.readAsDataURL(file)
})

const readTxt = (file) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(r.result)
  r.onerror = rej
  r.readAsText(file)
})

const readFileBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(r.result.split(',')[1])
  r.onerror = rej
  r.readAsDataURL(file)
})

/** Extract up to maxFrames evenly-spaced frames from a video file via HTML5 canvas. */
const extractVideoFrames = (file, maxFrames = 6) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.crossOrigin = 'anonymous'
  video.preload = 'metadata'
  video.muted = true

  video.addEventListener('loadedmetadata', async () => {
    const duration = video.duration
    const step = duration / (maxFrames + 1)
    const frames = [], previews = []
    const W = Math.min(video.videoWidth || 640, 1280)
    const H = Math.round(W * ((video.videoHeight || 360) / (video.videoWidth || 640)))
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    for (let i = 1; i <= maxFrames; i++) {
      video.currentTime = step * i
      await new Promise(r => video.addEventListener('seeked', r, { once: true }))
      ctx.drawImage(video, 0, 0, W, H)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      previews.push(dataUrl)
      frames.push(dataUrl.split(',')[1])
    }
    URL.revokeObjectURL(url)
    resolve({ frames, previews })
  })
  video.addEventListener('error', reject)
  video.load()
})

const riskColor = (score) =>
  score >= 80 ? C.red : score >= 60 ? C.amber : score >= 40 ? '#eab308' : C.green

const riskLabel = (score) =>
  score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MODERATE' : 'LOW'

const AGENT_IDS = new Set(AGENTS.map(agent => agent.id))
const LEGACY_AGENT_IDS = {
  autopsy_agent: 'autopsy',
  timeline_agent: 'timeline',
  cctv_agent: 'cctv',
  toxicology_agent: 'toxicology',
  correlation_agent: 'correlation',
  explainability_agent: 'explainability',
  risk_agent: 'risk',
  lead_generator: 'leads',
}

const normalizeAgentId = (id) => LEGACY_AGENT_IDS[id] || id
const findingKey = (finding) => `${finding.agent || 'unknown'}|${finding.type || 'FINDING'}|${finding.content || ''}`

const mergeUniqueFindings = (current, incoming = []) => {
  const next = [...current]
  const seen = new Set(current.map(findingKey))

  for (const finding of incoming) {
    const normalized = { ...finding, agent: normalizeAgentId(finding.agent) }
    const key = findingKey(normalized)
    if (!seen.has(key)) {
      seen.add(key)
      next.push(normalized)
    }
  }

  return next
}

// ═══ RISK GAUGE (SVG) ════════════════════════════════════════════════════════

function RiskGauge({ score = 0, size = 160 }) {
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(score, 100) / 100) * circ
  const color = riskColor(score)
  const level = riskLabel(score)
  const cx = size / 2, cy = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id="glow-gauge">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      {/* Fill */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
        filter="url(#glow-gauge)"
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)' }} />
      {/* Score */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize={size * 0.165} fontWeight="900"
        fontFamily="JetBrains Mono,monospace">{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={color} fontSize={size * 0.082} fontWeight="700"
        fontFamily="Inter,sans-serif" letterSpacing="2">{level}</text>
    </svg>
  )
}

// ═══ AGENT NODE CARD ══════════════════════════════════════════════════════════

function AgentNode({ agent, state = 'idle', findingsN = 0, compact = false }) {
  const isDone    = state === 'done'
  const isRunning = state === 'running'
  const isError   = state === 'error'

  const borderColor = isDone ? 'rgba(16,185,129,0.5)' : isRunning ? `${agent.color}80` : isError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'
  const bgColor     = isDone ? 'rgba(16,185,129,0.06)' : isRunning ? `${agent.color}0d` : C.card

  return (
    <motion.div
      animate={{ borderColor, background: bgColor, boxShadow: isRunning ? `0 0 22px ${agent.color}30` : isDone ? '0 0 14px rgba(16,185,129,0.15)' : 'none' }}
      transition={{ duration: 0.5 }}
      className="rounded-xl flex flex-col gap-2"
      style={{ padding: compact ? '10px 12px' : '14px', border: `1px solid ${borderColor}` }}>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{agent.icon}</span>
          <div>
            <div className={`font-bold text-white ${compact ? 'text-[11px]' : 'text-xs'}`}>{agent.name}</div>
            <div className="text-[9px] font-mono text-slate-500">{agent.model}</div>
          </div>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {isDone    ? <CheckCircle size={13} className="text-green-400" /> :
           isRunning ? <Loader2    size={13} style={{ color: agent.color }} className="animate-spin" /> :
           isError   ? <XCircle   size={13} className="text-red-400" /> :
                       <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />}
        </div>
      </div>

      {isDone && findingsN > 0 && (
        <div className="text-[9px] font-mono" style={{ color: C.green }}>{findingsN} finding{findingsN !== 1 ? 's' : ''}</div>
      )}

      {isRunning && (
        <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div className="h-full rounded-full"
            style={{ background: agent.color }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} />
        </div>
      )}
    </motion.div>
  )
}

// ═══ HITL MODAL ══════════════════════════════════════════════════════════════

function HITLModal({ data, onDecide }) {
  if (!data) return null
  const { message, risk_score, risk_level, top_findings = [] } = data
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-4 rounded-2xl p-6"
        style={{ background: 'rgba(10,18,38,0.97)', border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 0 40px rgba(245,158,11,0.15)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Users size={16} className="text-amber-400" />
          </div>
          <div>
            <div className="text-xs font-black text-white">HUMAN REVIEW REQUIRED</div>
            <div className="text-[10px] text-amber-400 font-mono">Investigation paused — awaiting decision</div>
          </div>
        </div>
        <p className="text-[11px] text-slate-300 mb-4 leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${riskColor(risk_score)}30` }}>
            <div className="text-lg font-black" style={{ color: riskColor(risk_score) }}>{risk_score}/100</div>
            <div className="text-[9px] text-slate-500">Risk Score</div>
          </div>
          <div className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${riskColor(risk_score)}30` }}>
            <div className="text-lg font-black" style={{ color: riskColor(risk_score) }}>{risk_level}</div>
            <div className="text-[9px] text-slate-500">Risk Level</div>
          </div>
        </div>
        {top_findings.length > 0 && (
          <div className="mb-4 space-y-1">
            {top_findings.map((f, i) => <div key={i} className="text-[10px] text-slate-400 flex gap-2"><span className="text-red-400 flex-shrink-0">▸</span>{f}</div>)}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {[['approve','✓ Approve',C.green,'rgba(16,185,129,0.15)'],['escalate','↑ Escalate',C.amber,'rgba(245,158,11,0.12)'],['reject','✗ Reject',C.red,'rgba(239,68,68,0.12)']].map(([v,l,c,bg]) => (
            <button key={v} onClick={() => onDecide(v)}
              className="py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
              style={{ background: bg, border: `1px solid ${c}40`, color: c }}>{l}</button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ═══ STAGE 0: INPUT HUB ══════════════════════════════════════════════════════

function InputStage({ input, setInput, onLaunch }) {
  const imgInputRef = useRef(null)
  const txtInputRef = useRef(null)
  const [pdfLoading,   setPdfLoading]   = useState(false)
  const [pdfWarning,   setPdfWarning]   = useState('')
  const [videoLoading, setVideoLoading] = useState(false)

  const setField = (k, v) => setInput(p => ({ ...p, [k]: v }))

  const addTox   = () => setInput(p => ({ ...p, toxicology: [...p.toxicology, { substance: '', level: '' }] }))
  const remTox   = (i) => setInput(p => ({ ...p, toxicology: p.toxicology.filter((_, j) => j !== i) }))
  const editTox  = (i, k, v) => setInput(p => ({ ...p, toxicology: p.toxicology.map((t, j) => j === i ? { ...t, [k]: v } : t) }))

  const addEv    = () => setInput(p => ({ ...p, evidence: [...p.evidence, { type: 'physical', source: '', details: '', timestamp: '' }] }))
  const remEv    = (i) => setInput(p => ({ ...p, evidence: p.evidence.filter((_, j) => j !== i) }))
  const editEv   = (i, k, v) => setInput(p => ({ ...p, evidence: p.evidence.map((e, j) => j === i ? { ...e, [k]: v } : e) }))

  const handleImages = async (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 8)
    const b64s = await Promise.all(imageFiles.map(readImgBase64))
    const previews = imageFiles.map(f => URL.createObjectURL(f))
    setInput(p => ({ ...p, cctvFrames: [...p.cctvFrames, ...b64s], cctvPreviews: [...(p.cctvPreviews || []), ...previews] }))
  }

  const handleVideoFile = async (file) => {
    setVideoLoading(true)
    try {
      const { frames, previews } = await extractVideoFrames(file, 6)
      // previews from canvas are already data-URLs; use them directly
      setInput(p => ({
        ...p,
        cctvFrames:   [...p.cctvFrames,   ...frames],
        cctvPreviews: [...(p.cctvPreviews || []), ...previews],
      }))
    } catch (e) {
      console.error('Video frame extraction failed:', e)
    } finally {
      setVideoLoading(false)
    }
  }

  const handleMediaFiles = async (files) => {
    const images = Array.from(files).filter(f => f.type.startsWith('image/'))
    const videos = Array.from(files).filter(f => f.type.startsWith('video/'))
    if (images.length) await handleImages(images)
    for (const v of videos.slice(0, 2)) await handleVideoFile(v)
  }

  const handleReportFile = async (file) => {
    setPdfWarning('')
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setPdfLoading(true)
      setField('reportPdfName', file.name)
      try {
        const result = await api.extractPdfText(file)
        setPdfWarning(result.warning || '')
        if (result.text) {
          setField('reportText', result.text)
          setField('reportPdfName', `${file.name} · ${result.pages} pages · ${result.chars?.toLocaleString() ?? '?'} chars · ${result.method}`)
        } else {
          setField('reportPdfName', file.name)
          setPdfWarning(result.warning || 'No text extracted — PDF may be image-only. Paste text manually.')
        }
      } catch (e) {
        setPdfWarning(`Extraction failed: ${e.message}. Paste text manually.`)
      } finally {
        setPdfLoading(false)
      }
    } else {
      const text = await readTxt(file)
      setField('reportText', text)
      setField('reportPdfName', '')
    }
  }

  const inputStyle = {
    background: 'rgba(4,8,18,0.8)', border: `1px solid ${C.border}`,
    color: '#cbd5e1', fontSize: 11, borderRadius: 10, fontFamily: 'JetBrains Mono, monospace',
  }

  const canLaunch = input.caseId.trim().length > 0

  return (
    <div className="h-full overflow-y-auto" style={{ background: C.bg }}>
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.1)', border: `1px solid rgba(0,212,255,0.25)` }}>
              <Brain size={17} style={{ color: C.cyan }} />
            </div>
            <div>
              <h1 className="text-base font-black text-white">Forensic Investigation Hub</h1>
              <p className="text-[10px] text-slate-500 font-mono">Configure evidence inputs → Launch 8-agent AI pipeline</p>
            </div>
          </div>
          {/* Pipeline preview dots */}
          <div className="flex items-center gap-2 mt-4 pl-1">
            {AGENTS.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: a.color, opacity: 0.7 }} />
                  <div className="text-[8px] font-mono text-slate-600">{a.name.slice(0,4)}</div>
                </div>
                {i < AGENTS.length - 1 && <div className="w-4 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Case ID bar */}
        <div className="flex items-center gap-3 mb-5 p-4 rounded-xl" style={{ background: 'rgba(0,212,255,0.04)', border: `1px solid rgba(0,212,255,0.15)` }}>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest flex-shrink-0">Case ID</div>
          <input value={input.caseId} onChange={e => setField('caseId', e.target.value)}
            className="flex-1 text-xs font-mono focus:outline-none bg-transparent text-white"
            placeholder="FTI-2024-0847" />
          <div className="text-[9px] font-mono text-slate-600">All agents will analyze this case</div>
        </div>

        {/* Input grid */}
        <div className="grid grid-cols-2 gap-4 mb-5">

          {/* Autopsy Report */}
          <div className="rounded-xl p-4 col-span-2" style={{ background: C.card, border: `1px solid rgba(239,68,68,0.2)` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <FileText size={13} style={{ color: C.red }} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Autopsy Report</div>
                  <div className="text-[9px] text-slate-500">Used by Autopsy Agent (Gemini 2.0 Flash)</div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => txtInputRef.current?.click()} disabled={pdfLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: C.red }}>
                  {pdfLoading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                  {pdfLoading ? 'Extracting…' : 'Upload .txt / .pdf / .md'}
                </button>
                <input ref={txtInputRef} type="file" accept=".txt,.md,.text,.pdf,application/pdf" className="hidden"
                  onChange={e => e.target.files[0] && handleReportFile(e.target.files[0])} />
                {(input.reportText || input.reportPdfName) && (
                  <button onClick={() => { setField('reportText', ''); setField('reportPdfName', ''); setPdfWarning('') }}
                    className="text-slate-600 hover:text-red-400"><X size={13} /></button>
                )}
              </div>
            </div>

            {/* PDF loaded badge */}
            {input.reportPdfName && !pdfLoading && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <FileText size={11} style={{ color: C.red }} />
                <span className="text-[10px] font-mono text-red-300 truncate">{input.reportPdfName}</span>
              </div>
            )}
            {pdfWarning && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />
                <span className="text-[10px] text-amber-300">{pdfWarning}</span>
              </div>
            )}

            <textarea value={input.reportText} onChange={e => setField('reportText', e.target.value)} rows={5}
              placeholder="Paste autopsy report text here, or upload a .txt / .pdf file above. Leave empty to run with case data only…"
              className="w-full resize-none focus:outline-none leading-relaxed placeholder-slate-700 text-slate-300"
              style={{ ...inputStyle, padding: '12px 14px' }} />
            {input.reportText && <div className="text-[9px] text-slate-500 mt-1 font-mono">{input.reportText.length.toLocaleString()} characters loaded</div>}
          </div>

          {/* CCTV Frames */}
          <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid rgba(139,92,246,0.2)` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <ImagePlus size={13} style={{ color: C.purple }} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">CCTV Frames / Video</div>
                  <div className="text-[9px] text-slate-500">Images or video (frames auto-extracted) · Gemini Vision</div>
                </div>
              </div>
              <button onClick={() => imgInputRef.current?.click()} disabled={videoLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: C.purple }}>
                {videoLoading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                {videoLoading ? 'Extracting…' : 'Add Frames / Video'}
              </button>
              <input ref={imgInputRef} type="file" accept="image/*,video/*,.mp4,.mov,.avi,.mkv,.webm" multiple className="hidden"
                onChange={e => e.target.files.length && handleMediaFiles(e.target.files)} />
            </div>

            {(!input.cctvPreviews || input.cctvPreviews.length === 0) ? (
              <div onClick={() => imgInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl h-28 flex flex-col items-center justify-center cursor-pointer transition-all hover:border-purple-500/40"
                style={{ borderColor: 'rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.03)' }}>
                {videoLoading
                  ? <><Loader2 size={20} style={{ color: 'rgba(139,92,246,0.6)' }} className="animate-spin" />
                      <div className="text-[10px] text-purple-400 mt-2">Extracting frames from video…</div></>
                  : <><ImagePlus size={20} style={{ color: 'rgba(139,92,246,0.4)' }} />
                      <div className="text-[10px] text-slate-600 mt-2">Upload images <span className="text-slate-500">or</span> video file (max 8 frames)</div></>}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {input.cctvPreviews.map((src, i) => (
                    <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden"
                      style={{ border: '1px solid rgba(139,92,246,0.3)' }}>
                      <img src={src} alt={`Frame ${i+1}`} className="w-full h-full object-cover" />
                      <button onClick={() => setInput(p => ({ ...p, cctvFrames: p.cctvFrames.filter((_,j)=>j!==i), cctvPreviews: p.cctvPreviews.filter((_,j)=>j!==i) }))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Trash2 size={11} className="text-red-400" />
                      </button>
                      <div className="absolute bottom-0.5 left-0.5 text-[8px] font-mono text-white/70">{i+1}</div>
                    </div>
                  ))}
                  <button onClick={() => imgInputRef.current?.click()} disabled={videoLoading}
                    className="w-16 h-16 rounded-lg flex items-center justify-center border-2 border-dashed disabled:opacity-40"
                    style={{ borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.04)' }}>
                    {videoLoading ? <Loader2 size={14} style={{ color: 'rgba(139,92,246,0.5)' }} className="animate-spin" /> : <Plus size={14} style={{ color: 'rgba(139,92,246,0.5)' }} />}
                  </button>
                </div>
                {videoLoading && (
                  <div className="text-[9px] text-purple-400 font-mono flex items-center gap-1.5">
                    <Loader2 size={9} className="animate-spin" />Extracting frames from video…
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toxicology */}
          <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid rgba(16,185,129,0.2)` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <FlaskConical size={13} style={{ color: C.green }} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Toxicology Data</div>
                  <div className="text-[9px] text-slate-500">Used by Toxicology Agent (Featherless)</div>
                </div>
              </div>
              <button onClick={addTox}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: C.green }}>
                <Plus size={10} />Add
              </button>
            </div>
            {input.toxicology.length === 0 ? (
              <div className="text-[10px] text-slate-600 text-center py-4">No substances added. Autopsy Agent may extract them automatically.</div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {input.toxicology.map((t, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input placeholder="Substance" value={t.substance} onChange={e => editTox(i, 'substance', e.target.value)}
                      className="flex-1 focus:outline-none" style={{ ...inputStyle, padding: '7px 10px' }} />
                    <input placeholder="Level (e.g. 0.8 mg/L)" value={t.level} onChange={e => editTox(i, 'level', e.target.value)}
                      className="flex-1 focus:outline-none" style={{ ...inputStyle, padding: '7px 10px' }} />
                    <button onClick={() => remTox(i)} className="text-slate-600 hover:text-red-400 flex-shrink-0"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidence Timeline */}
          <div className="rounded-xl p-4 col-span-2" style={{ background: C.card, border: `1px solid rgba(245,158,11,0.2)` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <MapPin size={13} style={{ color: C.amber }} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Evidence Items</div>
                  <div className="text-[9px] text-slate-500">Used by Timeline & Correlation Agents</div>
                </div>
              </div>
              <button onClick={addEv}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: C.amber }}>
                <Plus size={10} />Add Evidence
              </button>
            </div>
            {input.evidence.length === 0 ? (
              <div className="text-[10px] text-slate-600 text-center py-3">No evidence added. Case {input.caseId} will be loaded from database.</div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {input.evidence.map((e, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-center">
                    <select value={e.type} onChange={ev => editEv(i,'type',ev.target.value)}
                      className="focus:outline-none" style={{ ...inputStyle, padding: '7px 8px', gridColumn: '1' }}>
                      {['physical','digital','witness','forensic'].map(t => <option key={t} value={t} style={{ background: '#0f172a' }}>{t}</option>)}
                    </select>
                    <input placeholder="Source (CCTV, GPS…)" value={e.source} onChange={ev => editEv(i,'source',ev.target.value)}
                      className="focus:outline-none col-span-1" style={{ ...inputStyle, padding: '7px 10px' }} />
                    <input placeholder="Details / description" value={e.details} onChange={ev => editEv(i,'details',ev.target.value)}
                      className="focus:outline-none col-span-2" style={{ ...inputStyle, padding: '7px 10px' }} />
                    <div className="flex gap-1">
                      <input type="datetime-local" value={e.timestamp} onChange={ev => editEv(i,'timestamp',ev.target.value)}
                        className="flex-1 focus:outline-none text-[10px]" style={{ ...inputStyle, padding: '6px 8px' }} />
                      <button onClick={() => remEv(i)} className="text-slate-600 hover:text-red-400 flex-shrink-0"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Launch button */}
        <motion.button onClick={onLaunch} disabled={!canLaunch} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-sm tracking-wide disabled:opacity-40 transition-all"
          style={{
            background: canLaunch ? 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(139,92,246,0.15) 100%)' : 'rgba(255,255,255,0.04)',
            border: canLaunch ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
            color: canLaunch ? C.cyan : '#475569',
            boxShadow: canLaunch ? '0 0 30px rgba(0,212,255,0.12)' : 'none',
          }}>
          <Zap size={18} />
          LAUNCH 8-AGENT FORENSIC INVESTIGATION
          <ArrowRight size={16} />
        </motion.button>
        <div className="text-center text-[9px] text-slate-600 font-mono mt-2">
          Autopsy • Timeline • CCTV • Toxicology • Correlation • Risk • Explainability • Lead Generator
        </div>
      </div>
    </div>
  )
}

// ═══ STAGE 1: LIVE PIPELINE ═══════════════════════════════════════════════════

function PipelineStage({ agentStates, agentFindings, liveFindings, streamLog, completedCount, riskScore, riskLevel, interrupted, interruptData, onDecide, onReset, threadId }) {
  const logEndRef = useRef(null)
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [streamLog])

  const phase1 = AGENTS.filter(a => a.phase === 1)
  const phase2 = AGENTS.filter(a => a.phase === 2)
  const phase3 = AGENTS.filter(a => a.phase === 3)

  const phase1Done = phase1.every(a => agentStates[a.id] === 'done')

  const sevColor = { CRITICAL: C.red, HIGH: C.orange, MODERATE: C.amber, INFO: C.teal, LOW: C.green }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: C.bg }}>
      {/* ── Left: Pipeline ── */}
      <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {completedCount < AGENTS.length
              ? <Loader2 size={16} style={{ color: C.cyan }} className="animate-spin" />
              : <CheckCircle size={16} className="text-green-400" />}
            <div>
              <div className="text-sm font-black text-white">
                {completedCount < AGENTS.length ? 'Investigation Running' : 'Pipeline Complete'}
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                {completedCount}/{AGENTS.length} agents • Thread {threadId?.slice(0,8) ?? '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {riskScore != null && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: `${riskColor(riskScore)}12`, border: `1px solid ${riskColor(riskScore)}35` }}>
                <span className="text-sm font-black" style={{ color: riskColor(riskScore) }}>{riskScore}/100</span>
                <span className="text-[10px] font-bold" style={{ color: riskColor(riskScore) }}>{riskLevel}</span>
              </div>
            )}
            <button onClick={onReset} className="text-slate-600 hover:text-white transition-colors"><RefreshCw size={14} /></button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})` }}
              animate={{ width: `${(completedCount / AGENTS.length) * 100}%` }} transition={{ duration: 0.6 }} />
          </div>
          <div className="text-[9px] font-mono text-slate-600 mt-1">{Math.round((completedCount / AGENTS.length) * 100)}% complete</div>
        </div>

        {/* PHASE 1 — Parallel */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ background: 'rgba(0,212,255,0.08)', color: C.cyan, border: '1px solid rgba(0,212,255,0.15)' }}>
              Phase 1 — Parallel Execution
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {phase1.map(a => <AgentNode key={a.id} agent={a} state={agentStates[a.id]} findingsN={agentFindings[a.id] || 0} />)}
          </div>
        </div>

        {/* Connector */}
        <div className="flex flex-col items-center my-3">
          <div className="w-px h-5" style={{ background: phase1Done ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.06)' }} />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-mono font-bold"
            style={{
              background: phase1Done ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
              border: phase1Done ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: phase1Done ? C.green : '#475569',
            }}>
            {phase1Done ? <CheckCircle size={9} /> : <Clock size={9} />}
            {phase1Done ? 'Phase 1 Complete — Sequential phase starting' : 'Awaiting Phase 1 completion'}
          </div>
          <div className="w-px h-5" style={{ background: phase1Done ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* PHASE 2 + 3 — Sequential */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ background: 'rgba(139,92,246,0.08)', color: C.purple, border: '1px solid rgba(139,92,246,0.15)' }}>
              Phase 2+3 — Sequential Analysis
            </div>
          </div>
          <div className="space-y-2">
            {[...phase2, ...phase3].map((a, i, arr) => (
              <div key={a.id}>
                <AgentNode agent={a} state={agentStates[a.id]} findingsN={agentFindings[a.id] || 0} />
                {i < arr.length - 1 && (
                  <div className="flex justify-center my-1.5">
                    <div className="w-px h-4" style={{ background: agentStates[a.id] === 'done' ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.05)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stream log */}
        <div className="mt-4 rounded-xl p-3 max-h-32 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.border}` }}>
          <div className="text-[9px] text-slate-500 font-mono uppercase mb-2">Stream Log</div>
          {streamLog.map((msg, i) => <div key={i} className="text-[10px] font-mono text-slate-400 leading-5">{msg}</div>)}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* ── Right: Live Findings ── */}
      <div className="w-80 flex-shrink-0 overflow-y-auto border-l" style={{ borderColor: C.border }}>
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 z-10"
          style={{ background: 'rgba(4,8,18,0.95)', borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <Activity size={13} style={{ color: C.cyan }} />
            <span className="text-[11px] font-bold text-white">Live Findings</span>
          </div>
          {liveFindings.length > 0 && (
            <div className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold"
              style={{ background: 'rgba(0,212,255,0.1)', color: C.cyan, border: '1px solid rgba(0,212,255,0.2)' }}>
              {liveFindings.length}
            </div>
          )}
        </div>

        <div className="px-3 py-3 space-y-2">
          {liveFindings.length === 0 && (
            <div className="text-center py-10 text-[10px] text-slate-600 font-mono">Waiting for first agent…</div>
          )}
          <AnimatePresence>
            {liveFindings.slice().reverse().map((f, i) => {
              const s = SEV[f.severity] || SEV.INFO
              return (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  className="p-2.5 rounded-xl"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${sevColor[f.severity] || C.cyan}20`, color: s.text }}>
                      {f.type || 'FINDING'}
                    </span>
                    <span className="text-[8px] text-slate-600 font-mono">{f.agent}</span>
                  </div>
                  <div className="text-[10px] text-slate-300 leading-relaxed">{f.content}</div>
                  {f.confidence && (
                    <div className="text-[8px] font-mono mt-1" style={{ color: s.text, opacity: 0.7 }}>
                      {((f.confidence) * 100).toFixed(0)}% confidence
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* HITL */}
      <AnimatePresence>
        {interrupted && interruptData && <HITLModal data={interruptData} onDecide={onDecide} />}
      </AnimatePresence>
    </div>
  )
}

// ═══ STAGE 2: RESULTS ════════════════════════════════════════════════════════

function ResultsStage({ results, input, onReset }) {
  const score   = results?.risk_score ?? 0
  const level   = results?.risk_level ?? riskLabel(score)
  const factors = results?.risk_factors || {}
  const findings    = useMemo(() => results?.findings || [], [results])
  const correlations= useMemo(() => results?.correlations || [], [results])
  const leads       = results?.investigative_leads || []
  const explanation = results?.explanation || ''

  const critical = findings.filter(f => f.severity === 'CRITICAL')
  const high     = findings.filter(f => f.severity === 'HIGH')
  const rest     = findings.filter(f => !['CRITICAL','HIGH'].includes(f.severity))

  const typeColor = { causal: C.red, temporal: C.cyan, behavioral: C.purple, forensic: C.green }

  return (
    <div className="h-full overflow-y-auto" style={{ background: C.bg }}>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* Hero row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Risk gauge */}
          <div className="col-span-1 rounded-2xl p-5 flex flex-col items-center justify-center"
            style={{ background: C.card, border: `1px solid ${riskColor(score)}30`, boxShadow: `0 0 40px ${riskColor(score)}12` }}>
            <RiskGauge score={score} size={140} />
            <div className="text-[10px] text-slate-500 font-mono mt-2">Overall Risk Score</div>
          </div>

          {/* Stats */}
          <div className="col-span-2 grid grid-cols-2 gap-3">
            {[
              { label: 'Total Findings',    val: findings.length,    color: C.cyan,   icon: Eye   },
              { label: 'Correlations',      val: correlations.length, color: C.purple, icon: Link2 },
              { label: 'Investigative Leads', val: leads.length,     color: C.amber,  icon: Target },
              { label: 'Agents Completed',  val: AGENTS.length,      color: C.green,  icon: CheckCircle },
            ].map(({ label, val, color, icon: Icon }) => (
              <div key={label} className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: C.card, border: `1px solid ${color}20` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <div className="text-2xl font-black" style={{ color }}>{val}</div>
                  <div className="text-[10px] text-slate-500">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk factors */}
        {Object.keys(factors).length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="text-xs font-black text-white mb-4 flex items-center gap-2">
              <Shield size={14} style={{ color: C.cyan }} />RISK FACTOR BREAKDOWN
            </div>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(factors).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-400 capitalize">{k}</span>
                    <span className="font-bold font-mono" style={{ color: riskColor(v) }}>{v}/100</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div className="h-full rounded-full"
                      initial={{ width: 0 }} animate={{ width: `${v}%` }}
                      transition={{ duration: 0.8, ease: [0.4,0,0.2,1] }}
                      style={{ background: riskColor(v), boxShadow: `0 0 8px ${riskColor(v)}60` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Findings */}
        {findings.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="text-xs font-black text-white mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Eye size={14} style={{ color: C.cyan }} />FINDINGS ({findings.length})</div>
              <div className="flex gap-2 text-[9px] font-mono">
                {critical.length > 0 && <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: C.red }}>{critical.length} CRITICAL</span>}
                {high.length > 0 && <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(249,115,22,0.1)', color: C.orange }}>{high.length} HIGH</span>}
              </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {[...critical, ...high, ...rest].map((f, i) => {
                const s = SEV[f.severity] || SEV.INFO
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className="p-3 rounded-xl" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(0,0,0,0.3)', color: s.text }}>{f.type || 'FINDING'}</span>
                      <div className="flex items-center gap-2 text-[9px] font-mono text-slate-600">
                        <span>{f.agent}</span>
                        {f.confidence && <span>{((f.confidence) * 100).toFixed(0)}%</span>}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-200 leading-relaxed">{f.content}</div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Correlations */}
        {correlations.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="text-xs font-black text-white mb-4 flex items-center gap-2">
              <Link2 size={14} style={{ color: C.cyan }} />EVIDENCE CORRELATIONS ({correlations.length})
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {correlations.map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${typeColor[c.type] || C.cyan}25` }}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-bold" style={{ color: typeColor[c.type] || C.cyan }}>{c.source}</span>
                    <ArrowRight size={10} className="text-slate-600" />
                    <span className="text-xs font-bold text-white">{c.target}</span>
                    <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: `${typeColor[c.type] || C.cyan}15`, color: typeColor[c.type] || C.cyan }}>
                      {c.type} · {((c.strength || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-relaxed">{c.description}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Investigative leads */}
        {leads.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="text-xs font-black mb-4 flex items-center gap-2" style={{ color: C.green }}>
              <Target size={14} />INVESTIGATIVE LEADS ({leads.length})
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {leads.map((lead, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl"
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(16,185,129,0.1)' }}>
                  <ChevronRight size={12} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
                  <span className="text-[11px] text-slate-200 leading-relaxed">{lead}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Explanation */}
        {explanation && (
          <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="text-xs font-black text-white mb-3 flex items-center gap-2">
              <Lightbulb size={14} style={{ color: C.cyan }} />AI EXPLANATION
            </div>
            <div className="text-xs text-slate-300 leading-7 font-mono whitespace-pre-wrap">{explanation}</div>
          </div>
        )}

        {/* Reset */}
        <div className="flex justify-center pb-6">
          <button onClick={onReset}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: '#64748b' }}>
            <RefreshCw size={13} />New Investigation
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══ MAIN COMPONENT ═══════════════════════════════════════════════════════════

export default function AIModulesView() {
  const { caseId: storeCaseId } = useForensicStore()

  const [stage, setStage] = useState(0)
  const [input, setInput] = useState({
    caseId: storeCaseId || 'FTI-2024-0847',
    reportText: '', reportPdfB64: null, reportPdfName: '',
    cctvFrames: [], cctvPreviews: [],
    toxicology: [], evidence: [],
  })

  // Pipeline state
  const [agentStates,   setAgentStates]   = useState({})
  const [agentFindings, setAgentFindings] = useState({})
  const [liveFindings,  setLiveFindings]  = useState([])
  const [streamLog,     setStreamLog]     = useState([])
  const [completedAgents,setCompletedAgents]= useState([])
  const [threadId,      setThreadId]      = useState(null)
  const [riskScore,     setRiskScore]     = useState(null)
  const [riskLevel,     setRiskLevel]     = useState('UNKNOWN')
  const [interrupted,   setInterrupted]   = useState(false)
  const [interruptData, setInterruptData] = useState(null)
  const [results,       setResults]       = useState(null)
  const abortRef = useRef(null)
  const completedCount = completedAgents.length

  const addLog = (msg) => setStreamLog(p => [...p.slice(-59), msg])

  const reset = useCallback(() => {
    abortRef.current?.()
    setStage(0); setAgentStates({}); setAgentFindings({}); setLiveFindings([])
    setStreamLog([]); setCompletedAgents([]); setThreadId(null)
    setRiskScore(null); setRiskLevel('UNKNOWN')
    setInterrupted(false); setInterruptData(null); setResults(null)
  }, [])

  const markAgentDone = useCallback((rawId, findingsCount = 0) => {
    const id = normalizeAgentId(rawId)
    if (!AGENT_IDS.has(id)) return

    setAgentStates(prev => ({ ...prev, [id]: 'done' }))
    setCompletedAgents(prev => (prev.includes(id) ? prev : [...prev, id]))
    setAgentFindings(prev => ({
      ...prev,
      [id]: Math.max(prev[id] || 0, findingsCount),
    }))
  }, [])

  // Honest fallback when LangGraph is not installed
  const runClassicFallback = useCallback(async () => {
    addLog('⚠️ LangGraph unavailable — running legacy snapshot analysis')
    try {
      const r = await api.runAgentAnalysis(input.caseId)
      const normalizedOutputs = (r.agent_outputs || []).map(output => ({
        ...output,
        agent: normalizeAgentId(output.agent),
      }))
      const live = normalizedOutputs.flatMap(output =>
        (output.findings || []).map(finding => ({
          type: 'FINDING',
          content: finding,
          severity: 'HIGH',
          confidence: output.confidence,
          agent: output.agent,
        })),
      )

      for (const output of normalizedOutputs) {
        markAgentDone(output.agent, output.findings?.length || 0)
        addLog(`✓ ${output.agent} — ${output.findings?.length || 0} findings`)
      }

      setLiveFindings(live)
      const consensus = r.consensus || {}
      const mappedResults = {
        risk_score: consensus.risk_score || 0,
        risk_level: consensus.risk_level || 'HIGH',
        findings: normalizedOutputs.flatMap(o => (o.findings || []).map(f => ({
          type: 'FINDING', content: f, severity: 'HIGH', confidence: o.confidence, agent: o.agent,
        }))),
        correlations: [],
        explanation: [consensus.primary_suspect && `Primary suspect: ${consensus.primary_suspect}.`, ...(consensus.recommended_actions || [])].filter(Boolean).join(' '),
        investigative_leads: consensus.recommended_actions || [],
        risk_factors: {},
      }
      setResults(mappedResults)
      setRiskScore(mappedResults.risk_score)
      addLog(`🏁 Complete — Risk: ${mappedResults.risk_score}/100`)
      setStage(2)
    } catch (e) {
      addLog(`❌ ${e.message}`)
    }
  }, [input.caseId, markAgentDone])

  const handleEvent = useCallback((event) => {
    if (event.type === 'thread_id') {
      setThreadId(event.thread_id)
      addLog(`🔗 Thread ${event.thread_id.slice(0, 8)}…`)
    } else if (event.type === 'agent_update') {
      const id = normalizeAgentId(event.agent)
      if (id === 'phase1_join') { addLog('⚡ Phase 1 done → sequential phase'); return }
      markAgentDone(id, event.findings?.length || event.new_findings || 0)
      addLog(`✓ ${id} — ${event.new_findings || 0} findings`)
      if (event.risk_score != null) { setRiskScore(event.risk_score); setRiskLevel(event.risk_level || 'UNKNOWN') }
      if (event.errors?.length)    addLog(`⚠ ${event.errors[0]}`)
      if (event.findings?.length) {
        setLiveFindings(prev => mergeUniqueFindings(prev, event.findings))
      }
      const nxt = NEXT_AGENT[id]
      if (nxt) setAgentStates(p => ({ ...p, [nxt]: p[nxt] === 'done' ? 'done' : 'running' }))
    } else if (event.type === 'interrupt') {
      const payload = event.data?.[0]?.value || {}
      setInterrupted(true); setInterruptData(payload)
      addLog('⏸ Human review required')
    } else if (event.type === 'complete') {
      if (event.findings?.length) {
        setLiveFindings(event.findings.map(finding => ({ ...finding, agent: normalizeAgentId(finding.agent) })))
      }
      setResults({
        ...event,
        findings: (event.findings || []).map(finding => ({ ...finding, agent: normalizeAgentId(finding.agent) })),
      })
      setRiskScore(event.risk_score ?? riskScore)
      setRiskLevel(event.risk_level ?? riskLevel)
      const allDone = {}; AGENTS.forEach(a => { allDone[a.id] = 'done' })
      setAgentStates(allDone)
      setCompletedAgents(AGENTS.map(agent => agent.id))
      addLog(`🏁 Done — Risk ${event.risk_score}/100 (${event.risk_level})`)
      setStage(2)
    } else if (event.type === 'error') {
      const e = event.error || ''
      if (e.toLowerCase().includes('langgraph') || e.toLowerCase().includes('missing') || e.toLowerCase().includes('modulenotfound')) {
        runClassicFallback()
      } else {
        addLog(`❌ ${e}`)
      }
    }
  }, [riskScore, riskLevel, runClassicFallback, markAgentDone])

  const launch = useCallback(() => {
    reset()
    setStage(1)
    // Phase 1 agents all start in parallel
    setAgentStates({ autopsy: 'running', timeline: 'running', cctv: 'running' })
    addLog(`🚀 Case ${input.caseId} — launching 8-agent pipeline`)

    const abort = api.streamInvestigation({
      case_id: input.caseId,
      report_text: input.reportText || undefined,
      cctv_frames: input.cctvFrames,
      toxicology_data: input.toxicology.filter(t => t.substance?.trim()),
      evidence: input.evidence.filter(e => e.details?.trim()).map(e => ({
        type: e.type, source: e.source, details: e.details,
        timestamp: e.timestamp || undefined,
      })),
    }, handleEvent)

    abortRef.current = abort
  }, [input, reset, handleEvent])

  const handleHITL = useCallback((decision) => {
    setInterrupted(false); setInterruptData(null)
    addLog(`👤 Human: ${decision.toUpperCase()}`)
    const abort = api.resumeInvestigation(threadId, decision, handleEvent)
    abortRef.current = abort
  }, [threadId, handleEvent])

  return (
    <div className="h-full overflow-hidden" style={{ background: C.bg }}>
      <AnimatePresence mode="wait">
        {stage === 0 && (
          <motion.div key="input" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <InputStage input={input} setInput={setInput} onLaunch={launch} />
          </motion.div>
        )}
        {stage === 1 && (
          <motion.div key="pipeline" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PipelineStage
              agentStates={agentStates} agentFindings={agentFindings}
              liveFindings={liveFindings} streamLog={streamLog}
              completedCount={completedCount} riskScore={riskScore} riskLevel={riskLevel}
              interrupted={interrupted} interruptData={interruptData}
              onDecide={handleHITL} onReset={reset} threadId={threadId}
            />
          </motion.div>
        )}
        {stage === 2 && (
          <motion.div key="results" className="h-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ResultsStage results={results} input={input} onReset={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
