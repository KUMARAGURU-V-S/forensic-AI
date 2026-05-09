/**
 * IntelligenceView — Multi-tool Intelligence Engine
 * Tabs: Multi-Agent | Cross-Case | TOD Analysis | Auto-Correlate | NL Query
 * Wired to /api/intelligence/ endpoints.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, Bot, Network, Clock, Link2, Search, Play, ChevronRight,
  AlertTriangle, CheckCircle, Loader2, BarChart3, Target, FileText,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useForensicStore } from '../../lib/store'

const C = {
  cyan: '#00d4ff', green: '#10b981', amber: '#f59e0b', red: '#ef4444',
  purple: '#8b5cf6', border: 'rgba(0,212,255,0.08)', card: 'rgba(7,14,32,0.85)', bg: 'rgba(4,8,18,0.97)',
}

const TABS = [
  { id: 'multiagent', label: 'Multi-Agent',    icon: Bot,       color: C.cyan },
  { id: 'crosscase',  label: 'Cross-Case',     icon: Network,   color: C.purple },
  { id: 'tod',        label: 'TOD Analysis',   icon: Clock,     color: C.amber },
  { id: 'correlate',  label: 'Correlate',      icon: Link2,     color: C.green },
  { id: 'query',      label: 'NL Query',       icon: Search,    color: '#ec4899' },
]

function TabBtn({ tab, active, onClick }) {
  const Icon = tab.icon
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all"
      style={{
        background: active ? `${tab.color}18` : 'transparent',
        border: `1px solid ${active ? tab.color + '40' : 'transparent'}`,
        color: active ? tab.color : '#475569',
      }}>
      <Icon size={13} />
      {tab.label}
    </button>
  )
}

function ResultCard({ label, value, color = C.cyan }) {
  return (
    <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.06)` }}>
      <div className="text-lg font-black mb-0.5" style={{ color }}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}

function RunBtn({ onClick, loading, label = 'Run Analysis', color = C.cyan }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all disabled:opacity-40"
      style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
      {loading ? 'Running…' : label}
    </button>
  )
}

// ─── Multi-Agent Tab ──────────────────────────────────────────────────────────
function MultiAgentTab({ caseId }) {
  const [reportText, setReportText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await api.runMultiAgent(reportText || undefined, [], caseId)
      setResult(r)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-[11px] font-bold text-white mb-3 flex items-center gap-2">
          <Bot size={13} style={{ color: C.cyan }} />ORCHESTRATED MULTI-AGENT ANALYSIS
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Runs all 7 forensic AI agents in sequence — autopsy NER, timeline reconstruction, TOD estimation,
          risk scoring, SHAP explainability, evidence correlation, and findings prioritization.
        </p>
        <div className="mb-4">
          <label className="text-[10px] text-slate-500 font-mono uppercase block mb-1.5">
            Report Text <span className="text-slate-600">(optional — uses case data if empty)</span>
          </label>
          <textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={4}
            placeholder="Paste autopsy report or evidence notes here…"
            className="w-full text-xs resize-none rounded-xl px-4 py-3 text-slate-300 placeholder-slate-600 font-mono focus:outline-none leading-relaxed"
            style={{ background: 'rgba(4,8,18,0.9)', border: `1px solid ${C.border}` }} />
        </div>
        <RunBtn onClick={run} loading={loading} label="Launch All 7 Agents" />
      </div>

      {error && <div className="p-3 rounded-xl text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Summary metrics */}
          {result.orchestration && (
            <div className="grid grid-cols-4 gap-3">
              <ResultCard label="Agents Invoked" value={result.orchestration.total_agents_invoked} color={C.cyan} />
              <ResultCard label="Exec Time" value={`${result.orchestration.execution_time_ms}ms`} color={C.green} />
              <ResultCard label="Parallel Tasks" value={result.orchestration.parallel_tasks} color={C.amber} />
              <ResultCard label="Consensus" value={`${((result.consensus?.confidence||0)*100).toFixed(0)}%`} color={C.purple} />
            </div>
          )}

          {/* Agent outputs */}
          {result.agent_outputs?.map((out, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-white">{out.agent?.replace(/_/g,' ').toUpperCase()}</span>
                <span className="text-[10px] font-mono" style={{ color: C.cyan }}>{((out.confidence||0)*100).toFixed(0)}% • {out.processing_time_ms}ms</span>
              </div>
              <div className="space-y-1">
                {(out.findings||[]).map((f, j) => (
                  <div key={j} className="text-[11px] text-slate-300 flex gap-2">
                    <ChevronRight size={11} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />{f}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Consensus */}
          {result.consensus && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="text-xs font-bold mb-2" style={{ color: C.green }}>🎯 CONSENSUS: {result.consensus.primary_suspect}</div>
              <div className="text-[11px] text-slate-400 mb-3">Evidence: <span className="text-white font-bold">{result.consensus.evidence_strength?.toUpperCase()}</span></div>
              {result.consensus.recommended_actions?.map((a, i) => (
                <div key={i} className="text-[11px] text-slate-300 pl-3 border-l-2 mb-1" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>{a}</div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ─── Cross-Case Tab ───────────────────────────────────────────────────────────
function CrossCaseTab() {
  const [sig, setSig] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const run = async () => {
    if (!sig.trim()) return
    setLoading(true); setError(''); setResult(null)
    try { setResult(await api.runCrossCase(sig.trim())) } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-[11px] font-bold text-white mb-3 flex items-center gap-2">
          <Network size={13} style={{ color: C.purple }} />CROSS-CASE PATTERN MATCHING
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Search the case database for similar cases using a behavioral or forensic signature.
          Identifies patterns across multiple investigations.
        </p>
        <div className="mb-4">
          <label className="text-[10px] text-slate-500 font-mono uppercase block mb-1.5">Case Signature</label>
          <textarea value={sig} onChange={e => setSig(e.target.value)} rows={3}
            placeholder="e.g. blunt force trauma + sedative in toxicology + missing surveillance footage..."
            className="w-full text-xs resize-none rounded-xl px-4 py-3 text-slate-300 placeholder-slate-600 font-mono focus:outline-none leading-relaxed"
            style={{ background: 'rgba(4,8,18,0.9)', border: `1px solid ${C.border}` }} />
        </div>
        <RunBtn onClick={run} loading={loading} label="Search Similar Cases" color={C.purple} />
      </div>

      {error && <div className="p-3 rounded-xl text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {result.similar_cases?.length > 0 ? result.similar_cases.map((c, i) => (
            <div key={i} className="p-3 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-white">{c.case_id}</span>
                <span className="text-[10px] font-mono" style={{ color: C.purple }}>{((c.similarity||0)*100).toFixed(0)}% match</span>
              </div>
              <div className="text-[11px] text-slate-400">{c.description || c.signature}</div>
            </div>
          )) : (
            <div className="p-4 rounded-xl text-center text-[11px] text-slate-500" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              {result.message || 'No similar cases found in database.'}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ─── TOD Tab ──────────────────────────────────────────────────────────────────
function TODTab() {
  const [form, setForm] = useState({ body_temp: 32, ambient_temp: 22, body_weight: 70, elapsed_hours: null })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const run = async () => {
    setLoading(true); setError(''); setResult(null)
    try { setResult(await api.runDualTod(form)) } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const fields = [
    { key: 'body_temp',    label: 'Body Temperature (°C)',  placeholder: '32' },
    { key: 'ambient_temp', label: 'Ambient Temperature (°C)', placeholder: '22' },
    { key: 'body_weight',  label: 'Body Weight (kg)',        placeholder: '70' },
    { key: 'elapsed_hours', label: 'Known Elapsed Hours',   placeholder: 'leave blank if unknown' },
  ]

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-[11px] font-bold text-white mb-3 flex items-center gap-2">
          <Clock size={13} style={{ color: C.amber }} />DUAL-METHOD TOD ESTIMATION
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Estimates post-mortem interval using the <strong className="text-white">Henssge Nomogram</strong> (1988)
          and Algor Mortis cooling curve. Produces a confidence-weighted PMI window.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-[10px] text-slate-500 font-mono uppercase block mb-1">{f.label}</label>
              <input type="number" placeholder={f.placeholder}
                value={form[f.key] ?? ''}
                onChange={e => set(f.key, e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full text-xs rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-forensic-cyan"
                style={{ background: 'rgba(4,8,18,0.9)', border: `1px solid ${C.border}` }} />
            </div>
          ))}
        </div>
        <RunBtn onClick={run} loading={loading} label="Estimate TOD" color={C.amber} />
      </div>

      {error && <div className="p-3 rounded-xl text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <ResultCard label="PMI Low (hrs)" value={result.pmi_low?.toFixed(1) ?? result.pmi_hours?.toFixed(1) ?? '—'} color={C.amber} />
            <ResultCard label="PMI High (hrs)" value={result.pmi_high?.toFixed(1) ?? '—'} color={C.amber} />
            <ResultCard label="Confidence" value={result.confidence ? `${(result.confidence*100).toFixed(0)}%` : '—'} color={C.green} />
          </div>
          {result.method && (
            <div className="p-3 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="text-[10px] text-slate-500 mb-1 font-mono">Method: {result.method}</div>
              {result.interpretation && <div className="text-[11px] text-slate-300">{result.interpretation}</div>}
              {result.henssge_b && <div className="text-[10px] text-slate-500 mt-1 font-mono">Henssge B={result.henssge_b?.toFixed(4)} • Wc={result.corrective_factor?.toFixed(2)}</div>}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ─── Correlate Tab ────────────────────────────────────────────────────────────
function CorrelateTab({ caseId }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true); setError(''); setResult(null)
    try { setResult(await api.autoCorrelate(caseId)) } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const typeColor = { causal: '#ef4444', temporal: '#00d4ff', behavioral: '#8b5cf6', forensic: '#10b981' }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-[11px] font-bold text-white mb-3 flex items-center gap-2">
          <Link2 size={13} style={{ color: C.green }} />EVIDENCE CORRELATION ENGINE
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Automatically discovers causal, temporal, and behavioral correlations across all evidence
          items in Case {caseId}. Uses graph-based pattern matching + semantic similarity.
        </p>
        <RunBtn onClick={run} loading={loading} label={`Correlate Case ${caseId}`} color={C.green} />
      </div>

      {error && <div className="p-3 rounded-xl text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {result.correlations?.length > 0 ? (
            <>
              <div className="text-[10px] text-slate-500 font-mono">{result.correlations.length} correlations found</div>
              {result.correlations.map((c, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-bold" style={{ color: typeColor[c.type] || C.cyan }}>{c.source}</span>
                    <ChevronRight size={10} className="text-slate-600" />
                    <span className="text-xs font-bold text-white">{c.target}</span>
                    <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: `${typeColor[c.type] || C.cyan}20`, color: typeColor[c.type] || C.cyan }}>
                      {c.type} • {((c.strength||0)*100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{c.description}</div>
                </div>
              ))}
            </>
          ) : (
            <div className="p-4 text-center text-[11px] text-slate-500 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              {result.message || 'No correlations found with current evidence set.'}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ─── NL Query Tab ─────────────────────────────────────────────────────────────
function NLQueryTab({ caseId }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  const run = async () => {
    if (!query.trim()) return
    const q = query.trim()
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await api.runNLQuery(q, [])
      setResult(r)
      setHistory(prev => [{ q, r }, ...prev.slice(0, 4)])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run() } }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-[11px] font-bold text-white mb-3 flex items-center gap-2">
          <Search size={13} style={{ color: '#ec4899' }} />NATURAL LANGUAGE QUERY
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Ask questions about Case {caseId} in plain language. The AI searches evidence,
          findings, and the GraphRAG knowledge base to answer.
        </p>
        <div className="flex gap-2 mb-2">
          <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey} rows={2}
            placeholder="What evidence suggests this was a homicide? / Who was at the scene at 11pm? / What's the most suspicious finding?"
            className="flex-1 text-xs resize-none rounded-xl px-4 py-3 text-slate-300 placeholder-slate-600 font-mono focus:outline-none leading-relaxed"
            style={{ background: 'rgba(4,8,18,0.9)', border: `1px solid ${C.border}` }} />
          <RunBtn onClick={run} loading={loading} label="Ask" color="#ec4899" />
        </div>
      </div>

      {error && <div className="p-3 rounded-xl text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid #ec489930` }}>
          <div className="text-[10px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-2">
            <CheckCircle size={10} style={{ color: '#ec4899' }} />Answer
          </div>
          <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-mono">
            {result.answer || result.response || JSON.stringify(result, null, 2)}
          </div>
          {result.confidence && (
            <div className="text-[10px] text-slate-500 mt-2 font-mono">Confidence: {(result.confidence*100).toFixed(0)}%</div>
          )}
        </motion.div>
      )}

      {history.length > 0 && !result && (
        <div>
          <div className="text-[10px] text-slate-600 font-mono mb-2">Recent queries</div>
          {history.map((h, i) => (
            <button key={i} onClick={() => { setQuery(h.q); setResult(h.r) }}
              className="w-full text-left px-3 py-2 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-white/5 transition-all mb-1">
              {h.q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IntelligenceView({ caseId }) {
  const [tab, setTab] = useState('multiagent')
  const store = useForensicStore()
  const activeCaseId = caseId || store.caseId || 'FTI-2024-0847'

  return (
    <div className="flex h-full overflow-hidden" style={{ background: C.bg }}>
      <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-[15px] font-black text-white flex items-center gap-2 mb-1">
            <Cpu size={16} style={{ color: C.cyan }} />Intelligence Engine
          </h1>
          <p className="text-[11px] text-slate-500 font-mono">Case {activeCaseId} • Multi-agent orchestration, cross-case analysis & forensic NL queries</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          {TABS.map(t => (
            <TabBtn key={t.id} tab={t} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}>
            {tab === 'multiagent' && <MultiAgentTab caseId={activeCaseId} />}
            {tab === 'crosscase'  && <CrossCaseTab />}
            {tab === 'tod'        && <TODTab />}
            {tab === 'correlate'  && <CorrelateTab caseId={activeCaseId} />}
            {tab === 'query'      && <NLQueryTab caseId={activeCaseId} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right info panel */}
      <div className="w-56 flex-shrink-0 overflow-y-auto py-5 px-4 space-y-4"
        style={{ borderLeft: `1px solid ${C.border}` }}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Available Tools</div>
          <div className="space-y-2">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{
                    background: tab === t.id ? `${t.color}10` : 'transparent',
                    border: `1px solid ${tab === t.id ? t.color + '30' : 'transparent'}`,
                  }}>
                  <Icon size={13} style={{ color: t.color, flexShrink: 0 }} />
                  <div>
                    <div className="text-[11px] font-bold" style={{ color: tab === t.id ? t.color : '#94a3b8' }}>{t.label}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-3 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">API Endpoints</div>
          {[
            '/api/intelligence/',
            '/api/analyze/',
            '/api/graphrag/retrieve',
          ].map(e => (
            <div key={e} className="text-[9px] font-mono text-slate-600 mb-0.5">{e}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
