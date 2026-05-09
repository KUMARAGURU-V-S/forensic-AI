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
  FileText, ImagePlus, FlaskConical, MapPin,
  CheckCircle, XCircle, Loader2, AlertTriangle, RefreshCw,
  ChevronRight, Link2, Target, Lightbulb, Shield, Zap, Upload,
  Plus, Trash2, Eye, ArrowRight, Brain, Activity,
  Clock, X, Users, Wifi, WifiOff, Database, Server, ScanSearch,
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
  'autopsy-fallback': 'autopsy',
  timeline_agent: 'timeline',
  cctv_agent: 'cctv',
  'cctv-fallback': 'cctv',
  toxicology_agent: 'toxicology',
  correlation_agent: 'correlation',
  explainability_agent: 'explainability',
  risk_agent: 'risk',
  lead_generator: 'leads',
}

const normalizeAgentId = (id) => LEGACY_AGENT_IDS[id] || id
const findingKey = (finding) => `${finding.agent || 'unknown'}|${finding.type || 'FINDING'}|${finding.content || ''}`
const correlationKey = (correlation) => `${correlation.source || ''}|${correlation.target || ''}|${correlation.type || ''}|${correlation.description || ''}`

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

const mergeUniqueCorrelations = (current, incoming = []) => {
  const next = [...current]
  const seen = new Set(current.map(correlationKey))

  for (const correlation of incoming) {
    const key = correlationKey(correlation)
    if (!seen.has(key)) {
      seen.add(key)
      next.push(correlation)
    }
  }

  return next
}

const mergeUniqueStrings = (current, incoming = []) => {
  const seen = new Set(current)
  const next = [...current]

  for (const item of incoming) {
    if (!seen.has(item)) {
      seen.add(item)
      next.push(item)
    }
  }

  return next
}

