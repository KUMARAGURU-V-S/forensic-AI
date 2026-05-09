/**
 * CasesView — Screen 2: Case Management Center
 * Full case table with risk badges, filter tabs, expandable detail panel.
 */
import { useState, useEffect } from 'react'
import {
  Search, SlidersHorizontal, Plus, ChevronRight, ChevronLeft,
  Eye, Edit2, ExternalLink, FileText, AlertTriangle, Shield,
  Brain, Clock, X,
} from 'lucide-react'
import { useForensicStore } from '../../lib/store'
import { api } from '../../lib/api'

const C = {
  cyan:'#00d4ff', red:'#ef4444', orange:'#f97316',
  amberL:'#f59e0b', green:'#10b981', purple:'#8b5cf6',
  border:'rgba(0,212,255,0.08)', card:'rgba(7,14,32,0.85)',
}

const RISK_STYLE = {
  critical:{ bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.3)',  color:'#ef4444' },
  high:    { bg:'rgba(249,115,22,0.12)', border:'rgba(249,115,22,0.3)', color:'#f97316' },
  medium:  { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)', color:'#f59e0b' },
  low:     { bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)', color:'#10b981' },
}
const STATUS_STYLE = {
  active:        { bg:'rgba(16,185,129,0.10)', border:'rgba(16,185,129,0.25)', color:'#10b981' },
  'under review':{ bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.25)', color:'#f59e0b' },
  closed:        { bg:'rgba(100,116,139,0.10)', border:'rgba(100,116,139,0.18)', color:'#64748b' },
}

const DEMO_CASES = [
  { id:'FTI-2024-0847', title:'Riverside Industrial Complex - Suspicious Death', classification:'Homicide',   priority:'critical', lead_investigator:'Det. Sarah Mitchell', created_at:'May 15, 10:24', updated_at:'May 16, 16:24', status:'active',        evidence_count:68, ai_alerts:7, pending_reviews:3 },
  { id:'FTI-2024-0848', title:'Downtown Apartment Death',                        classification:'Homicide',   priority:'high',     lead_investigator:'Det. John Carter',    created_at:'May 14, 09:11', updated_at:'May 16, 15:24', status:'active',        evidence_count:34, ai_alerts:4, pending_reviews:1 },
  { id:'FTI-2024-0849', title:'Warehouse Incident',                              classification:'Suicide',    priority:'medium',   lead_investigator:'Det. Sarah Mitchell', created_at:'May 14, 09:11', updated_at:'May 16, 15:45', status:'under review',  evidence_count:21, ai_alerts:2, pending_reviews:2 },
  { id:'FTI-2024-0850', title:'Highway Accident Case',                           classification:'Accident',   priority:'low',      lead_investigator:'Det. John Brown',     created_at:'May 13, 10:00', updated_at:'May 16, 14:30', status:'active',        evidence_count:15, ai_alerts:0, pending_reviews:0 },
  { id:'FTI-2024-0851', title:'Park Theft Incident',                             classification:'Robbery',    priority:'high',     lead_investigator:'Det. Mary Chen',      created_at:'May 13, 11:22', updated_at:'May 16, 13:11', status:'active',        evidence_count:8,  ai_alerts:1, pending_reviews:0 },
  { id:'FTI-2024-0852', title:'Hotel Room Death',                                classification:'Homicide',   priority:'medium',   lead_investigator:'Det. John Carter',    created_at:'May 12, 13:48', updated_at:'May 14, 12:22', status:'active',        evidence_count:29, ai_alerts:3, pending_reviews:1 },
  { id:'FTI-2024-0853', title:'Eastway Fall Case',                               classification:'Accident',   priority:'low',      lead_investigator:'Det. Sarah Mitchell', created_at:'May 11, 15:14', updated_at:'May 14, 09:14', status:'closed',        evidence_count:12, ai_alerts:0, pending_reviews:0 },
  { id:'FTI-2024-0854', title:'Poisoning Case',                                  classification:'Homicide',   priority:'critical', lead_investigator:'Det. Sarah Mitchell', created_at:'May 11, 13:32', updated_at:'May 14, 11:45', status:'under review',  evidence_count:44, ai_alerts:5, pending_reviews:2 },
]

function RiskBadge({ level }) {
  const s = RISK_STYLE[level?.toLowerCase()] || RISK_STYLE.low
  return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.color }}>{level}</span>
}
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status?.toLowerCase()] || STATUS_STYLE.active
  return <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold capitalize" style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.color }}>{status}</span>
}

