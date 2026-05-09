/**
 * ForensicCommandDashboard — Screen 1: Master forensic overview.
 * Matches the generated premium UI with stat cards, charts, queue, activity feed.
 */
import { useState, useEffect } from 'react'
import {
  FileText, AlertTriangle, Shield, Brain, Clock, ChevronRight,
  TrendingUp, Activity, Zap, RefreshCw, Network, Eye,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from 'recharts'
import { useForensicStore } from '../lib/store'
import { api } from '../lib/api'

// ── colour palette ─────────────────────────────────────────────────────────
const C = {
  cyan:   '#00d4ff',  amberL: '#f59e0b', red:   '#ef4444',
  green:  '#10b981',  purple: '#8b5cf6', orange:'#f97316',
  border: 'rgba(0,212,255,0.10)', card: 'rgba(7,14,32,0.85)',
}

const PIE_COLORS = [C.red, C.orange, C.amberL, C.green]
const RISK_LABELS = ['Critical','High','Medium','Low']

const EVIDENCE_TREND = [
  { d:'May 10', autopsy:2,cctv:4,mobile:1,calls:3,location:2,iot:1 },
  { d:'May 11', autopsy:3,cctv:6,mobile:2,calls:5,location:3,iot:2 },
  { d:'May 12', autopsy:2,cctv:5,mobile:3,calls:4,location:4,iot:3 },
  { d:'May 13', autopsy:4,cctv:8,mobile:2,calls:6,location:3,iot:4 },
  { d:'May 14', autopsy:3,cctv:7,mobile:4,calls:5,location:5,iot:3 },
  { d:'May 15', autopsy:5,cctv:9,mobile:3,calls:7,location:4,iot:5 },
  { d:'May 16', autopsy:4,cctv:8,mobile:5,calls:6,location:6,iot:4 },
]

const ACTIVITY = [
  { icon: FileText, color: C.red,    text: 'Autopsy report uploaded',    caseId: 'FTI-2024-0847', time: '2m ago' },
  { icon: Shield,   color: C.cyan,   text: 'CCTV footage processed',     caseId: 'FTI-2024-0848', time: '8m ago' },
  { icon: Brain,    color: C.purple, text: 'AI analysis completed',      caseId: 'FTI-2024-0847', time: '12m ago' },
  { icon: TrendingUp,color:C.orange, text: 'Risk score updated',         caseId: 'FTI-2024-0847', time: '18m ago' },
  { icon: Clock,    color: C.amberL, text: 'Human review submitted',     caseId: 'FTI-2024-0849', time: '24m ago' },
]

const INSIGHTS = [
  'Suspicious movement detected in Suspect S1 path near exit route at 01:40.',
  'Organophosphate detected in toxicology — suggests poisoning as cause of death.',
  'Timeline anomalies: 18-minute gap in CCTV coverage correlates with TOD.',
  'Encrypted communications found between Suspect S1 and unknown burner device.',
]

// ── helpers ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, iconColor, valueColor = '#e2e8f0', trend }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{
      background: C.card, border: `1px solid ${C.border}`,
      boxShadow: `0 0 20px rgba(0,0,0,0.4)`,
    }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${iconColor}15`, border:`1px solid ${iconColor}30` }}>
          <Icon size={13} style={{ color: iconColor }} />
        </div>
      </div>
      <div className="text-3xl font-black" style={{ color: valueColor }}>{value}</div>
      {sub && <div className="text-[10px]" style={{ color: trend === 'up' ? C.green : '#64748b' }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
        <div className="w-1 h-3 rounded-full" style={{ background: C.cyan }} />
        {children}
      </div>
      {action}
    </div>
  )
}

function Panel({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-xl p-4 ${className}`}
      style={{ background: C.card, border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  )
}

const RISK_BADGE = {
  critical: { bg:'rgba(239,68,68,0.12)', border:'rgba(239,68,68,0.3)', color:'#ef4444' },
  high:     { bg:'rgba(249,115,22,0.12)', border:'rgba(249,115,22,0.3)', color:'#f97316' },
  medium:   { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)', color:'#f59e0b' },
  low:      { bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)', color:'#10b981' },
}
const STATUS_BADGE = {
  active:      { bg:'rgba(16,185,129,0.10)', border:'rgba(16,185,129,0.25)', color:'#10b981' },
  'under review':{ bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.25)', color:'#f59e0b' },
  closed:      { bg:'rgba(100,116,139,0.10)', border:'rgba(100,116,139,0.2)', color:'#64748b' },
}

