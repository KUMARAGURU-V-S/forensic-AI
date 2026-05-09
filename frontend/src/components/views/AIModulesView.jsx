/**
 * AIModulesView — Screen 4: AI Modules Control Center
 * 8 module cards + execution queue + model performance radar.
 */
import { useState, useEffect } from 'react'
import {
  FileText, Video, FlaskConical, MessageSquare, MapPin,
  AlertTriangle, TrendingUp, FileCheck, Play, Eye,
  Cpu, Zap, Activity, CheckCircle,
} from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, RadialBarChart, RadialBar } from 'recharts'
import { useForensicStore } from '../../lib/store'
import { api } from '../../lib/api'

const C = {
  cyan:'#00d4ff', red:'#ef4444', green:'#10b981', amberL:'#f59e0b',
  purple:'#8b5cf6', orange:'#f97316', teal:'#14b8a6', pink:'#ec4899',
  border:'rgba(0,212,255,0.08)', card:'rgba(7,14,32,0.85)',
}

const MODULES = [
  {
    id:'autopsy', label:'Autopsy Analysis', color:C.red, bg:'rgba(239,68,68,0.06)', border:'rgba(239,68,68,0.18)',
    icon:FileText, desc:'Analyze injuries, cause of death, toxicology and other findings from autopsy reports.',
    accuracy:96, processed:24, confidence:89, lastRun:'2h ago', queue:2, status:'active',
  },
  {
    id:'cctv', label:'CCTV Analysis', color:C.cyan, bg:'rgba(0,212,255,0.06)', border:'rgba(0,212,255,0.18)',
    icon:Video, desc:'Detect persons, weapons, vehicles and suspicious activities in CCTV footage.',
    accuracy:93, processed:58, confidence:87, lastRun:'1h ago', queue:5, status:'active',
  },
  {
    id:'toxicology', label:'Toxicology Analysis', color:C.green, bg:'rgba(16,185,129,0.06)', border:'rgba(16,185,129,0.18)',
    icon:FlaskConical, desc:'Analyze toxicology reports and detect harmful substances and concentrations.',
    accuracy:98, processed:12, confidence:95, lastRun:'4h ago', queue:1, status:'active',
  },
  {
    id:'comms', label:'Communication Analysis', color:C.amberL, bg:'rgba(245,158,11,0.06)', border:'rgba(245,158,11,0.18)',
    icon:MessageSquare, desc:'Analyze call logs, messages and communication patterns for anomalies.',
    accuracy:91, processed:134, confidence:88, lastRun:'30m ago', queue:8, status:'active',
  },
  {
    id:'location', label:'Location Intelligence', color:C.purple, bg:'rgba(139,92,246,0.06)', border:'rgba(139,92,246,0.18)',
    icon:MapPin, desc:'Analyze GPS tracks, geofences and movement patterns across all data.',
    accuracy:92, processed:87, confidence:90, lastRun:'45m ago', queue:3, status:'active',
  },
  {
    id:'anomaly', label:'Anomaly Detection', color:C.orange, bg:'rgba(249,115,22,0.06)', border:'rgba(249,115,22,0.18)',
    icon:AlertTriangle, desc:'Detect statistical outliers and prioritize cases based on behavioral patterns.',
    accuracy:94, processed:23, confidence:91, lastRun:'15m ago', queue:4, status:'active',
  },
  {
    id:'risk', label:'Risk Assessment', color:C.red, bg:'rgba(239,68,68,0.06)', border:'rgba(239,68,68,0.18)',
    icon:TrendingUp, desc:'Compute evidence-weighted risk scores using SHAP+LIME explainability.',
    accuracy:95, processed:12, confidence:93, lastRun:'1h ago', queue:2, status:'active',
  },
  {
    id:'report', label:'Report Generation', color:C.teal, bg:'rgba(20,184,166,0.06)', border:'rgba(20,184,166,0.18)',
    icon:FileCheck, desc:'Generate comprehensive investigation reports with AI narrative summaries.',
    accuracy:99, processed:5, confidence:97, lastRun:'2h ago', queue:1, status:'active',
  },
]

