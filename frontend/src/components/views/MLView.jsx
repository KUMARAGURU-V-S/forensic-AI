/**
 * MLView — HuggingFace ML Pipeline Tools
 * Tabs: NER Tagger | Text Classifier | Forensic AI Classifier
 * Wired to /api/ml/ endpoints.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FlaskConical, Tag, BarChart3, Microscope, Play, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { api } from '../../lib/api'

const C = {
  cyan: '#00d4ff', green: '#10b981', amber: '#f59e0b', purple: '#8b5cf6',
  border: 'rgba(0,212,255,0.08)', card: 'rgba(7,14,32,0.85)', bg: 'rgba(4,8,18,0.97)',
}

const TABS = [
  { id: 'ner',      label: 'NER Tagger',        icon: Tag,         color: C.cyan },
  { id: 'classify', label: 'Text Classifier',   icon: BarChart3,   color: C.purple },
  { id: 'forensic', label: 'Forensic AI',       icon: Microscope,  color: C.green },
]

const ENTITY_COLORS = {
  PER:  { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   text: '#fca5a5', label: 'PERSON' },
  PERSON: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)',   text: '#fca5a5', label: 'PERSON' },
  LOC:  { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)',  text: '#6ee7b7', label: 'LOCATION' },
  ORG:  { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)',  text: '#fcd34d', label: 'ORG' },
  MISC: { bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.4)', text: '#c4b5fd', label: 'MISC' },
  DATE: { bg: 'rgba(0,212,255,0.15)',   border: 'rgba(0,212,255,0.35)', text: '#7dd3fc', label: 'DATE' },
  TIME: { bg: 'rgba(0,212,255,0.12)',   border: 'rgba(0,212,255,0.3)',  text: '#7dd3fc', label: 'TIME' },
  NUM:  { bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)', text: '#fdba74', label: 'NUMBER' },
}

function entityColor(label) {
  const key = (label || '').toUpperCase().split('-').pop()
  return ENTITY_COLORS[key] || { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', text: '#94a3b8', label: key }
}

function EntityTag({ label, word }) {
  const c = entityColor(label)
  return (
    <span className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {word}
      <span className="text-[8px] opacity-70 font-bold">{c.label}</span>
    </span>
  )
}

function RunBtn({ onClick, loading, label = 'Run', color = C.cyan, disabled }) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all disabled:opacity-40"
      style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
      {loading ? 'Running…' : label}
    </button>
  )
}

const NER_SAMPLE = `The autopsy report of victim John Doe, conducted on October 14, 2024 at St. Mary's Hospital in Chicago, revealed blunt force trauma to the cranium. Traces of alprazolam and ethanol were found in the bloodstream. Detective Sarah Kim responded to the scene at 11:42 PM. The suspect vehicle, a gray Honda Civic, was captured on CCTV near Riverside Industrial Complex.`

const CLASSIFY_SAMPLE = `The victim's phone was found powered off at 11:47 PM, approximately 8 minutes after the last witnessed contact. CCTV footage shows a male figure departing at high speed via the north exit. Defensive wounds on the forearms indicate the victim resisted before incapacitation.`

const FORENSIC_SAMPLE = `Autopsy findings: Multiple blunt force injuries to the head and neck. Petechial hemorrhages in the conjunctivae. Subgaleal hemorrhage. Subdural hematoma. Fractures of the hyoid bone consistent with manual strangulation. Benzodiazepine level at 2.4x therapeutic threshold.`

// ─── NER Tab ─────────────────────────────────────────────────────────────────
function NERTab() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [entities, setEntities] = useState(null)
  const [error, setError] = useState('')

  const run = async () => {
    if (!text.trim()) return
    setLoading(true); setError(''); setEntities(null)
    try {
      const r = await api.runNER(text)
      setEntities(r.entities || r.result || r || [])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  // Highlight entities in original text
  const renderHighlighted = () => {
    if (!entities?.length) return null
    const sorted = [...entities].sort((a, b) => (a.start || 0) - (b.start || 0))
    const parts = []
    let cursor = 0
    for (const ent of sorted) {
      const start = ent.start ?? text.indexOf(ent.word)
      const end = ent.end ?? start + (ent.word?.length || 0)
      if (start < cursor || start >= text.length) continue
      if (start > cursor) parts.push(<span key={cursor} className="text-slate-300">{text.slice(cursor, start)}</span>)
      parts.push(<EntityTag key={start} label={ent.entity_group || ent.entity} word={ent.word || text.slice(start, end)} />)
      cursor = end
    }
    if (cursor < text.length) parts.push(<span key={cursor} className="text-slate-300">{text.slice(cursor)}</span>)
    return parts
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-[11px] font-bold text-white mb-3 flex items-center gap-2">
          <Tag size={13} style={{ color: C.cyan }} />NAMED ENTITY RECOGNITION
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Identifies persons, locations, organizations, dates, substances, and forensic entities
          using the <strong className="text-white">d4data/biomedical-ner-all</strong> HuggingFace model.
        </p>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-slate-500 font-mono uppercase">Input Text</label>
            <button onClick={() => setText(NER_SAMPLE)} className="text-[10px] text-slate-500 hover:text-slate-300">
              Load sample
            </button>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
            placeholder="Paste report text, evidence notes, or any forensic document…"
            className="w-full text-xs resize-none rounded-xl px-4 py-3 text-slate-300 placeholder-slate-600 font-mono focus:outline-none leading-relaxed"
            style={{ background: 'rgba(4,8,18,0.9)', border: `1px solid ${C.border}` }} />
        </div>
        <div className="flex gap-2">
          <RunBtn onClick={run} loading={loading} label="Tag Entities" disabled={!text.trim()} />
          {entities && <button onClick={() => { setEntities(null); setText('') }} className="text-slate-600 hover:text-slate-400"><RefreshCw size={13} /></button>}
        </div>
      </div>

      {error && <div className="p-3 rounded-xl text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>⚠️ {error}</div>}

      {entities && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Highlighted text */}
          <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <div className="text-[10px] text-slate-500 font-mono uppercase mb-3">Tagged Text</div>
            <div className="text-[12px] leading-8 font-mono">{renderHighlighted()}</div>
          </div>

          {/* Entity table */}
          {entities.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="text-[10px] text-slate-500 font-mono uppercase mb-3">{entities.length} entities detected</div>
              <div className="space-y-1.5">
                {entities.map((e, i) => {
                  const c = entityColor(e.entity_group || e.entity)
                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.04)` }}>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: c.bg, color: c.text }}>{c.label}</span>
                      <span className="text-xs text-slate-200 flex-1">{e.word}</span>
                      <span className="text-[10px] font-mono text-slate-500">{((e.score || 0) * 100).toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ─── Classify Tab ─────────────────────────────────────────────────────────────
function ClassifyTab() {
  const [text, setText] = useState('')
  const [labelsInput, setLabelsInput] = useState('homicide, suicide, accident, natural death, undetermined')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const run = async () => {
    if (!text.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const labels = labelsInput.split(',').map(l => l.trim()).filter(Boolean)
      const r = await api.classifyText(text, labels)
      setResult(r)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const scores = result?.scores || result?.result || []
  const labels = result?.labels || []
  const pairs = Array.isArray(scores)
    ? scores.map((s, i) => ({ label: labels[i] || `Class ${i}`, score: s }))
    : Object.entries(result || {}).map(([k, v]) => ({ label: k, score: v }))
  const sorted = [...pairs].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-[11px] font-bold text-white mb-3 flex items-center gap-2">
          <BarChart3 size={13} style={{ color: C.purple }} />ZERO-SHOT TEXT CLASSIFIER
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Classifies forensic text against any custom labels using zero-shot learning.
          No fine-tuning required — define labels at runtime.
        </p>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-slate-500 font-mono uppercase">Text</label>
            <button onClick={() => setText(CLASSIFY_SAMPLE)} className="text-[10px] text-slate-500 hover:text-slate-300">Sample</button>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
            placeholder="Paste evidence notes, witness statement, or case description…"
            className="w-full text-xs resize-none rounded-xl px-4 py-3 text-slate-300 placeholder-slate-600 font-mono focus:outline-none leading-relaxed"
            style={{ background: 'rgba(4,8,18,0.9)', border: `1px solid ${C.border}` }} />
        </div>
        <div className="mb-4">
          <label className="text-[10px] text-slate-500 font-mono uppercase block mb-1.5">Classification Labels (comma-separated)</label>
          <input value={labelsInput} onChange={e => setLabelsInput(e.target.value)}
            className="w-full text-xs rounded-xl px-4 py-2.5 text-slate-300 font-mono focus:outline-none"
            style={{ background: 'rgba(4,8,18,0.9)', border: `1px solid ${C.border}` }} />
        </div>
        <RunBtn onClick={run} loading={loading} label="Classify Text" color={C.purple} disabled={!text.trim()} />
      </div>

      {error && <div className="p-3 rounded-xl text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>⚠️ {error}</div>}

      {sorted.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl space-y-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="text-[10px] text-slate-500 font-mono uppercase">Classification Results</div>
          {sorted.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between mb-1 text-xs">
                <span className={`font-${i === 0 ? 'bold text-white' : 'normal text-slate-400'}`}>{item.label}</span>
                <span className="font-mono" style={{ color: i === 0 ? C.purple : '#475569' }}>
                  {((item.score || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.score || 0) * 100}%` }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  style={{ background: i === 0 ? C.purple : '#334155' }} />
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

// ─── Forensic AI Tab ──────────────────────────────────────────────────────────
function ForensicTab() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const run = async () => {
    if (!text.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await api.forensicClassify(text)
      setResult(r)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const CATEGORY_COLORS = {
    homicide: '#ef4444', suicide: '#f97316', accident: '#f59e0b',
    natural: '#10b981', undetermined: '#8b5cf6', suspicious: '#ec4899',
  }

  const cat = (result?.category || result?.label || '').toLowerCase()
  const catColor = CATEGORY_COLORS[cat] || C.cyan

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-[11px] font-bold text-white mb-3 flex items-center gap-2">
          <Microscope size={13} style={{ color: C.green }} />FORENSIC AI CLASSIFIER
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Forensic-specific classification fine-tuned to categorize autopsy findings, injury patterns,
          and case descriptions into investigation categories with SHAP-style feature attribution.
        </p>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-slate-500 font-mono uppercase">Forensic Text</label>
            <button onClick={() => setText(FORENSIC_SAMPLE)} className="text-[10px] text-slate-500 hover:text-slate-300">Sample</button>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
            placeholder="Paste autopsy report excerpt, injury description, or toxicology findings…"
            className="w-full text-xs resize-none rounded-xl px-4 py-3 text-slate-300 placeholder-slate-600 font-mono focus:outline-none leading-relaxed"
            style={{ background: 'rgba(4,8,18,0.9)', border: `1px solid ${C.border}` }} />
        </div>
        <RunBtn onClick={run} loading={loading} label="Run Forensic AI" color={C.green} disabled={!text.trim()} />
      </div>

      {error && <div className="p-3 rounded-xl text-xs text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>⚠️ {error}</div>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Category result */}
          <div className="p-5 rounded-xl flex items-center gap-5"
            style={{ background: `${catColor}0d`, border: `1px solid ${catColor}30` }}>
            <div className="flex-1">
              <div className="text-[10px] text-slate-500 font-mono uppercase mb-1">Forensic Category</div>
              <div className="text-xl font-black capitalize" style={{ color: catColor }}>
                {result.category || result.label || 'Unknown'}
              </div>
            </div>
            {result.confidence && (
              <div className="text-center">
                <div className="text-2xl font-black" style={{ color: catColor }}>
                  {((result.confidence || 0) * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-slate-500">confidence</div>
              </div>
            )}
          </div>

          {/* Features / key terms */}
          {result.features && (
            <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="text-[10px] text-slate-500 font-mono uppercase mb-3">Key Forensic Indicators</div>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(result.features) ? result.features : Object.keys(result.features)).map((f, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-1 rounded"
                    style={{ background: `${catColor}15`, border: `1px solid ${catColor}30`, color: catColor }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          {result.explanation && (
            <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="text-[10px] text-slate-500 font-mono uppercase mb-2">AI Explanation</div>
              <div className="text-xs text-slate-300 leading-relaxed">{result.explanation}</div>
            </div>
          )}

          {/* All scores */}
          {result.all_scores && Object.keys(result.all_scores).length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="text-[10px] text-slate-500 font-mono uppercase mb-3">All Category Scores</div>
              <div className="space-y-2">
                {Object.entries(result.all_scores).sort((a, b) => b[1] - a[1]).map(([label, score], i) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px] capitalize" style={{ color: i === 0 ? CATEGORY_COLORS[label] || catColor : '#64748b' }}>{label}</span>
                      <span className="text-[10px] font-mono text-slate-500">{((score || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(score || 0) * 100}%`, background: i === 0 ? CATEGORY_COLORS[label] || catColor : '#1e293b' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MLView() {
  const [tab, setTab] = useState('ner')

  return (
    <div className="flex h-full overflow-hidden" style={{ background: C.bg }}>
      <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-[15px] font-black text-white flex items-center gap-2 mb-1">
            <FlaskConical size={16} style={{ color: C.green }} />ML Pipeline
          </h1>
          <p className="text-[11px] text-slate-500 font-mono">HuggingFace inference — NER tagging, zero-shot classification, forensic AI</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all"
                style={{
                  background: tab === t.id ? `${t.color}18` : 'transparent',
                  border: `1px solid ${tab === t.id ? t.color + '40' : 'transparent'}`,
                  color: tab === t.id ? t.color : '#475569',
                }}>
                <Icon size={13} />{t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}>
            {tab === 'ner'      && <NERTab />}
            {tab === 'classify' && <ClassifyTab />}
            {tab === 'forensic' && <ForensicTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right panel */}
      <div className="w-52 flex-shrink-0 overflow-y-auto py-5 px-4 space-y-4"
        style={{ borderLeft: `1px solid ${C.border}` }}>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Tools</div>
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left mb-1"
                style={{
                  background: tab === t.id ? `${t.color}10` : 'transparent',
                  border: `1px solid ${tab === t.id ? t.color + '30' : 'transparent'}`,
                }}>
                <Icon size={13} style={{ color: t.color, flexShrink: 0 }} />
                <span className="text-[11px] font-bold" style={{ color: tab === t.id ? t.color : '#64748b' }}>{t.label}</span>
              </button>
            )
          })}
        </div>

        <div className="p-3 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">HF Models</div>
          {[
            ['NER', 'd4data/biomedical-ner-all'],
            ['Classify', 'facebook/bart-large-mnli'],
            ['Forensic', 'custom fine-tuned'],
          ].map(([t, m]) => (
            <div key={t} className="mb-2">
              <div className="text-[9px] text-slate-600 mb-0.5">{t}</div>
              <div className="text-[9px] font-mono text-slate-500 break-all leading-4">{m}</div>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div className="flex gap-1.5 items-start">
            <AlertTriangle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-400 leading-relaxed">
              Requires <code className="font-mono">HF_TOKEN</code> env variable for inference API access.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
