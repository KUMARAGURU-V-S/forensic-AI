import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'

const ENTITY_COLORS = {
  injury:    { bg:'rgba(239,68,68,0.25)',   border:'rgba(239,68,68,0.6)',   text:'#f87171', label:'Injury' },
  toxicology:{ bg:'rgba(139,92,246,0.25)',  border:'rgba(139,92,246,0.6)',  text:'#a78bfa', label:'Toxicology' },
  timestamp: { bg:'rgba(0,212,255,0.2)',    border:'rgba(0,212,255,0.6)',   text:'#00d4ff', label:'Timestamp' },
  anatomy:   { bg:'rgba(59,130,246,0.25)',  border:'rgba(59,130,246,0.6)', text:'#60a5fa', label:'Anatomy' },
  other:     { bg:'rgba(16,185,129,0.2)',   border:'rgba(16,185,129,0.5)',  text:'#34d399', label:'Other' },
}

const SECTIONS = ['External Examination','Internal Examination','Cause of Death','Toxicology','PMI Indicators','Conclusions']

function classifySpan(text) {
  const t = text.toLowerCase()
  if (/laceration|fracture|hemorrhage|contusion|wound|trauma|burn|abrasion|bruising|injury/.test(t)) return 'injury'
  if (/ethanol|cocaine|diazepam|fentanyl|morphine|toxicology|substance|drug|poison|alcohol/.test(t)) return 'toxicology'
  if (/\d{2}:\d{2}|\d{4}-\d{2}-\d{2}|hours?|time of death|pmi/.test(t)) return 'timestamp'
  if (/liver|lung|heart|brain|stomach|kidney|spleen|cranial|thoracic|abdominal|organ|tissue/.test(t)) return 'anatomy'
  return null
}

function highlightText(text, showHighlights, onClickSpan) {
  if (!text || !showHighlights) return <span style={{color:'#94a3b8', lineHeight:1.8, fontSize:11}}>{text}</span>

  const PATTERN = /(laceration[\s\w,]{0,40}|fracture[\s\w,]{0,40}|hemorrhage[\s\w,]{0,40}|contusion[\s\w,]{0,40}|subdural[\s\w,]{0,30}|rib fractures[\s\w,]{0,30}|ethanol[^,\n]{0,30}|diazepam[^,\n]{0,30}|cocaine[^,\n]{0,30}|\d{1,3}\.?\d*\s*°C[^,\n]{0,20}|rigor mortis[^,\n]{0,30}|livor mortis[^,\n]{0,30}|\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}|\b\d+-\d+ hours?\b|liver[^,\n]{0,20}|lung[s]?[^,\n]{0,20}|heart[^,\n]{0,20}|brain[^,\n]{0,20}|kidney[s]?[^,\n]{0,20})/gi

  const parts = []
  let last = 0, m
  while ((m = PATTERN.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index), h: false })
    const kind = classifySpan(m[0])
    if (kind) parts.push({ t: m[0], h: true, kind })
    else parts.push({ t: m[0], h: false })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ t: text.slice(last), h: false })

  return (
    <span style={{lineHeight:1.9, fontSize:11}}>
      {parts.map((p, i) => {
        if (!p.h) return <span key={i} style={{color:'#94a3b8'}}>{p.t}</span>
        const ec = ENTITY_COLORS[p.kind]
        return (
          <span key={i} onClick={()=>onClickSpan && onClickSpan(p.t, p.kind)}
            style={{background:ec.bg, border:`1px solid ${ec.border}`, color:ec.text,
                    borderRadius:3, padding:'1px 4px', cursor:'pointer', margin:'0 1px',
                    transition:'all 0.15s'}}
            title={`${ec.label}: click for AI explanation`}>
            {p.t}
          </span>
        )
      })}
    </span>
  )
}

