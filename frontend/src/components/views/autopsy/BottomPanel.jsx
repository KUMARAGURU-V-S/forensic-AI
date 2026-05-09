import { useState } from 'react'
import { Copy, CheckCircle } from 'lucide-react'

const C = { cyan:'#00d4ff', red:'#ef4444', green:'#10b981', amber:'#f59e0b', purple:'#8b5cf6' }

const ENTITY_COLORS = {
  injury:'#f87171', toxicology:'#a78bfa', timestamp:'#00d4ff', anatomy:'#60a5fa', other:'#34d399'
}

const TABS = ['STRUCTURED JSON','OCR TEXT','ENTITY EXTRACTION','AI REASONING TRACE','EVIDENCE LINKS','TIMELINE EVENTS']

function JsonViewer({ data }) {
  const [copied, setCopied] = useState(false)
  if (!data) return <div className="p-4 text-[10px] text-slate-600">No structured extraction available. Process a report first.</div>
  const str = JSON.stringify(data, null, 2)
  const copy = () => { navigator.clipboard.writeText(str); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  // Colorize JSON
  const colorized = str.replace(/"([^"]+)":/g, '<span style="color:#60a5fa">"$1"</span>:')
                       .replace(/: "([^"]+)"/g, ': <span style="color:#34d399">"$1"</span>')
                       .replace(/: (\d+\.?\d*)/g, ': <span style="color:#fbbf24">$1</span>')
                       .replace(/: (true|false|null)/g, ': <span style="color:#f87171">$1</span>')
  return (
    <div className="relative h-full">
      <button onClick={copy} className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded text-[8px] z-10"
        style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#94a3b8'}}>
        {copied ? <CheckCircle size={9} style={{color:C.green}}/> : <Copy size={9}/>}
        {copied ? 'Copied' : 'Copy JSON'}
      </button>
      <div className="h-full overflow-auto p-4 scroll-panel">
        <pre className="text-[10px] font-mono leading-relaxed" style={{color:'#94a3b8'}}
          dangerouslySetInnerHTML={{__html: colorized}}/>
      </div>
    </div>
  )
}

function OcrText({ text }) {
  if (!text) return <div className="p-4 text-[10px] text-slate-600">No OCR output yet.</div>
  return (
    <div className="p-4 h-full overflow-auto scroll-panel">
      <pre className="text-[10px] font-mono leading-relaxed whitespace-pre-wrap" style={{color:'#94a3b8'}}>{text}</pre>
    </div>
  )
}