const QUEUE = [
  { label:'Autopsy Analysis',     caseId:'FTI-2024-0847', progress:86, color:C.cyan   },
  { label:'CCTV Analysis',        caseId:'FTI-2024-0848', progress:60, color:C.green  },
  { label:'Toxicology Analysis',  caseId:'FTI-2024-0847', progress:40, color:C.amberL },
  { label:'Anomaly Detection',    caseId:'FTI-2024-0849', progress:25, color:C.purple  },
  { label:'Risk Assessment',      caseId:'FTI-2024-0848', progress:15, color:C.orange  },
]

const RADAR_DATA = [
  { metric:'NLP',      value:93, fullMark:100 },
  { metric:'Vision',   value:91, fullMark:100 },
  { metric:'Graph',    value:87, fullMark:100 },
  { metric:'Anomaly',  value:95, fullMark:100 },
  { metric:'Risk',     value:93, fullMark:100 },
]

function ModuleCard({ mod, onRun, onView, running }) {
  const Icon = mod.icon
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 transition-all"
      style={{ background:mod.bg, border:`1px solid ${mod.border}`, boxShadow:`0 0 20px ${mod.color}08` }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background:`${mod.color}15`, border:`1px solid ${mod.color}30` }}>
            <Icon size={15} style={{ color:mod.color }} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-100">{mod.label}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background:C.green }} />
              <span className="text-[9px]" style={{ color:C.green }}>Active</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-mono font-bold" style={{ color:mod.color }}>{mod.accuracy}%</div>
          <div className="text-[8px] text-slate-600">Accuracy</div>
        </div>
      </div>

      {/* Desc */}
      <p className="text-[9px] text-slate-500 leading-relaxed">{mod.desc}</p>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[9px]">
        <div className="text-center">
          <div className="font-bold text-slate-300">{mod.processed}</div>
          <div className="text-slate-600">Processed</div>
        </div>
        <div className="text-center">
          <div className="font-bold" style={{ color:mod.color }}>{mod.confidence}%</div>
          <div className="text-slate-600">Confidence</div>
        </div>
        <div className="flex-1 text-right">
          <div className="text-slate-500">{mod.lastRun}</div>
        </div>
      </div>

      {/* Accuracy bar */}
      <div>
        <div className="h-1 rounded-full" style={{ background:'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all" style={{ width:`${mod.accuracy}%`, background:mod.color, boxShadow:`0 0 6px ${mod.color}60` }} />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button onClick={()=>onRun(mod.id)} disabled={running===mod.id}
          className="flex-1 h-7 rounded-lg text-[9px] font-semibold flex items-center justify-center gap-1 transition-all"
          style={{ background:`${mod.color}18`, border:`1px solid ${mod.color}35`, color:mod.color }}>
          <Play size={9} className={running===mod.id?'animate-spin':''} />
          {running===mod.id?'Running…':'Run Module'}
        </button>
        <button onClick={()=>onView(mod.id)}
          className="flex-1 h-7 rounded-lg text-[9px] font-medium flex items-center justify-center gap-1 transition-all"
          style={{ background:'rgba(255,255,255,0.03)', border:`1px solid rgba(255,255,255,0.07)`, color:'#64748b' }}>
          <Eye size={9} /> View Results
        </button>
      </div>
    </div>
  )
}

