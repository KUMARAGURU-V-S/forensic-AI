import { useState } from 'react'
import { Brain, Database, GitBranch, ChevronRight, AlertTriangle, CheckCircle, Send, Loader } from 'lucide-react'

const C = { cyan:'#00d4ff', red:'#ef4444', green:'#10b981', amber:'#f59e0b', purple:'#8b5cf6', border:'rgba(0,212,255,0.08)' }

const MANNER_COLOR = { Homicide:C.red, Suicide:'#f97316', Accidental:C.amber, Natural:C.green, Undetermined:'#475569' }

function ScoreMeter({ label, value, color }) {
  const pct = Math.round((value||0)*100)
  const r = 22, circ = 2*Math.PI*r
  const dash = circ * (1 - pct/100)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg width="56" height="56" className="rotate-[-90deg]">
          <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
          <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
            style={{transition:'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)'}}/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black" style={{color}}>{pct}%</span>
        </div>
      </div>
      <div className="text-[8px] text-slate-500 text-center leading-tight">{label}</div>
    </div>
  )
}

function FindingRow({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="flex items-center gap-2 py-1.5" style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
      <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{background:`${color}15`}}>
        <Icon size={9} style={{color}}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-slate-400">{label}</div>
        {sub && <div className="text-[8px] text-slate-600">{sub}</div>}
      </div>
      <div className="text-[9px] font-semibold text-right" style={{color, maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{value}</div>
    </div>
  )
}

function AIAnalysisTab({ s }) {
  if (!s) return (
    <div className="flex items-center justify-center h-32 text-[10px] text-slate-600">
      Upload and process a report to view AI analysis
    </div>
  )
  const cod  = s.cause_of_death  || {}
  const mod  = s.manner_of_death || {}
  const pmi  = s.pmi_indicators  || {}
  const cs   = s.confidence_scores || {}
  const tox  = s.toxicology || []
  const inj  = s.injuries   || []
  const mannerColor = MANNER_COLOR[mod.classification] || C.amber

  return (
    <div className="space-y-4 px-3 py-3">
      {/* Summary */}
      <div className="p-3 rounded-xl" style={{background:'rgba(0,212,255,0.04)', border:`1px solid ${C.border}`}}>
        <div className="flex items-center gap-1.5 mb-2">
          <Brain size={10} style={{color:C.cyan}}/>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{color:C.cyan}}>AI Summary</span>
          <span className="ml-auto text-[7px] px-1.5 py-0.5 rounded" style={{background:'rgba(0,212,255,0.1)', color:C.cyan}}>Featherless AI · RAG</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">{s.ai_summary || 'Analysis pending…'}</p>
      </div>

      {/* Confidence meters */}
      <div className="flex items-center justify-around py-2 px-1 rounded-xl" style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)'}}>
        <ScoreMeter label="Confidence Score" value={cs.overall}       color={C.green}/>
        <ScoreMeter label="AI Certainty"     value={cs.ai_certainty}  color={C.amber}/>
        <ScoreMeter label="Extraction Quality" value={cs.extraction_quality} color={C.cyan}/>
      </div>

      {/* Key Findings */}
      <div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Key Findings</div>
        <div className="space-y-0.5">
          <FindingRow icon={AlertTriangle} label="Cause of Death"   value={cod.primary||'Unknown'}   color={C.red}    sub={cod.secondary}/>
          <FindingRow icon={ChevronRight}  label="Manner of Death"  value={mod.classification||'Undetermined'} color={mannerColor}/>
          <FindingRow icon={Brain}         label="Time Since Death" value={pmi.estimated_pmi_hours ? `${pmi.estimated_pmi_hours}` : 'Unknown'} color={C.cyan}/>
          <FindingRow icon={Database}      label="Major Injuries"   value={`${inj.length} documented`} color='#f97316'/>
          <FindingRow icon={CheckCircle}   label="Blood Loss"       value={(inj.find(i=>i.type?.toLowerCase().includes('hemorrhage'))?.severity)||'Assessed'} color={C.red}/>
          <FindingRow icon={GitBranch}     label="Evidence Consistency" value={cs.overall>0.8?'High':'Moderate'} color={cs.overall>0.8?C.green:C.amber}/>
        </div>
      </div>

      {/* Manner badge */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:`${mannerColor}10`, border:`1px solid ${mannerColor}30`}}>
        <div className="text-[9px] text-slate-500">Manner of Death</div>
        <div className="ml-auto px-3 py-1 rounded-full text-[10px] font-bold" style={{background:`${mannerColor}20`, color:mannerColor}}>
          {mod.classification || 'Undetermined'}
        </div>
      </div>

      {/* PMI Indicators */}
      <div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">PMI Indicators</div>
        <div className="space-y-1.5">
          {[
            ['Body Temperature', pmi.body_temperature, '6-8 hrs'],
            ['Rigor Mortis',     pmi.rigor_mortis,     '5-9 hrs'],
            ['Liver Mortis',     pmi.livor_mortis,     '7-10 hrs'],
            ['Stomach Contents', pmi.stomach_contents, '4-6 hrs'],
            ['Decomposition',    pmi.decomposition,    '6-12 hrs'],
          ].filter(([,v])=>v).map(([k,v,range])=>(
            <div key={k} className="flex items-center justify-between p-2 rounded-lg" style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)'}}>
              <span className="text-[8px] text-slate-500">{k}</span>
              <div className="text-right">
                <div className="text-[9px] text-slate-300 font-mono">{typeof v==='string' ? v : JSON.stringify(v)}</div>
                <div className="text-[7px]" style={{color:C.cyan}}>{range}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toxicology */}
      {tox.length > 0 && (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Toxicology Summary</div>
          <div className="space-y-1.5">
            {tox.slice(0,5).map((t,i)=>(
              <div key={i} className="flex items-center justify-between p-2 rounded-lg" style={{background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)'}}>
                <div>
                  <div className="text-[9px] text-slate-300">{t.substance}</div>
                  <div className="text-[8px] text-slate-600 font-mono">{t.level}</div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[8px] font-semibold ${t.detected ? '' : 'opacity-50'}`}
                  style={{background: t.detected ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)',
                          color: t.detected ? C.red : C.green}}>
                  {t.detected ? 'Detected' : 'Not Detected'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ExtractedDataTab({ s }) {
  if (!s) return <div className="p-3 text-[10px] text-slate-600">No data extracted yet.</div>
  const v = s.victim || {}
  const inj = s.injuries || []
  const anat = s.anatomical_findings || []
  const susp = s.suspicious_indicators || []
  return (
    <div className="px-3 py-3 space-y-4">
      {/* Victim */}
      <div className="p-3 rounded-xl" style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)'}}>
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Victim Information</div>
        {[['Name',v.name||'Unknown'],['Age',v.age||'?'],['Gender',v.gender||'?'],['Identifiers',v.identifiers||'—']].map(([k,val])=>(
          <div key={k} className="flex justify-between py-1" style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
            <span className="text-[8px] text-slate-600">{k}</span>
            <span className="text-[9px] text-slate-300">{val}</span>
          </div>
        ))}
      </div>
      {/* Injuries */}
      {inj.length > 0 && (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Injury Analysis ({inj.length})</div>
          {inj.map((inj2,i)=>(
            <div key={i} className="p-2 rounded-lg mb-1.5" style={{background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.1)'}}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-slate-300">{inj2.type}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded" style={{background:'rgba(239,68,68,0.15)', color:C.red}}>{inj2.severity}</span>
              </div>
              <div className="text-[8px] text-slate-600 mt-0.5">{inj2.location}</div>
            </div>
          ))}
        </div>
      )}
      {/* Anatomical */}
      {anat.length > 0 && (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Anatomical Findings ({anat.length})</div>
          {anat.map((a,i)=>(
            <div key={i} className="flex justify-between py-1.5" style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
              <span className="text-[9px] text-slate-400">{a.organ}</span>
              <span className="text-[9px] text-slate-500">{a.finding}{a.weight_grams ? ` (${a.weight_grams}g)` : ''}</span>
            </div>
          ))}
        </div>
      )}
      {/* Suspicious */}
      {susp.length > 0 && (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{color:C.red}}>⚠ Suspicious Indicators</div>
          {susp.map((s2,i)=>(
            <div key={i} className="p-2 rounded-lg mb-1.5" style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)'}}>
              <div className="text-[9px] text-red-300">{s2.indicator}</div>
              <div className="text-[8px] text-slate-500 mt-0.5">{s2.significance}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CorrelationsTab({ s }) {
  const events = s?.timeline_events || []
  return (
    <div className="px-3 py-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Timeline Correlation</div>
      {events.length === 0 && <div className="text-[9px] text-slate-600">No timeline events linked yet.</div>}
      {events.map((e,i)=>(
        <div key={i} className="flex items-start gap-2 py-2" style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{background:C.cyan}}/>
          <div className="flex-1">
            <div className="text-[9px] text-slate-300">{e.event}</div>
            <div className="text-[8px] font-mono mt-0.5" style={{color:C.cyan}}>{e.estimated_time}</div>
          </div>
          <div className="text-[8px]" style={{color:C.amber}}>{Math.round((e.confidence||0)*100)}%</div>
        </div>
      ))}
    </div>
  )
}

const TABS = [
  {id:'ai',   label:'AI Analysis', Icon:Brain},
  {id:'data', label:'Extracted Data', Icon:Database},
  {id:'corr', label:'Correlations', Icon:GitBranch},
]

export default function RightPanel({ report, onQuery }) {
  const [tab, setTab]   = useState('ai')
  const [q, setQ]       = useState('')
  const [ans, setAns]   = useState(null)
  const [loading, setL] = useState(false)

  const s = report?.structured_json || null

  const submitQuery = async () => {
    if (!q.trim() || !report || !onQuery) return
    setL(true)
    try {
      const r = await onQuery(q)
      setAns(r)
    } catch { setAns({answer:'Query failed. Please try again.'}) }
    finally { setL(false) }
  }

  return (
    <div className="flex flex-col h-full" style={{width:280, flexShrink:0, borderLeft:`1px solid ${C.border}`, background:'rgba(4,8,15,0.92)'}}>
      {/* Tabs */}
      <div className="flex items-center px-3 pt-2 flex-shrink-0" style={{borderBottom:`1px solid ${C.border}`}}>
        {TABS.map(({id,label,Icon})=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`flex items-center gap-1 px-2 py-2 text-[9px] font-semibold transition-all ${tab===id ? 'tab-active' : 'tab-inactive'}`}>
            <Icon size={9}/>{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto scroll-panel">
        {tab==='ai'   && <AIAnalysisTab s={s}/>}
        {tab==='data' && <ExtractedDataTab s={s}/>}
        {tab==='corr' && <CorrelationsTab s={s}/>}
      </div>

      {/* RAG Query bar */}
      {report?.status==='complete' && (
        <div className="p-3 flex-shrink-0" style={{borderTop:`1px solid ${C.border}`}}>
          <div className="text-[8px] font-bold uppercase tracking-widest mb-1.5" style={{color:C.purple}}>
            ◈ Featherless RAG Query
          </div>
          {ans && (
            <div className="mb-2 p-2 rounded-lg text-[9px] leading-relaxed" style={{background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.15)', color:'#c4b5fd', maxHeight:80, overflowY:'auto'}}>
              {ans.answer}
            </div>
          )}
          <div className="flex gap-1">
            <input value={q} onChange={e=>setQ(e.target.value)}
              onKeyDown={e=>e.key==='Enter' && submitQuery()}
              placeholder="Ask the AI about this report…"
              className="flex-1 h-7 px-2 rounded-lg text-[9px] outline-none"
              style={{background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)', color:'#c4b5fd', fontFamily:'JetBrains Mono, monospace'}}/>
            <button onClick={submitQuery} disabled={loading||!q.trim()}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={{background:'rgba(139,92,246,0.2)', border:'1px solid rgba(139,92,246,0.35)'}}>
              {loading ? <Loader size={10} style={{color:C.purple}} className="animate-spin"/> : <Send size={10} style={{color:C.purple}}/>}
            </button>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {['Cause of death?','Toxicology findings','PMI estimate','Homicide indicators'].map(sq=>(
              <button key={sq} onClick={()=>setQ(sq)}
                className="px-1.5 py-0.5 rounded text-[7px] transition-all"
                style={{background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)', color:'#7c3aed'}}>
                {sq}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