export default function CenterPanel({ report, onEntityClick, onRetry }) {
  const [search, setSearch]       = useState('')
  const [showHL, setShowHL]       = useState(true)
  const [activeSection, setSection] = useState(null)
  const [tooltip, setTooltip]     = useState(null)

  const text = report?.ocr_text || ''
  const pages = useMemo(() => {
    if (!text) return []
    const lines = text.split('\n')
    const chunks = []; let cur = []
    lines.forEach(l => {
      cur.push(l)
      if (cur.length >= 40) { chunks.push(cur.join('\n')); cur = [] }
    })
    if (cur.length) chunks.push(cur.join('\n'))
    return chunks.length ? chunks : [text.slice(0, 2000)]
  }, [text])

  const [page, setPage] = useState(0)
  const totalPages = pages.length || 1
  const pageText = pages[page] || ''

  const handleSpanClick = (spanText, kind) => {
    const ec = ENTITY_COLORS[kind]
    setTooltip({ text: spanText, kind, color: ec.text, label: ec.label })
    if (onEntityClick) onEntityClick(spanText, kind)
    setTimeout(() => setTooltip(null), 4000)
  }

  const noReport = !report
  const processing = report && report.status !== 'complete'

  return (
    <div className="flex flex-col h-full" style={{background:'rgba(5,10,22,0.95)'}}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{borderBottom:'1px solid rgba(0,212,255,0.08)', background:'rgba(4,8,16,0.9)'}}>
        <div className="text-[10px] font-mono text-slate-500 flex-shrink-0">
          {report ? report.filename : 'No report selected'}
        </div>
        {report && <div className="text-[9px] text-slate-600 flex-shrink-0">· {page+1}/{totalPages} pages</div>}
        <div className="flex-1"/>
        {/* Search */}
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2" style={{color:'#475569'}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search in report…"
            className="h-6 pl-6 pr-3 text-[9px] rounded-lg outline-none w-40 font-mono"
            style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#94a3b8'}}/>
        </div>
        {/* Highlight toggle */}
        <button onClick={()=>setShowHL(!showHL)} className="flex items-center gap-1 px-2 h-6 rounded-lg text-[9px] transition-all"
          style={{background: showHL ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)',
                  border:`1px solid ${showHL ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  color: showHL ? '#00d4ff' : '#475569'}}>
          {showHL ? <Eye size={9}/> : <EyeOff size={9}/>}
          <span>Highlights</span>
        </button>
        {/* Legend */}
        {showHL && <div className="flex items-center gap-2">
          {Object.entries(ENTITY_COLORS).slice(0,4).map(([k,v])=>(
            <div key={k} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{background:v.bg, border:`1px solid ${v.border}`}}/>
              <span className="text-[8px]" style={{color:v.text}}>{v.label}</span>
            </div>
          ))}
        </div>}
      </div>

      {/* Section nav */}
      {report && (
        <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto flex-shrink-0" style={{borderBottom:'1px solid rgba(0,212,255,0.05)'}}>
          {SECTIONS.map(s => (
            <button key={s} onClick={()=>setSection(activeSection===s?null:s)}
              className="px-2 py-0.5 rounded text-[8px] whitespace-nowrap transition-all flex-shrink-0"
              style={{background: activeSection===s ? 'rgba(0,212,255,0.1)' : 'transparent',
                      color: activeSection===s ? '#00d4ff' : '#475569',
                      border:`1px solid ${activeSection===s ? 'rgba(0,212,255,0.25)' : 'transparent'}`}}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Document body */}
      <div className="flex-1 overflow-y-auto relative scroll-panel">
        {noReport && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)'}}>
              <Search size={28} style={{color:'rgba(239,68,68,0.4)'}}/>
            </div>
            <div className="text-center">
              <div className="text-[13px] font-semibold text-slate-400">No Report Selected</div>
              <div className="text-[10px] text-slate-600 mt-1">Upload or select an autopsy report to begin analysis</div>
            </div>
          </div>
        )}
        {processing && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-12 h-12 rounded-full border-2 animate-spin" style={{borderColor:'#00d4ff', borderTopColor:'transparent'}}/>
            <div className="text-[11px] text-slate-400">AI pipeline running: <span style={{color:'#00d4ff'}}>{report.status}…</span></div>
            <div className="text-[9px] text-slate-600">Featherless AI processing document</div>
          </div>
        )}
        {report?.status === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)'}}>
              <span style={{fontSize:24}}>⚠</span>
            </div>
            <div className="text-center">
              <div className="text-[13px] font-semibold" style={{color:'#ef4444'}}>Pipeline Error</div>
              <div className="text-[10px] text-slate-500 mt-1">{report.filename}</div>
              <div className="text-[9px] text-slate-600 mt-2 max-w-xs">The AI analysis pipeline encountered an error. This may be due to OCR failure or model unavailability.</div>
            </div>
            {onRetry && (
              <button onClick={()=>onRetry(report.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold transition-all"
                style={{background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.35)', color:'#ef4444'}}>
                <RefreshCw size={12}/> Retry Analysis
              </button>
            )}
          </div>
        )}
        {report && report.status==='complete' && (
          <div className="p-6">
            {/* Page content */}
            <div className="max-w-2xl mx-auto">
              <div className="p-5 rounded-xl mb-4" style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)'}}>
                <div className="text-[9px] font-mono text-slate-600 mb-3 flex items-center justify-between">
                  <span>PAGE {page+1} OF {totalPages}</span>
                  {report.sha256 && <span style={{color:'#10b981'}}>● VERIFIED</span>}
                </div>
                <div className="font-mono whitespace-pre-wrap leading-relaxed">
                  {highlightText(
                    search ? pageText.split(new RegExp(`(${search})`, 'gi')).map((p,i) =>
                      i%2===1 ? <mark key={i} style={{background:'rgba(245,158,11,0.3)', color:'#fbbf24', borderRadius:2}}>{p}</mark> : p
                    ) : pageText,
                    showHL && !search,
                    handleSpanClick
                  )}
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-3">
                <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
                          opacity: page===0 ? 0.3 : 1}}>
                  <ChevronLeft size={12} style={{color:'#94a3b8'}}/>
                </button>
                <div className="flex gap-1">
                  {Array.from({length: Math.min(totalPages, 8)}).map((_,i) => (
                    <button key={i} onClick={()=>setPage(i)}
                      className="w-5 h-5 rounded text-[8px] font-mono transition-all"
                      style={{background: page===i ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                              color: page===i ? '#00d4ff' : '#475569',
                              border:`1px solid ${page===i ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.05)'}`}}>
                      {i+1}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
                          opacity: page>=totalPages-1 ? 0.3 : 1}}>
                  <ChevronRight size={12} style={{color:'#94a3b8'}}/>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Entity tooltip */}
        {tooltip && (
          <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 fade-up"
            style={{background:'rgba(7,13,26,0.97)', border:`1px solid ${tooltip.color}40`,
                    borderRadius:10, padding:'10px 14px', maxWidth:320, boxShadow:`0 0 20px ${tooltip.color}20`}}>
            <div className="text-[9px] font-bold mb-1" style={{color:tooltip.color}}>{tooltip.label} — AI Explanation</div>
            <div className="text-[10px] text-slate-300">"{tooltip.text}"</div>
            <div className="text-[9px] text-slate-500 mt-1">Featherless AI identified this as a forensic {tooltip.label.toLowerCase()} entity. Click any finding in the right panel for full context.</div>
          </div>
        )}
      </div>
    </div>
  )
}