const TABS = ['All Cases','Active','Under Review','Closed']
const PER_PAGE = 8

export default function CasesView() {
  const { caseId: activeCaseId, setActiveNavId } = useForensicStore()
  const [cases, setCases]       = useState(DEMO_CASES)
  const [search, setSearch]     = useState('')
  const [tab, setTab]           = useState('All Cases')
  const [selected, setSelected] = useState(DEMO_CASES[0])
  const [page, setPage]         = useState(1)

  useEffect(() => {
    api.getCases().then(c => { if (c?.length) setCases(c) }).catch(() => {})
  }, [])

  const filtered = cases.filter(c => {
    const matchSearch = !search || c.id.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase())
    const matchTab = tab === 'All Cases' || c.status?.toLowerCase().replace(' ','_') === tab.toLowerCase().replace(' ','_') || c.status === tab.toLowerCase()
    return matchSearch && matchTab
  })

  const tabCounts = {
    'All Cases': cases.length,
    'Active': cases.filter(c => c.status === 'active').length,
    'Under Review': cases.filter(c => c.status === 'under review').length,
    'Closed': cases.filter(c => c.status === 'closed').length,
  }

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)

  return (
    <div className="flex h-full overflow-hidden" style={{ background:'rgba(4,8,18,0.97)' }}>

      {/* ── Main panel ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom:`1px solid ${C.border}` }}>
          <div className="flex-1">
            <h1 className="text-[15px] font-black text-slate-100">Case Management</h1>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Manage all active forensic investigations</p>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search cases..."
              className="w-48 h-8 pl-7 pr-3 rounded-lg text-[11px] outline-none"
              style={{ background:'rgba(15,25,50,0.8)', border:`1px solid ${C.border}`, color:'#94a3b8', fontFamily:'Inter,sans-serif' }} />
          </div>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-medium"
            style={{ background:'rgba(255,255,255,0.04)', border:`1px solid rgba(255,255,255,0.08)`, color:'#64748b' }}>
            <SlidersHorizontal size={11} /> Filters
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold"
            style={{ background:'rgba(0,212,255,0.1)', border:`1px solid rgba(0,212,255,0.25)`, color:C.cyan }}>
            <Plus size={11} /> New Case
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0 px-5 flex-shrink-0" style={{ borderBottom:`1px solid ${C.border}` }}>
          {TABS.map(t => (
            <button key={t} onClick={()=>{ setTab(t); setPage(1) }}
              className="px-4 py-2.5 text-[11px] font-medium transition-all relative"
              style={{ color: tab===t ? C.cyan : '#475569' }}>
              {t} <span className="text-[9px] ml-0.5 opacity-70">({tabCounts[t]||0})</span>
              {tab===t && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background:C.cyan }} />}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10" style={{ background:'rgba(4,8,20,0.95)' }}>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                {['Case ID','Case Title','Type','Risk Level','Assigned To','Created','Last Updated','Status','Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-[9px] text-slate-500 uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((c,i) => {
                const isSelected = selected?.id === c.id
                const isActive   = c.id === activeCaseId
                return (
                  <tr key={c.id} onClick={()=>setSelected(c)}
                    className="cursor-pointer transition-all"
                    style={{
                      borderBottom:`1px solid rgba(255,255,255,0.03)`,
                      background: isSelected ? 'rgba(0,212,255,0.04)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.008)',
                      borderLeft: isSelected ? `2px solid ${C.cyan}` : '2px solid transparent',
                    }}>
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-mono" style={{ color:C.cyan }}>{c.id}</span>
                      {isActive && <span className="ml-1 text-[8px] px-1 rounded" style={{ background:'rgba(0,212,255,0.1)', color:C.cyan }}>Active</span>}
                    </td>
                    <td className="px-3 py-3 text-[10px] text-slate-300 max-w-[200px] truncate">{c.title}</td>
                    <td className="px-3 py-3 text-[10px] text-slate-400">{c.classification}</td>
                    <td className="px-3 py-3"><RiskBadge level={c.priority} /></td>
                    <td className="px-3 py-3 text-[10px] text-slate-400">{c.lead_investigator}</td>
                    <td className="px-3 py-3 text-[9px] text-slate-600 font-mono">{c.created_at||'—'}</td>
                    <td className="px-3 py-3 text-[9px] text-slate-600 font-mono">{c.updated_at||'—'}</td>
                    <td className="px-3 py-3"><StatusBadge status={c.status||'active'} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5 transition-colors">
                          <Eye size={11} className="text-slate-500" />
                        </button>
                        <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5 transition-colors">
                          <Edit2 size={11} className="text-slate-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0" style={{ borderTop:`1px solid ${C.border}` }}>
          <span className="text-[10px] text-slate-500">
            Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,filtered.length)} of {filtered.length} cases
          </span>
          <div className="flex items-center gap-1">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:bg-white/5 disabled:opacity-30 transition-colors">
              <ChevronLeft size={13} />
            </button>
            {Array.from({length:totalPages},(_, i)=>i+1).map(p=>(
              <button key={p} onClick={()=>setPage(p)}
                className="w-7 h-7 rounded text-[10px] font-medium transition-colors"
                style={{ background:p===page?'rgba(0,212,255,0.12)':'transparent', color:p===page?C.cyan:'#64748b', border:`1px solid ${p===page?'rgba(0,212,255,0.25)':'transparent'}` }}>
                {p}
              </button>
            ))}
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:bg-white/5 disabled:opacity-30 transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Detail panel ──────────────────────────────── */}
      {selected && (
        <div className="w-72 flex-shrink-0 flex flex-col overflow-y-auto"
          style={{ borderLeft:`1px solid ${C.border}`, background:'rgba(5,10,24,0.98)', borderTop:`2px solid ${C.cyan}` }}>
          <div className="px-4 py-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              <span className="text-[11px] font-mono font-bold" style={{ color:C.cyan }}>{selected.id}</span>
              <button onClick={()=>setSelected(null)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/5">
                <X size={10} className="text-slate-500" />
              </button>
            </div>
            <h2 className="text-[12px] font-bold text-slate-100 leading-snug mb-3">{selected.title}</h2>

            <div className="flex items-center gap-2 mb-4">
              <StatusBadge status={selected.status||'active'} />
              <RiskBadge level={selected.priority} />
            </div>

            {/* Meta rows */}
            {[
              ['Assigned To',  selected.lead_investigator],
              ['Case Type',    selected.classification],
              ['Created',      selected.created_at||'—'],
              ['Last Updated', selected.updated_at||'—'],
            ].map(([k,v])=>(
              <div key={k} className="flex items-center justify-between py-1.5" style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] text-slate-500">{k}</span>
                <span className="text-[10px] text-slate-300 font-medium text-right max-w-[150px] truncate">{v}</span>
              </div>
            ))}

            {/* Evidence stats */}
            <div className="mt-4 mb-3">
              <div className="text-[9px] uppercase tracking-wider text-slate-600 mb-2">Evidence</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-black" style={{ color:C.cyan }}>{selected.evidence_count||68}</div>
                <div className="flex-1">
                  <div className="text-[9px] text-slate-500 mb-0.5">Total items</div>
                  <div className="h-1 rounded-full" style={{ background:'rgba(0,212,255,0.08)' }}>
                    <div className="h-full rounded-full" style={{ width:`${Math.min(100,(selected.evidence_count||68)/2)}%`, background:C.cyan }} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {[
                  ['AI Alerts',selected.ai_alerts||7,C.amberL],
                  ['Pending Reviews',selected.pending_reviews||3,C.purple],
                ].map(([l,v,c])=>(
                  <div key={l} className="p-2 rounded-lg text-center" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-lg font-black" style={{ color:c }}>{v}</div>
                    <div className="text-[9px] text-slate-500">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              <div className="text-[9px] uppercase tracking-wider text-slate-600 mb-1.5">Description</div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Suspicious death investigation at {selected.title}. Investigation covers CCTV footage, mobile records, toxicology reports, and autopsy findings.
              </p>
            </div>

            {/* Actions */}
            <button onClick={()=>setActiveNavId('timeline')}
              className="w-full h-9 rounded-xl text-[11px] font-semibold mb-2 transition-all"
              style={{ background:'rgba(0,212,255,0.1)', border:`1px solid rgba(0,212,255,0.25)`, color:C.cyan }}>
              Open Case Workspace
            </button>
            <button className="w-full h-8 rounded-xl text-[10px] font-medium transition-all"
              style={{ background:'rgba(255,255,255,0.03)', border:`1px solid rgba(255,255,255,0.08)`, color:'#64748b' }}>
              Export Case
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