function RiskBadge({ level }) {
  const s = RISK_BADGE[level?.toLowerCase()] || RISK_BADGE.low
  return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background:s.bg,border:`1px solid ${s.border}`,color:s.color }}>{level}</span>
}
function StatusBadge({ status }) {
  const s = STATUS_BADGE[status?.toLowerCase()] || STATUS_BADGE.active
  return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold capitalize" style={{ background:s.bg,border:`1px solid ${s.border}`,color:s.color }}>{status}</span>
}

// ── main ───────────────────────────────────────────────────────────────────
export default function ForensicCommandDashboard() {
  const { caseId, riskData, setActiveNavId } = useForensicStore()
  const [cases, setCases]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const c = await api.getCases()
      setCases(c || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const totalEvidence = cases.reduce((a,c) => a+(c.evidence_count||68), 0) || 1248
  const criticalCount = cases.filter(c => c.priority==='critical').length || 4
  const pieData = [
    { name:'Critical', value: criticalCount || 4 },
    { name:'High',     value: 3 },
    { name:'Medium',   value: 3 },
    { name:'Low',      value: 2 },
  ]
  const radarData = [{ name:'Accuracy', value: 92, fill: C.cyan }]

  return (
    <div className="h-full overflow-y-auto px-5 py-4" style={{ background:'rgba(4,8,18,0.97)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[16px] font-black text-slate-100">Forensic Command Dashboard</h1>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">Real-time forensic intelligence overview</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold transition-all"
          style={{ background:'rgba(0,212,255,0.08)', border:`1px solid ${C.border}`, color:C.cyan }}>
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard label="Active Cases"    value={cases.length || 12} sub="+3 this week" icon={FileText}      iconColor={C.cyan}   valueColor={C.cyan}   trend="up" />
        <StatCard label="High Risk"       value={criticalCount}       sub="33% of total" icon={AlertTriangle} iconColor={C.red}    valueColor={C.red} />
        <StatCard label="Total Evidence"  value={totalEvidence.toLocaleString()} sub="+312 this week" icon={Shield} iconColor={C.green} valueColor='#e2e8f0' trend="up" />
        <StatCard label="AI Alerts"       value={23}                  sub="+7 this week"  icon={Brain}         iconColor={C.amberL} valueColor={C.amberL} />
        <StatCard label="Pending Reviews" value={8}                   sub="Requires attention" icon={Clock}   iconColor={C.purple} valueColor={C.purple} />
      </div>

      {/* Row 2: Charts + Queue + Activity */}
      <div className="grid grid-cols-12 gap-3 mb-4">

        {/* Evidence trend chart — 5 cols */}
        <Panel className="col-span-5">
          <SectionTitle>Evidence by Source</SectionTitle>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={EVIDENCE_TREND} margin={{ top:4, right:4, bottom:0, left:-20 }}>
              <XAxis dataKey="d" tick={{ fill:'#475569', fontSize:8 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#475569', fontSize:8 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:'#0a1628', border:`1px solid ${C.border}`, borderRadius:8, fontSize:10 }}
                labelStyle={{ color:'#94a3b8' }} itemStyle={{ color:'#e2e8f0' }} />
              <Line type="monotone" dataKey="autopsy"  stroke={C.red}    strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="cctv"     stroke={C.cyan}   strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="mobile"   stroke={C.green}  strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="calls"    stroke={C.amberL} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="location" stroke={C.purple} strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="iot"      stroke={C.orange} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {[['Autopsy',C.red],['CCTV',C.cyan],['Mobile',C.green],['Calls',C.amberL],['Location',C.purple],['IoT',C.orange]].map(([l,c]) => (
              <div key={l} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background:c }} />
                <span className="text-[9px] text-slate-500">{l}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Case priority queue — 4 cols */}
        <Panel className="col-span-4">
          <SectionTitle action={
            <button onClick={()=>setActiveNavId('cases')} className="text-[9px] text-cyan-400 hover:text-cyan-300 transition-colors">View all →</button>
          }>Case Priority Queue</SectionTitle>
          <table className="w-full">
            <thead>
              <tr>
                {['Case ID','Type','Risk','Status','Updated'].map(h=>(
                  <th key={h} className="text-left text-[8px] text-slate-600 uppercase tracking-wider pb-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(cases.length ? cases : [
                { id:'FTI-2024-0847', classification:'Homicide',  priority:'critical', status:'active', updated_at:'May 16, 16:24' },
                { id:'FTI-2024-0848', classification:'Homicide',  priority:'high',     status:'active', updated_at:'May 16, 15:11' },
                { id:'FTI-2024-0849', classification:'Suicide',   priority:'medium',   status:'under review', updated_at:'May 16, 14:45' },
                { id:'FTI-2024-0850', classification:'Accident',  priority:'low',      status:'active', updated_at:'May 16, 13:30' },
                { id:'FTI-2024-0851', classification:'Homicide',  priority:'high',     status:'active', updated_at:'May 16, 12:00' },
              ]).slice(0,5).map((c,i) => (
                <tr key={c.id||i} className="border-t hover:bg-white/[0.02] cursor-pointer" style={{ borderColor:'rgba(255,255,255,0.04)' }}>
                  <td className="py-2 text-[10px] font-mono" style={{ color:C.cyan }}>{c.id}</td>
                  <td className="py-2 text-[10px] text-slate-400">{c.classification||'Homicide'}</td>
                  <td className="py-2"><RiskBadge level={c.priority} /></td>
                  <td className="py-2"><StatusBadge status={c.status||'active'} /></td>
                  <td className="py-2 text-[9px] text-slate-600 font-mono">{c.updated_at||'May 16'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Right col: Donut + radial — 3 cols */}
        <div className="col-span-3 flex flex-col gap-3">
          {/* Risk distribution donut */}
          <Panel>
            <SectionTitle>Risk Distribution</SectionTitle>
            <div className="flex items-center gap-3">
              <PieChart width={90} height={90}>
                <Pie data={pieData} cx={40} cy={40} innerRadius={25} outerRadius={40} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  {pieData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-1">
                {pieData.map((d,i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background:PIE_COLORS[i] }} />
                    <span className="text-[9px] text-slate-400 flex-1">{d.name}</span>
                    <span className="text-[9px] font-bold" style={{ color:PIE_COLORS[i] }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* AI Performance gauge */}
          <Panel>
            <SectionTitle>AI Performance</SectionTitle>
            <div className="flex items-center gap-3">
              <RadialBarChart width={75} height={75} cx={37} cy={37} innerRadius={22} outerRadius={35} barSize={6} data={radarData} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={4} fill={C.cyan} background={{ fill:'rgba(0,212,255,0.06)' }} />
              </RadialBarChart>
              <div>
                <div className="text-2xl font-black" style={{ color:C.cyan }}>92%</div>
                <div className="text-[9px] text-slate-500">Accuracy</div>
                <div className="text-[8px] text-slate-600 mt-1">1,248 analyzed</div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* Row 3: AI Insights + Recent Activity */}
      <div className="grid grid-cols-12 gap-3">
        {/* Top AI Insights */}
        <Panel className="col-span-5">
          <SectionTitle>Top AI Insights</SectionTitle>
          <div className="space-y-2">
            {INSIGHTS.map((ins,i) => (
              <div key={i} className="flex gap-2 py-1.5 border-b last:border-0" style={{ borderColor:'rgba(255,255,255,0.04)' }}>
                <div className="w-0.5 rounded-full flex-shrink-0 mt-1" style={{ background:C.cyan, minHeight:16 }} />
                <p className="text-[10px] text-slate-300 leading-relaxed">{ins}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* Investigator stats */}
        <Panel className="col-span-3">
          <SectionTitle>Investigator Workload</SectionTitle>
          <div className="space-y-3">
            {[
              { name:'Det. Sarah Mitchell', cases:4, risk:94, avatar:'SM' },
              { name:'Det. John Carter',    cases:3, risk:72, avatar:'JC' },
              { name:'Det. Mary Chen',      cases:2, risk:61, avatar:'MC' },
              { name:'Det. John Brown',     cases:3, risk:45, avatar:'JB' },
            ].map(inv => (
              <div key={inv.name} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                  style={{ background:'rgba(0,212,255,0.12)', color:C.cyan, border:`1px solid rgba(0,212,255,0.2)` }}>
                  {inv.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-300 truncate">{inv.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1 rounded-full" style={{ background:'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width:`${inv.risk}%`, background: inv.risk>80?C.red:inv.risk>60?C.amberL:C.green }} />
                    </div>
                    <span className="text-[9px] text-slate-500">{inv.cases} cases</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Recent Activity */}
        <Panel className="col-span-4">
          <SectionTitle>
            <span>Recent Activity</span>
            <div className="w-1.5 h-1.5 rounded-full ml-1 blink" style={{ background:'#10b981' }} />
          </SectionTitle>
          <div className="space-y-2">
            {ACTIVITY.map((a,i) => {
              const Icon = a.icon
              return (
                <div key={i} className="flex items-start gap-2.5 py-1.5 border-b last:border-0" style={{ borderColor:'rgba(255,255,255,0.04)' }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background:`${a.color}12`, border:`1px solid ${a.color}25` }}>
                    <Icon size={11} style={{ color:a.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-slate-300">{a.text}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-mono" style={{ color:C.cyan }}>{a.caseId}</span>
                      <span className="text-[9px] text-slate-600">{a.time}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}