const formatElapsed = (startedAt, now = Date.now()) => {
  if (!startedAt) return '00:00'
  const total = Math.max(0, Math.floor((now - startedAt) / 1000))
  const minutes = String(Math.floor(total / 60)).padStart(2, '0')
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const formatPrintableDate = () => new Date().toLocaleString(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function buildPrintableReportHtml({ input, results, platform }) {
  const score = results?.risk_score ?? 0
  const level = results?.risk_level ?? riskLabel(score)
  const findings = results?.findings || []
  const correlations = results?.correlations || []
  const leads = results?.investigative_leads || []
  const factors = results?.risk_factors || {}
  const explanation = results?.explanation || ''
  const summary = summarizeInput(input)
  const groupedFindings = [...findings].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MODERATE: 2, INFO: 3, LOW: 4 }
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
  })

  const findingsHtml = groupedFindings.length
    ? groupedFindings.map((finding) => `
      <div class="finding finding-${escapeHtml((finding.severity || 'info').toLowerCase())}">
        <div class="finding-head">
          <span class="finding-type">${escapeHtml(finding.type || 'FINDING')}</span>
          <span class="finding-meta">${escapeHtml(normalizeAgentId(finding.agent || 'unknown'))}${finding.confidence ? ` · ${Math.round(finding.confidence * 100)}%` : ''}</span>
        </div>
        <div class="finding-body">${escapeHtml(finding.content || '')}</div>
      </div>
    `).join('')
    : '<div class="empty">No findings emitted.</div>'

  const correlationsHtml = correlations.length
    ? correlations.map((correlation) => `
      <div class="card">
        <div class="card-title">${escapeHtml(correlation.source || '')} → ${escapeHtml(correlation.target || '')}</div>
        <div class="muted">${escapeHtml(correlation.type || 'correlation')}${correlation.strength ? ` · ${Math.round(correlation.strength * 100)}%` : ''}</div>
        <div>${escapeHtml(correlation.description || '')}</div>
      </div>
    `).join('')
    : '<div class="empty">No cross-evidence correlations emitted.</div>'

  const leadsHtml = leads.length
    ? leads.map((lead) => `<li>${escapeHtml(lead)}</li>`).join('')
    : '<li>No investigative leads emitted.</li>'

  const factorsHtml = Object.entries(factors).length
    ? Object.entries(factors).map(([key, value]) => `
      <div class="factor-row">
        <span>${escapeHtml(key)}</span>
        <span>${escapeHtml(String(value))}/100</span>
      </div>
    `).join('')
    : '<div class="empty">No factor breakdown available.</div>'

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>ForensiX Investigation Report - ${escapeHtml(input.caseId)}</title>
      <style>
        @page { size: A4; margin: 16mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; background: #ffffff; }
        .wrap { max-width: 980px; margin: 0 auto; }
        .header { border-bottom: 3px solid #0f766e; padding-bottom: 14px; margin-bottom: 22px; }
        .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; color: #0f766e; font-weight: 700; }
        h1 { margin: 10px 0 6px; font-size: 32px; line-height: 1.1; }
        .sub { color: #475569; font-size: 13px; }
        .hero { display: grid; grid-template-columns: 180px 1fr; gap: 18px; margin-bottom: 20px; }
        .score { border: 1px solid #cbd5e1; border-radius: 16px; padding: 18px; text-align: center; }
        .score-value { font-size: 44px; font-weight: 800; color: #0f766e; }
        .score-label { font-size: 13px; color: #475569; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .meta-card { border: 1px solid #dbe4ee; border-radius: 12px; padding: 12px; }
        .meta-value { font-size: 24px; font-weight: 800; color: #0f172a; }
        .meta-label { font-size: 12px; color: #475569; }
        .section { margin-top: 20px; break-inside: avoid; }
        .section h2 { margin: 0 0 10px; font-size: 18px; border-bottom: 1px solid #dbe4ee; padding-bottom: 6px; }
        .finding { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
        .finding-critical { border-color: #fecaca; background: #fef2f2; }
        .finding-high { border-color: #fed7aa; background: #fff7ed; }
        .finding-moderate { border-color: #fde68a; background: #fffbeb; }
        .finding-info, .finding-low { border-color: #dbe4ee; background: #f8fafc; }
        .finding-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 12px; }
        .finding-type { font-weight: 800; }
        .finding-meta, .muted { color: #64748b; font-size: 12px; }
        .finding-body { font-size: 13px; line-height: 1.55; }
        .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .card { border: 1px solid #dbe4ee; border-radius: 12px; padding: 12px; background: #fff; margin-bottom: 10px; }
        .card-title { font-weight: 700; margin-bottom: 4px; }
        .factor-row { display: flex; justify-content: space-between; border-bottom: 1px dashed #dbe4ee; padding: 8px 0; font-size: 13px; }
        ul { margin: 0; padding-left: 18px; }
        li { margin-bottom: 8px; line-height: 1.5; }
        pre { white-space: pre-wrap; word-break: break-word; background: #f8fafc; border: 1px solid #dbe4ee; border-radius: 12px; padding: 14px; font-size: 12px; line-height: 1.6; }
        .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #dbe4ee; color: #64748b; font-size: 11px; }
        .empty { color: #64748b; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <div class="eyebrow">ForensiX Investigation Report</div>
          <h1>Case ${escapeHtml(input.caseId)}</h1>
          <div class="sub">Generated ${escapeHtml(formatPrintableDate())} · Provider ${escapeHtml(platform?.status?.llm_provider || 'Unknown')}</div>
        </div>

        <div class="hero">
          <div class="score">
            <div class="score-value">${escapeHtml(String(score))}</div>
            <div class="score-label">${escapeHtml(level)} Risk</div>
          </div>
          <div class="meta-grid">
            <div class="meta-card"><div class="meta-value">${groupedFindings.length}</div><div class="meta-label">Findings</div></div>
            <div class="meta-card"><div class="meta-value">${correlations.length}</div><div class="meta-label">Correlations</div></div>
            <div class="meta-card"><div class="meta-value">${leads.length}</div><div class="meta-label">Investigative Leads</div></div>
            <div class="meta-card"><div class="meta-value">${summary.reportLoaded ? 'Yes' : 'No'}</div><div class="meta-label">Autopsy Report Loaded</div></div>
          </div>
        </div>

        <div class="section">
          <h2>Evidence Intake</h2>
          <div class="grid-2">
            <div class="card"><div class="card-title">Autopsy Report</div><div>${summary.reportChars.toLocaleString()} characters</div></div>
            <div class="card"><div class="card-title">CCTV Frames</div><div>${summary.frames}</div></div>
            <div class="card"><div class="card-title">Toxicology Inputs</div><div>${summary.toxicology}</div></div>
            <div class="card"><div class="card-title">Evidence Items</div><div>${summary.evidence}</div></div>
          </div>
        </div>

        <div class="section">
          <h2>Priority Findings</h2>
          ${findingsHtml}
        </div>

        <div class="section grid-2">
          <div>
            <h2>Risk Factors</h2>
            ${factorsHtml}
          </div>
          <div>
            <h2>Investigative Leads</h2>
            <ul>${leadsHtml}</ul>
          </div>
        </div>

        <div class="section">
          <h2>Evidence Correlations</h2>
          ${correlationsHtml}
        </div>

        <div class="section">
          <h2>AI Explanation</h2>
          <pre>${escapeHtml(explanation || 'No explanation emitted.')}</pre>
        </div>

        <div class="footer">
          Generated from the AI Modules investigation workspace. Save this print view as PDF in the browser print dialog.
        </div>
      </div>
      <script>
        window.onload = () => {
          window.print();
        };
      </script>
    </body>
  </html>`
}

const summarizeInput = (input) => ({
  reportChars: input.reportText?.trim().length || 0,
  reportLoaded: Boolean(input.reportText?.trim()),
  frames: input.cctvFrames?.length || 0,
  toxicology: input.toxicology?.filter(t => t.substance?.trim()).length || 0,
  evidence: input.evidence?.filter(e => e.details?.trim()).length || 0,
})

const countFindingsByAgent = (findings = []) => findings.reduce((acc, finding) => {
  const id = normalizeAgentId(finding.agent)
  acc[id] = (acc[id] || 0) + 1
  return acc
}, {})

function StatusChip({ tone = 'neutral', label, detail, icon: Icon = Activity }) {
  const palette = {
    good:   { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', text: C.green },
    warn:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)', text: C.amber },
    bad:    { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)', text: C.red },
    info:   { bg: 'rgba(0,212,255,0.1)', border: 'rgba(0,212,255,0.22)', text: C.cyan },
    neutral:{ bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.18)', text: '#94a3b8' },
  }
  const style = palette[tone] || palette.neutral

  return (
    <div className="rounded-xl px-3 py-2 flex items-center gap-2"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <Icon size={13} style={{ color: style.text }} className="flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-white truncate">{label}</div>
        {detail && <div className="text-[9px] font-mono truncate" style={{ color: style.text }}>{detail}</div>}
      </div>
    </div>
  )
}

function MetricCard({ label, value, detail, color = C.cyan, icon: Icon = Activity }) {
  return (
    <div className="rounded-2xl p-4"
      style={{ background: C.card, border: `1px solid ${color}24`, boxShadow: `0 0 24px ${color}10` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-black leading-none" style={{ color }}>{value}</div>
          <div className="text-[10px] text-slate-500 mt-2">{label}</div>
          {detail && <div className="text-[9px] font-mono mt-1 text-slate-600">{detail}</div>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}12`, border: `1px solid ${color}28` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
    </div>
  )
}

function SectionFrame({ title, icon: Icon = Activity, color = C.cyan, action = null, children }) {
  return (
    <div className="rounded-3xl p-5"
      style={{
        background: 'linear-gradient(180deg, rgba(8,15,30,0.96) 0%, rgba(5,10,20,0.96) 100%)',
        border: `1px solid ${color}18`,
        boxShadow: `0 0 40px ${color}0d`,
      }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color }} />
          <div className="text-xs font-black text-white tracking-wide">{title}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

const DEFAULT_PLATFORM_STATE = {
  loading: true,
  health: null,
  status: null,
  langgraph: null,
  agents: null,
  error: '',
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
  const statusLabel = isDone ? 'Complete' : isRunning ? 'Live' : isError ? 'Error' : 'Queued'

  const borderColor = isDone ? 'rgba(16,185,129,0.5)' : isRunning ? `${agent.color}80` : isError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'
  const bgColor     = isDone ? 'rgba(16,185,129,0.06)' : isRunning ? `${agent.color}14` : C.card

  return (
    <motion.div
      animate={{ borderColor, background: bgColor, boxShadow: isRunning ? `0 0 22px ${agent.color}30` : isDone ? '0 0 14px rgba(16,185,129,0.15)' : 'none' }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl flex flex-col gap-3"
      style={{ padding: compact ? '10px 12px' : '14px', border: `1px solid ${borderColor}` }}>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${agent.color}14`, border: `1px solid ${agent.color}28` }}>
            <span className="text-base leading-none">{agent.icon}</span>
          </div>
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

      <div className="flex items-center justify-between gap-2">
        <div className="text-[9px] font-mono px-2 py-1 rounded-full"
          style={{
            background: isDone ? 'rgba(16,185,129,0.12)' : isRunning ? `${agent.color}18` : 'rgba(148,163,184,0.08)',
            color: isDone ? C.green : isRunning ? agent.color : '#64748b',
          }}>
          {statusLabel}
        </div>
        <div className="text-[9px] font-mono" style={{ color: isDone ? C.green : '#64748b' }}>
          {findingsN} finding{findingsN !== 1 ? 's' : ''}
        </div>
      </div>

      {isRunning && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
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

function InputStage({ input, setInput, onLaunch, platform = DEFAULT_PLATFORM_STATE, onRefreshPlatform = () => {} }) {
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
  const inputSummary = summarizeInput(input)
  const platformState = platform || DEFAULT_PLATFORM_STATE
  const healthOk = platformState.health?.status === 'healthy'
  const aiOk = Boolean(platformState.status?.ai_available)
  const langGraphOk = Boolean(platformState.langgraph?.available)
  const apiCards = [
    {
      label: 'Core API',
      detail: healthOk ? `v${platformState.health?.version || '4.x'} ready` : platformState.error || 'Unavailable',
      tone: healthOk ? 'good' : platformState.loading ? 'info' : 'bad',
      icon: Server,
    },
    {
      label: 'LangGraph',
      detail: langGraphOk ? `${platformState.langgraph?.agents || 8} stages online` : platformState.langgraph?.error || 'Unavailable',
      tone: langGraphOk ? 'good' : platformState.loading ? 'info' : 'bad',
      icon: ScanSearch,
    },
    {
      label: 'LLM Provider',
      detail: aiOk ? `${platformState.status?.llm_provider} · ${platformState.status?.llm_model}` : 'No provider configured',
      tone: aiOk ? 'good' : 'warn',
      icon: Brain,
    },
    {
      label: 'Evidence Stack',
      detail: `${inputSummary.frames} frames · ${inputSummary.evidence} evidence · ${inputSummary.toxicology} tox`,
      tone: inputSummary.frames || inputSummary.evidence || inputSummary.reportLoaded ? 'info' : 'neutral',
      icon: Database,
    },
  ]

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

        <SectionFrame
          title="Launch Readiness"
          icon={Activity}
          color={C.cyan}
          action={
            <button onClick={onRefreshPlatform}
              className="text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: '#94a3b8' }}>
              Refresh Status
            </button>
          }>
          <div className="grid md:grid-cols-4 gap-3">
            {apiCards.map(card => (
              <StatusChip key={card.label} tone={card.tone} label={card.label} detail={card.detail} icon={card.icon} />
            ))}
          </div>
          {!aiOk && !platformState.loading && (
            <div className="mt-3 rounded-2xl px-4 py-3 flex items-start gap-2"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-bold text-amber-300">Model provider not active</div>
                <div className="text-[10px] text-amber-200/80 leading-relaxed">
                  Real-time orchestration will still run, but the autopsy, toxicology, and explainability agents will degrade to fallback behavior until the backend is restarted with a valid provider loaded.
                </div>
              </div>
            </div>
          )}
        </SectionFrame>

        {/* Input grid */}
        <div className="grid grid-cols-2 gap-4 my-5">

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
        <div className="grid md:grid-cols-3 gap-3 mt-3">
          <StatusChip tone={inputSummary.reportLoaded ? 'good' : 'warn'} label="Autopsy Intake" detail={inputSummary.reportLoaded ? `${inputSummary.reportChars.toLocaleString()} chars ready` : 'No report text loaded yet'} icon={FileText} />
          <StatusChip tone={inputSummary.frames > 0 ? 'good' : 'neutral'} label="Video/CCTV" detail={`${inputSummary.frames} frame${inputSummary.frames !== 1 ? 's' : ''} queued for vision analysis`} icon={ImagePlus} />
          <StatusChip tone={inputSummary.evidence > 0 ? 'info' : 'neutral'} label="Evidence Timeline" detail={`${inputSummary.evidence} evidence item${inputSummary.evidence !== 1 ? 's' : ''} will be correlated`} icon={MapPin} />
        </div>
        <div className="text-center text-[9px] text-slate-600 font-mono mt-3">
          Autopsy • Timeline • CCTV • Toxicology • Correlation • Risk • Explainability • Lead Generator
        </div>
      </div>
    </div>
  )
}

// ═══ STAGE 1: LIVE PIPELINE ═══════════════════════════════════════════════════

function PipelineStage({
  agentStates, agentFindings, liveFindings, liveCorrelations, liveLeads, streamLog,
  completedCount, riskScore, riskLevel, interrupted, interruptData, onDecide, onReset,
  threadId, platform = DEFAULT_PLATFORM_STATE, streamState, input,
}) {
  const logEndRef = useRef(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [streamLog])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const phase1 = AGENTS.filter(a => a.phase === 1)
  const phase2 = AGENTS.filter(a => a.phase === 2)
  const phase3 = AGENTS.filter(a => a.phase === 3)
  const phase1Done = phase1.every(a => agentStates[a.id] === 'done')
  const runningAgents = AGENTS.filter(agent => agentStates[agent.id] === 'running')
  const inputSummary = summarizeInput(input)
  const progress = Math.round((completedCount / AGENTS.length) * 100)
  const connectionTone = streamState.state === 'open'
    ? 'good'
    : streamState.state === 'connecting'
      ? 'info'
      : streamState.state === 'error'
        ? 'bad'
        : 'neutral'

  return (
    <div className="h-full overflow-y-auto" style={{ background: C.bg }}>
      <div className="max-w-[1500px] mx-auto px-6 py-6 space-y-5">
        <div className="rounded-[28px] p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(5,16,28,0.98) 0%, rgba(8,18,34,0.95) 52%, rgba(20,14,39,0.96) 100%)',
            border: `1px solid ${C.border}`,
            boxShadow: '0 0 60px rgba(0,212,255,0.08)',
          }}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center gap-3">
                {completedCount < AGENTS.length
                  ? <Loader2 size={18} style={{ color: C.cyan }} className="animate-spin" />
                  : <CheckCircle size={18} className="text-green-400" />}
                <div>
                  <div className="text-lg font-black text-white">
                    {completedCount < AGENTS.length ? '8-Agent Investigation Mission Control' : 'Investigation Complete'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Case {input.caseId} • Thread {threadId?.slice(0, 8) ?? 'pending'} • {completedCount}/{AGENTS.length} stages closed
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-3">
                <StatusChip tone={connectionTone} label="Realtime Transport" detail={streamState.state === 'open' ? 'SSE connected' : streamState.message || streamState.state || 'idle'} icon={streamState.state === 'open' ? Wifi : WifiOff} />
                <StatusChip tone={platform.langgraph?.available ? 'good' : 'bad'} label="LangGraph" detail={platform.langgraph?.available ? `${platform.langgraph?.agents || 8} stages active` : platform.langgraph?.error || 'Unavailable'} icon={ScanSearch} />
                <StatusChip tone={platform.status?.ai_available ? 'good' : 'warn'} label="Model Provider" detail={platform.status?.ai_available ? `${platform.status?.llm_provider}` : 'Fallback mode likely'} icon={Brain} />
                <StatusChip tone={platform.status?.supabase_connected ? 'good' : 'warn'} label="Knowledge + DB" detail={platform.status?.supabase_connected ? 'Supabase connected' : 'Cloud DB degraded'} icon={Database} />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-2 text-slate-500">
                  <span>Pipeline progress</span>
                  <span>{progress}% complete</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.95) 0%, rgba(16,185,129,0.95) 50%, rgba(236,72,153,0.95) 100%)' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:w-[520px] gap-3">
              <MetricCard label="Elapsed" value={formatElapsed(streamState.startedAt, now)} detail={runningAgents.length ? `${runningAgents.length} live now` : 'Awaiting next stage'} color={C.cyan} icon={Clock} />
              <MetricCard label="Findings" value={liveFindings.length} detail="Streaming in real time" color={C.green} icon={Eye} />
              <MetricCard label="Correlations" value={liveCorrelations.length} detail="Cross-evidence links" color={C.purple} icon={Link2} />
              <MetricCard label="Leads" value={liveLeads.length} detail={riskScore != null ? `${riskLevel} risk` : 'Pending risk'} color={riskScore != null ? riskColor(riskScore) : C.amber} icon={Target} />
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.45fr_0.85fr] gap-5">
          <SectionFrame title="Live Agent Orchestration" icon={Activity} color={C.cyan} action={
            <button onClick={onReset} className="text-slate-600 hover:text-white transition-colors"><RefreshCw size={14} /></button>
          }>
            <div className="grid lg:grid-cols-3 gap-3 mb-4">
              <MetricCard label="Phase 1 Parallel" value={phase1.filter(a => agentStates[a.id] === 'done').length} detail="Autopsy + Timeline + CCTV" color={C.cyan} icon={Zap} />
              <MetricCard label="Sequential Queue" value={phase2.concat(phase3).filter(a => agentStates[a.id] === 'done').length} detail="Toxicology to Leads" color={C.purple} icon={ArrowRight} />
              <MetricCard label="Risk Snapshot" value={riskScore != null ? `${riskScore}` : '—'} detail={riskLevel || 'Pending'} color={riskScore != null ? riskColor(riskScore) : C.amber} icon={Shield} />
            </div>

            <div className="rounded-3xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}>
              <div className="grid md:grid-cols-3 gap-3">
                {phase1.map(agent => (
                  <AgentNode key={agent.id} agent={agent} state={agentStates[agent.id]} findingsN={agentFindings[agent.id] || 0} />
                ))}
              </div>

              <div className="flex flex-col items-center my-5">
                <div className="w-px h-6" style={{ background: phase1Done ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.08)' }} />
                <div className="px-4 py-2 rounded-full text-[10px] font-mono font-bold"
                  style={{
                    background: phase1Done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                    border: phase1Done ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                    color: phase1Done ? C.green : '#64748b',
                  }}>
                  {phase1Done ? 'Parallel evidence intake complete' : 'Waiting for parallel evidence intake'}
                </div>
                <div className="w-px h-6" style={{ background: phase1Done ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.08)' }} />
              </div>

              <div className="grid lg:grid-cols-5 gap-3">
                {[...phase2, ...phase3].map(agent => (
                  <AgentNode key={agent.id} agent={agent} state={agentStates[agent.id]} findingsN={agentFindings[agent.id] || 0} compact />
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}>
                <div className="text-[10px] font-mono uppercase text-slate-500 mb-3">Evidence Routed Into Pipeline</div>
                <div className="grid grid-cols-2 gap-3">
                  <StatusChip tone={inputSummary.reportLoaded ? 'good' : 'warn'} label="Autopsy Report" detail={inputSummary.reportLoaded ? `${inputSummary.reportChars.toLocaleString()} chars` : 'No report loaded'} icon={FileText} />
                  <StatusChip tone={inputSummary.frames ? 'good' : 'neutral'} label="CCTV Frames" detail={`${inputSummary.frames} frame${inputSummary.frames !== 1 ? 's' : ''}`} icon={ImagePlus} />
                  <StatusChip tone={inputSummary.toxicology ? 'info' : 'neutral'} label="Toxicology Inputs" detail={`${inputSummary.toxicology} substance${inputSummary.toxicology !== 1 ? 's' : ''}`} icon={FlaskConical} />
                  <StatusChip tone={inputSummary.evidence ? 'info' : 'neutral'} label="Evidence Items" detail={`${inputSummary.evidence} timeline entries`} icon={MapPin} />
                </div>
              </div>
              <div className="rounded-2xl p-4 max-h-48 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.28)', border: `1px solid ${C.border}` }}>
                <div className="text-[10px] font-mono uppercase text-slate-500 mb-3">Runtime Log</div>
                {streamLog.map((msg, i) => <div key={i} className="text-[10px] font-mono text-slate-400 leading-5">{msg}</div>)}
                <div ref={logEndRef} />
              </div>
            </div>
          </SectionFrame>

          <div className="space-y-5">
            <SectionFrame title="Live Findings Feed" icon={Eye} color={C.green}>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {liveFindings.length === 0 && (
                  <div className="text-center py-12 text-[10px] text-slate-600 font-mono">Waiting for streamed findings from the first responding agent…</div>
                )}
                <AnimatePresence>
                  {liveFindings.slice().reverse().map((finding, index) => {
                    const severity = SEV[finding.severity] || SEV.INFO
                    return (
                      <motion.div
                        key={`${findingKey(finding)}-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl p-3"
                        style={{ background: severity.bg, border: `1px solid ${severity.border}` }}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="text-[8px] font-mono font-bold px-2 py-1 rounded-full"
                            style={{ background: 'rgba(0,0,0,0.25)', color: severity.text }}>
                            {finding.type || 'FINDING'}
                          </span>
                          <div className="text-[8px] font-mono text-slate-500">
                            {normalizeAgentId(finding.agent)} {finding.confidence ? `· ${(finding.confidence * 100).toFixed(0)}%` : ''}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-100 leading-relaxed">{finding.content}</div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </SectionFrame>

            <SectionFrame title="Dynamic Summary" icon={Brain} color={C.purple}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <StatusChip tone={runningAgents.length ? 'info' : 'neutral'} label="Active Agents" detail={runningAgents.length ? runningAgents.map(agent => agent.name).join(' • ') : 'No stage executing right now'} icon={Activity} />
                <StatusChip tone={threadId ? 'good' : 'neutral'} label="Thread State" detail={threadId || 'Awaiting thread'} icon={Database} />
              </div>
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}>
                <div className="text-[11px] text-slate-300 leading-7">
                  {liveFindings.length > 0
                    ? `The pipeline has produced ${liveFindings.length} live finding${liveFindings.length !== 1 ? 's' : ''}, ${liveCorrelations.length} correlation${liveCorrelations.length !== 1 ? 's' : ''}, and ${liveLeads.length} investigative lead${liveLeads.length !== 1 ? 's' : ''}. Risk scoring ${riskScore != null ? `is currently ${riskScore}/100 (${riskLevel}).` : 'has not emitted yet.'}`
                    : 'No agent has emitted a finding yet. The page will update the moment an agent publishes its first result.'}
                </div>
              </div>
            </SectionFrame>
          </div>
        </div>

        <AnimatePresence>
          {interrupted && interruptData && <HITLModal data={interruptData} onDecide={onDecide} />}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ═══ STAGE 2: RESULTS ════════════════════════════════════════════════════════

function ResultsStage({ results, input, onReset, platform = DEFAULT_PLATFORM_STATE }) {
  const score   = results?.risk_score ?? 0
  const level   = results?.risk_level ?? riskLabel(score)
  const factors = results?.risk_factors || {}
  const findings    = useMemo(() => results?.findings || [], [results])
  const correlations= useMemo(() => results?.correlations || [], [results])
  const leads       = results?.investigative_leads || []
  const explanation = results?.explanation || ''
  const completedAgents = results?.completed_agents || AGENTS.map(agent => agent.id)
  const inputSummary = summarizeInput(input)
  const findingsByAgent = countFindingsByAgent(findings)

  const critical = findings.filter(f => f.severity === 'CRITICAL')
  const high     = findings.filter(f => f.severity === 'HIGH')
  const rest     = findings.filter(f => !['CRITICAL','HIGH'].includes(f.severity))

  const typeColor = { causal: C.red, temporal: C.cyan, behavioral: C.purple, forensic: C.green }
  const verdict = critical[0]?.content || explanation.split('\n').find(Boolean) || 'Investigation complete. Review summarized findings below.'
  const handleDownloadPdf = useCallback(() => {
    const printableHtml = buildPrintableReportHtml({ input, results, platform })
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900')

    if (!printWindow) {
      window.alert('Popup blocked. Allow popups for this site to export the PDF.')
      return
    }

    printWindow.document.open()
    printWindow.document.write(printableHtml)
    printWindow.document.close()
  }, [input, platform, results])

  return (
    <div className="h-full overflow-y-auto" style={{ background: C.bg }}>
      <div className="max-w-[1500px] mx-auto px-6 py-6 space-y-5">
        <div className="rounded-[30px] p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(6,15,27,0.98) 0%, rgba(9,18,35,0.95) 55%, rgba(19,14,35,0.96) 100%)',
            border: `1px solid ${riskColor(score)}24`,
            boxShadow: `0 0 60px ${riskColor(score)}14`,
          }}>
          <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-5 items-center">
            <div className="flex flex-col md:flex-row gap-5 items-start">
              <div className="rounded-3xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${riskColor(score)}24` }}>
                <RiskGauge score={score} size={170} />
              </div>
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em]" style={{ color: riskColor(score) }}>
                  <Shield size={12} /> Case Verdict
                </div>
                <div className="text-3xl font-black text-white leading-tight">
                  {level} risk profile for case {input.caseId}
                </div>
                <div className="text-[12px] text-slate-300 leading-7">{verdict}</div>
                <div className="grid md:grid-cols-3 gap-3 pt-1">
                  <StatusChip tone="good" label="Agents Closed" detail={`${completedAgents.length || AGENTS.length}/8 completed`} icon={CheckCircle} />
                  <StatusChip tone={platform.status?.ai_available ? 'good' : 'warn'} label="LLM Provider" detail={platform.status?.ai_available ? `${platform.status?.llm_provider}` : 'Fallback output detected'} icon={Brain} />
                  <StatusChip tone={platform.langgraph?.available ? 'good' : 'bad'} label="LangGraph" detail={platform.langgraph?.available ? 'Realtime orchestration active' : 'Unavailable'} icon={ScanSearch} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Total Findings" value={findings.length} detail={`${critical.length} critical · ${high.length} high`} color={C.cyan} icon={Eye} />
              <MetricCard label="Correlations" value={correlations.length} detail="Evidence relationships" color={C.purple} icon={Link2} />
              <MetricCard label="Investigative Leads" value={leads.length} detail="Actionable next steps" color={C.amber} icon={Target} />
              <MetricCard label="Evidence Coverage" value={inputSummary.evidence + inputSummary.frames + inputSummary.toxicology} detail={`${inputSummary.reportLoaded ? 'report' : 'no report'} · ${inputSummary.frames} frames`} color={C.green} icon={Database} />
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-5">
          <SectionFrame title="Priority Findings" icon={Eye} color={C.cyan}>
            <div className="flex gap-2 text-[9px] font-mono mb-4 flex-wrap">
              {critical.length > 0 && <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: C.red }}>{critical.length} critical</span>}
              {high.length > 0 && <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(249,115,22,0.12)', color: C.orange }}>{high.length} high</span>}
              {rest.length > 0 && <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>{rest.length} supporting</span>}
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {[...critical, ...high, ...rest].map((finding, index) => {
                const severity = SEV[finding.severity] || SEV.INFO
                return (
                  <motion.div
                    key={`${findingKey(finding)}-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="p-4 rounded-2xl"
                    style={{ background: severity.bg, border: `1px solid ${severity.border}` }}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-mono font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.25)', color: severity.text }}>
                          {finding.type || 'FINDING'}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">{normalizeAgentId(finding.agent)}</span>
                      </div>
                      {finding.confidence && <span className="text-[9px] font-mono text-slate-500">{(finding.confidence * 100).toFixed(0)}%</span>}
                    </div>
                    <div className="text-[12px] text-slate-100 leading-7">{finding.content}</div>
                  </motion.div>
                )
              })}
            </div>
          </SectionFrame>

          <div className="space-y-5">
            <SectionFrame title="Agent Contribution Matrix" icon={Activity} color={C.green}>
              <div className="grid grid-cols-2 gap-3">
                {AGENTS.map(agent => {
                  const done = completedAgents.includes(agent.id)
                  const count = findingsByAgent[agent.id] || 0
                  return (
                    <div key={agent.id} className="rounded-2xl p-3"
                      style={{ background: done ? `${agent.color}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${done ? `${agent.color}30` : 'rgba(255,255,255,0.08)'}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{agent.icon}</span>
                          <div>
                            <div className="text-[11px] font-bold text-white">{agent.name}</div>
                            <div className="text-[9px] font-mono text-slate-500">{agent.model}</div>
                          </div>
                        </div>
                        {done ? <CheckCircle size={13} className="text-green-400" /> : <Clock size={13} className="text-slate-600" />}
                      </div>
                      <div className="text-[10px] font-mono mt-3" style={{ color: done ? agent.color : '#64748b' }}>
                        {count} finding{count !== 1 ? 's' : ''} attributed
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionFrame>

            <SectionFrame title="Evidence Coverage" icon={Database} color={C.amber}>
              <div className="grid grid-cols-2 gap-3">
                <StatusChip tone={inputSummary.reportLoaded ? 'good' : 'warn'} label="Autopsy Report" detail={inputSummary.reportLoaded ? `${inputSummary.reportChars.toLocaleString()} chars parsed` : 'Missing'} icon={FileText} />
                <StatusChip tone={inputSummary.frames > 0 ? 'good' : 'neutral'} label="CCTV Frames" detail={`${inputSummary.frames} visual input${inputSummary.frames !== 1 ? 's' : ''}`} icon={ImagePlus} />
                <StatusChip tone={inputSummary.toxicology > 0 ? 'info' : 'neutral'} label="Toxicology" detail={`${inputSummary.toxicology} record${inputSummary.toxicology !== 1 ? 's' : ''}`} icon={FlaskConical} />
                <StatusChip tone={inputSummary.evidence > 0 ? 'info' : 'neutral'} label="Timeline Evidence" detail={`${inputSummary.evidence} item${inputSummary.evidence !== 1 ? 's' : ''}`} icon={MapPin} />
              </div>
            </SectionFrame>
          </div>
        </div>

        {Object.keys(factors).length > 0 && (
          <SectionFrame title="Risk Factor Breakdown" icon={Shield} color={riskColor(score)}>
            <div className="grid md:grid-cols-3 gap-4">
              {Object.entries(factors).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-400 capitalize">{key}</span>
                    <span className="font-bold font-mono" style={{ color: riskColor(value) }}>{value}/100</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div className="h-full rounded-full"
                      initial={{ width: 0 }} animate={{ width: `${value}%` }}
                      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                      style={{ background: riskColor(value), boxShadow: `0 0 8px ${riskColor(value)}60` }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionFrame>
        )}

        <div className="grid xl:grid-cols-2 gap-5">
          <SectionFrame title={`Evidence Correlations (${correlations.length})`} icon={Link2} color={C.purple}>
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {correlations.length === 0 && (
                <div className="text-[11px] text-slate-500">No explicit cross-evidence correlations were emitted for this run.</div>
              )}
              {correlations.map((correlation, index) => (
                <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="p-4 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${typeColor[correlation.type] || C.cyan}25` }}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-bold" style={{ color: typeColor[correlation.type] || C.cyan }}>{correlation.source}</span>
                    <ArrowRight size={10} className="text-slate-600" />
                    <span className="text-xs font-bold text-white">{correlation.target}</span>
                    <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: `${typeColor[correlation.type] || C.cyan}15`, color: typeColor[correlation.type] || C.cyan }}>
                      {correlation.type} · {((correlation.strength || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 leading-7">{correlation.description}</div>
                </motion.div>
              ))}
            </div>
          </SectionFrame>

          <SectionFrame title={`Investigative Leads (${leads.length})`} icon={Target} color={C.green}>
            <div className="space-y-3">
              {leads.length === 0 && (
                <div className="text-[11px] text-slate-500">No lead recommendations were generated for this run.</div>
              )}
              {leads.map((lead, index) => (
                <div key={index} className="flex items-start gap-3 p-4 rounded-2xl"
                  style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.16)' }}>
                  <ChevronRight size={13} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
                  <span className="text-[12px] text-slate-100 leading-7">{lead}</span>
                </div>
              ))}
            </div>
          </SectionFrame>
        </div>

        {explanation && (
          <SectionFrame title="AI Explanation" icon={Lightbulb} color={C.cyan}>
            <div className="text-[12px] text-slate-300 leading-7 font-mono whitespace-pre-wrap">{explanation}</div>
          </SectionFrame>
        )}

        <div className="flex justify-center gap-3 pb-6">
          <button onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.22)', color: C.cyan }}>
            <FileText size={13} />Download PDF
          </button>
          <button onClick={onReset}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: '#94a3b8' }}>
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
  const [liveCorrelations, setLiveCorrelations] = useState([])
  const [liveLeads,     setLiveLeads]     = useState([])
  const [streamLog,     setStreamLog]     = useState([])
  const [completedAgents,setCompletedAgents]= useState([])
  const [threadId,      setThreadId]      = useState(null)
  const [riskScore,     setRiskScore]     = useState(null)
  const [riskLevel,     setRiskLevel]     = useState('UNKNOWN')
  const [interrupted,   setInterrupted]   = useState(false)
  const [interruptData, setInterruptData] = useState(null)
  const [results,       setResults]       = useState(null)
  const [platform,      setPlatform]      = useState(DEFAULT_PLATFORM_STATE)
  const [streamState,   setStreamState]   = useState({ state: 'idle', message: 'Idle', startedAt: null, lastEventAt: null })
  const abortRef = useRef(null)
  const completedCount = completedAgents.length

  const addLog = (msg) => setStreamLog(p => [...p.slice(-59), msg])

  const refreshPlatformStatus = useCallback(async () => {
    setPlatform(prev => ({ ...prev, loading: true, error: '' }))
    const [healthRes, statusRes, langgraphRes, agentsRes] = await Promise.allSettled([
      api.getHealth(),
      api.getStatus(),
      api.getLangGraphStatus(),
      api.getAgentsStatus(),
    ])

    const next = {
      loading: false,
      health: healthRes.status === 'fulfilled' ? healthRes.value : null,
      status: statusRes.status === 'fulfilled' ? statusRes.value : null,
      langgraph: langgraphRes.status === 'fulfilled' ? langgraphRes.value : null,
      agents: agentsRes.status === 'fulfilled' ? agentsRes.value : null,
      error: [healthRes, statusRes, langgraphRes, agentsRes].find(result => result.status === 'rejected')?.reason?.message || '',
    }

    setPlatform(next)
    return next
  }, [])

  useEffect(() => {
    refreshPlatformStatus()
    const timer = setInterval(refreshPlatformStatus, 30000)
    return () => clearInterval(timer)
  }, [refreshPlatformStatus])

  const reset = useCallback(() => {
    abortRef.current?.()
    setStage(0); setAgentStates({}); setAgentFindings({}); setLiveFindings([]); setLiveCorrelations([]); setLiveLeads([])
    setStreamLog([]); setCompletedAgents([]); setThreadId(null)
    setRiskScore(null); setRiskLevel('UNKNOWN')
    setInterrupted(false); setInterruptData(null); setResults(null)
    setStreamState({ state: 'idle', message: 'Idle', startedAt: null, lastEventAt: null })
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
        completed_agents: AGENTS.map(agent => agent.id),
      }
      setLiveLeads(consensus.recommended_actions || [])
      setResults(mappedResults)
      setRiskScore(mappedResults.risk_score)
      setRiskLevel(mappedResults.risk_level)
      setStreamState(prev => ({ ...prev, state: 'closed', message: 'Legacy snapshot complete', lastEventAt: Date.now() }))
      addLog(`🏁 Complete — Risk: ${mappedResults.risk_score}/100`)
      setStage(2)
    } catch (e) {
      addLog(`❌ ${e.message}`)
      setStreamState(prev => ({ ...prev, state: 'error', message: e.message, lastEventAt: Date.now() }))
    }
  }, [input.caseId, markAgentDone])

  const handleEvent = useCallback((event) => {
    if (event.type === 'connection') {
      const message = event.error || (
        event.state === 'open' ? 'SSE connected' :
        event.state === 'closed' ? 'Stream closed' :
        event.state === 'connecting' ? 'Connecting to investigation stream…' :
        'Stream error'
      )
      setStreamState(prev => ({
        ...prev,
        state: event.state || prev.state,
        message,
        lastEventAt: Date.now(),
      }))
      if (event.state === 'open') addLog('🛰 Realtime stream connected')
      if (event.state === 'error') addLog(`❌ ${message}`)
    } else if (event.type === 'thread_id') {
      setThreadId(event.thread_id)
      setStreamState(prev => ({ ...prev, lastEventAt: Date.now() }))
      addLog(`🔗 Thread ${event.thread_id.slice(0, 8)}…`)
    } else if (event.type === 'agent_update') {
      const id = normalizeAgentId(event.agent)
      setStreamState(prev => ({ ...prev, lastEventAt: Date.now() }))
      if (id === 'phase1_join') { addLog('⚡ Phase 1 done → sequential phase'); return }
      markAgentDone(id, event.findings?.length || event.new_findings || 0)
      addLog(`✓ ${id} — ${event.new_findings || 0} findings`)
      if (event.risk_score != null) { setRiskScore(event.risk_score); setRiskLevel(event.risk_level || 'UNKNOWN') }
      if (event.errors?.length)    addLog(`⚠ ${event.errors[0]}`)
      if (event.findings?.length) {
        setLiveFindings(prev => mergeUniqueFindings(prev, event.findings))
      }
      if (event.correlations?.length) {
        setLiveCorrelations(prev => mergeUniqueCorrelations(prev, event.correlations))
      }
      if (event.investigative_leads?.length) {
        setLiveLeads(prev => mergeUniqueStrings(prev, event.investigative_leads))
      }
      const nxt = NEXT_AGENT[id]
      if (nxt) setAgentStates(p => ({ ...p, [nxt]: p[nxt] === 'done' ? 'done' : 'running' }))
    } else if (event.type === 'interrupt') {
      const payload = event.data?.[0]?.value || {}
      setInterrupted(true); setInterruptData(payload)
      setStreamState(prev => ({ ...prev, lastEventAt: Date.now(), message: 'Awaiting human review' }))
      addLog('⏸ Human review required')
    } else if (event.type === 'complete') {
      if (event.findings?.length) {
        setLiveFindings(event.findings.map(finding => ({ ...finding, agent: normalizeAgentId(finding.agent) })))
      }
      if (event.correlations?.length) {
        setLiveCorrelations(event.correlations)
      }
      if (event.investigative_leads?.length) {
        setLiveLeads(event.investigative_leads)
      }
      setResults({
        ...event,
        findings: (event.findings || []).map(finding => ({ ...finding, agent: normalizeAgentId(finding.agent) })),
      })
      setRiskScore(event.risk_score ?? riskScore)
      setRiskLevel(event.risk_level ?? riskLevel)
      setStreamState(prev => ({ ...prev, state: 'closed', message: 'Stream complete', lastEventAt: Date.now() }))
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
        setStreamState(prev => ({ ...prev, state: 'error', message: e, lastEventAt: Date.now() }))
        addLog(`❌ ${e}`)
      }
    }
  }, [riskScore, riskLevel, runClassicFallback, markAgentDone])

  const launch = useCallback(async () => {
    const platformSnapshot = await refreshPlatformStatus()
    reset()
    setStage(1)
    setStreamState({ state: 'connecting', message: 'Connecting to investigation stream…', startedAt: Date.now(), lastEventAt: null })
    // Phase 1 agents all start in parallel
    setAgentStates({ autopsy: 'running', timeline: 'running', cctv: 'running' })
    addLog(`🚀 Case ${input.caseId} — launching 8-agent pipeline`)
    if (platformSnapshot?.status?.ai_available === false) {
      addLog('⚠ No LLM provider configured on backend — some agents may fall back')
    }
    if (platformSnapshot?.langgraph?.available === false) {
      addLog(`⚠ LangGraph unavailable: ${platformSnapshot?.langgraph?.error || 'unknown error'}`)
    }

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
  }, [input, reset, handleEvent, refreshPlatformStatus])

  const handleHITL = useCallback((decision) => {
    setInterrupted(false); setInterruptData(null)
    addLog(`👤 Human: ${decision.toUpperCase()}`)
    setStreamState(prev => ({ ...prev, state: 'connecting', message: 'Resuming investigation…', lastEventAt: Date.now() }))
    const abort = api.resumeInvestigation(threadId, decision, handleEvent)
    abortRef.current = abort
  }, [threadId, handleEvent])

  return (
    <div className="h-full overflow-hidden" style={{ background: C.bg }}>
      <AnimatePresence mode="wait">
        {stage === 0 && (
          <motion.div key="input" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <InputStage input={input} setInput={setInput} onLaunch={launch} platform={platform} onRefreshPlatform={refreshPlatformStatus} />
          </motion.div>
        )}
        {stage === 1 && (
          <motion.div key="pipeline" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PipelineStage
              agentStates={agentStates} agentFindings={agentFindings}
              liveFindings={liveFindings} liveCorrelations={liveCorrelations} liveLeads={liveLeads} streamLog={streamLog}
              completedCount={completedCount} riskScore={riskScore} riskLevel={riskLevel}
              interrupted={interrupted} interruptData={interruptData}
              onDecide={handleHITL} onReset={reset} threadId={threadId}
              platform={platform} streamState={streamState} input={input}
            />
          </motion.div>
        )}
        {stage === 2 && (
          <motion.div key="results" className="h-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <ResultsStage results={results} input={input} onReset={reset} platform={platform} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