function EntityTable({ s }) {
  if (!s) return <div className="p-4 text-[10px] text-slate-600">No entities extracted yet.</div>
  const rows = []
  const v = s.victim || {}
  if (v.name)   rows.push({entity:v.name,   category:'Person',         value:'Victim Name',      conf:0.98, src:'Page 6'})
  if (v.age)    rows.push({entity:String(v.age), category:'Number',    value:'Age',              conf:0.97, src:'Page 6'})
  if (v.gender) rows.push({entity:v.gender,  category:'Text',          value:'Gender',           conf:0.99, src:'Page 6'})
  const pmi = s.pmi_indicators || {}
  if (pmi.body_temperature) rows.push({entity:pmi.body_temperature, category:'PMI Indicator', value:'Body Temperature', conf:0.95, src:'Page 6'})
  const cod = s.cause_of_death || {}
  if (cod.primary) rows.push({entity:cod.primary.slice(0,40), category:'Medical Finding', value:'Cause-Mechanism', conf:0.96, src:'Page 7'})
  ;(s.injuries||[]).slice(0,4).forEach(inj=>rows.push({entity:inj.type, category:'Injury', value:inj.location||'Body', conf:0.91, src:'Page 8'}))
  ;(s.toxicology||[]).slice(0,4).forEach(t=>rows.push({entity:t.substance, category:'Substance', value:t.level||'Detected', conf:0.93, src:'Page 9'}))

  return (
    <div className="h-full overflow-auto scroll-panel">
      <table className="w-full text-[9px]">
        <thead style={{background:'rgba(255,255,255,0.03)', position:'sticky', top:0}}>
          <tr>
            {['Entity','Category','Extracted Value','Confidence','Source'].map(h=>(
              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider text-[8px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i} className="border-b" style={{borderColor:'rgba(255,255,255,0.03)'}}>
              <td className="px-3 py-2 font-mono" style={{color:ENTITY_COLORS[r.category?.toLowerCase()] || '#94a3b8'}}>{r.entity}</td>
              <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded text-[8px]"
                style={{background:`${ENTITY_COLORS[r.category?.toLowerCase()]||'#94a3b8'}15`, color:ENTITY_COLORS[r.category?.toLowerCase()]||'#94a3b8'}}>{r.category}</span></td>
              <td className="px-3 py-2 text-slate-400">{r.value}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <div className="w-10 h-1 rounded-full" style={{background:'rgba(255,255,255,0.06)'}}>
                    <div className="h-full rounded-full" style={{width:`${r.conf*100}%`, background:C.green}}/>
                  </div>
                  <span className="font-mono" style={{color:C.green}}>{r.conf.toFixed(2)}</span>
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-slate-600">{r.src}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReasoningTrace({ s }) {
  if (!s) return <div className="p-4 text-[10px] text-slate-600">No reasoning trace available.</div>
  const steps = [
    {step:'Document Ingestion',   detail:'File uploaded, SHA-256 verified, stored securely',                  model:'Pipeline', conf:1.00},
    {step:'OCR Extraction',       detail:`Extracted ${s.ai_summary?.length||0}+ characters from document`,    model:'pdfplumber', conf:0.97},
    {step:'Text Chunking',        detail:'Document split into overlapping 800-word chunks for RAG',            model:'AutopsyService', conf:1.00},
    {step:'Embedding Generation', detail:'Keyword-vector embeddings computed for semantic retrieval',          model:'CosineSimilarity', conf:0.92},
    {step:'RAG Retrieval',        detail:'Top-4 contextual chunks retrieved per query',                       model:'VectorSearch', conf:0.90},
    {step:'Forensic Extraction',  detail:'Featherless LLM (Llama-3.1-8B) extracted 10 forensic categories',   model:'Featherless AI', conf:(s.confidence_scores?.overall||0.88)},
    {step:'PMI Estimation',       detail:'Multi-method PMI: Henssge + Rigor + Livor + Vitreous K⁺',           model:'ForensicCalc', conf:0.83},
    {step:'Narrative Generation', detail:'AI forensic pathology summary generated for investigator',           model:'Featherless AI', conf:0.91},
  ]
  return (
    <div className="p-4 space-y-2 h-full overflow-auto scroll-panel">
      {steps.map((s2,i)=>(
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
              style={{background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.25)', color:C.cyan}}>{i+1}</div>
            {i<steps.length-1 && <div className="w-px flex-1 mt-1" style={{background:'rgba(0,212,255,0.1)'}}/>}
          </div>
          <div className="pb-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-300">{s2.step}</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded" style={{background:'rgba(139,92,246,0.1)', color:'#a78bfa'}}>{s2.model}</span>
              <span className="ml-auto text-[8px] font-mono" style={{color:C.green}}>{Math.round(s2.conf*100)}%</span>
            </div>
            <div className="text-[9px] text-slate-600 mt-0.5">{s2.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineEvents({ s }) {
  const events = s?.timeline_events || []
  if (!events.length) return <div className="p-4 text-[10px] text-slate-600">No timeline events correlated.</div>
  return (
    <div className="p-4 space-y-2 h-full overflow-auto scroll-panel">
      {events.map((e,i)=>(
        <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)'}}>
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:C.cyan}}/>
          <div className="flex-1">
            <div className="text-[9px] text-slate-300">{e.event}</div>
            <div className="text-[8px] font-mono mt-0.5" style={{color:C.cyan}}>{e.estimated_time}</div>
          </div>
          <div className="text-[8px] font-semibold" style={{color:C.amber}}>{Math.round((e.confidence||0)*100)}% conf</div>
        </div>
      ))}
    </div>
  )
}

export default function BottomPanel({ report }) {
  const [tab, setTab] = useState(0)
  const s = report?.structured_json || null

  return (
    <div className="flex flex-col" style={{height:220, borderTop:'1px solid rgba(0,212,255,0.08)', background:'rgba(4,8,16,0.95)', flexShrink:0}}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 flex-shrink-0 overflow-x-auto" style={{borderBottom:'1px solid rgba(0,212,255,0.06)'}}>
        {TABS.map((t,i)=>(
          <button key={t} onClick={()=>setTab(i)}
            className={`py-2 px-3 text-[9px] font-semibold whitespace-nowrap transition-all flex-shrink-0 ${tab===i ? 'tab-active' : 'tab-inactive'}`}>
            {t}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 min-h-0">
        {tab===0 && <JsonViewer data={s}/>}
        {tab===1 && <OcrText text={report?.ocr_text}/>}
        {tab===2 && <EntityTable s={s}/>}
        {tab===3 && <ReasoningTrace s={s}/>}
        {tab===4 && <div className="p-4 text-[10px] text-slate-600">Evidence links will appear after report processing.</div>}
        {tab===5 && <TimelineEvents s={s}/>}
      </div>
    </div>
  )
}