export default function AIModulesView() {
  const { caseId, rerunAI, setActiveNavId } = useForensicStore()
  const [running, setRunning]   = useState(null)
  const [agentStatus, setStatus]= useState(null)

  useEffect(() => {
    api.getAgentsStatus().then(setStatus).catch(()=>{})
  }, [])

  const handleRun = async (id) => {
    setRunning(id)
    try { await api.runAgentAnalysis(caseId) } catch {}
    setTimeout(()=>setRunning(null), 2500)
  }
  const handleView = (id) => {
    if (id === 'autopsy') setActiveNavId('autopsy')
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background:'rgba(4,8,18,0.97)' }}>

      {/* ── Main grid ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-black text-slate-100">AI Modules</h1>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Manage and monitor all AI analysis modules</p>
          </div>
          <button onClick={rerunAI}
            className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-[10px] font-semibold transition-all"
            style={{ background:'rgba(0,212,255,0.1)', border:`1px solid rgba(0,212,255,0.25)`, color:C.cyan }}>
            <Zap size={11} /> Run All Modules
          </button>
        </div>

        {/* 4x2 module grid */}
        <div className="grid grid-cols-4 gap-3">
          {MODULES.map(mod => (
            <ModuleCard key={mod.id} mod={mod} onRun={handleRun} onView={handleView} running={running} />
          ))}
        </div>
      </div>

      {/* ── Right panel: queue + radar ────────────────── */}
      <div className="w-64 flex-shrink-0 overflow-y-auto py-4 px-4 space-y-4" style={{ borderLeft:`1px solid ${C.border}` }}>

        {/* Execution queue */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
            <div className="w-1 h-3 rounded-full" style={{ background:C.cyan }} />
            Module Execution Queue
          </div>
          <div className="space-y-3">
            {QUEUE.map((q,i)=>(
              <div key={i} className="p-2.5 rounded-xl" style={{ background:'rgba(255,255,255,0.02)', border:`1px solid rgba(255,255,255,0.05)` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-semibold text-slate-300">{q.label}</span>
                  <span className="text-[8px] font-mono" style={{ color:q.color }}>{q.progress}%</span>
                </div>
                <div className="h-1 rounded-full mb-1.5" style={{ background:'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width:`${q.progress}%`, background:q.color, boxShadow:`0 0 4px ${q.color}60` }} />
                </div>
                <div className="text-[8px] font-mono text-slate-600">{q.caseId}</div>
              </div>
            ))}
          </div>
          <button className="text-[9px] mt-2" style={{ color:C.cyan }}>View All Queue →</button>
        </div>

        {/* Radar chart */}
        <div className="p-3 rounded-xl" style={{ background:C.card, border:`1px solid ${C.border}` }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2">
            <div className="w-1 h-3 rounded-full" style={{ background:C.purple }} />
            AI Model Performance
          </div>
          <RadarChart width={200} height={160} data={RADAR_DATA} cx={100} cy={80}>
            <PolarGrid stroke="rgba(0,212,255,0.08)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill:'#475569', fontSize:9 }} />
            <Radar name="Score" dataKey="value" stroke={C.cyan} fill={C.cyan} fillOpacity={0.12} strokeWidth={1.5} />
          </RadarChart>
          <div className="space-y-1.5 mt-1">
            {[['NLP Models',93,C.cyan],['Vision Models',91,C.purple],['Graph Models',87,C.green],['Anomaly Models',95,C.orange],['Risk Models',93,C.amberL]].map(([l,v,c])=>(
              <div key={l} className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 flex-1">{l}</span>
                <div className="w-16 h-1 rounded-full" style={{ background:'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{ width:`${v}%`, background:c }} />
                </div>
                <span className="text-[9px] font-mono w-6 text-right" style={{ color:c }}>{v}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* System health */}
        <div className="p-3 rounded-xl" style={{ background:C.card, border:`1px solid ${C.border}` }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
            <div className="w-1 h-3 rounded-full" style={{ background:C.green }} />
            System Health
          </div>
          {[
            ['GPU Utilization', 67, C.cyan],
            ['Memory Usage',    42, C.green],
            ['Model Cache',     81, C.amberL],
            ['API Latency',     23, C.purple],
          ].map(([l,v,c])=>(
            <div key={l} className="mb-2.5">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] text-slate-500">{l}</span>
                <span className="text-[9px] font-mono" style={{ color:c }}>{v}%</span>
              </div>
              <div className="h-1 rounded-full" style={{ background:'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width:`${v}%`, background:c }} />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 mt-3 pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <Activity size={10} style={{ color:C.green }} />
            <span className="text-[9px]" style={{ color:C.green }}>All systems operational</span>
          </div>
        </div>
      </div>
    </div>
  )
}
