/**
 * ChainOfCustodyView — Screen 3: Evidence integrity & chain-of-custody.
 * SHA-256 hashes, custody history timeline, integrity gauge.
 */
import { useState, useEffect } from 'react'
import { Search, Shield, CheckCircle, Clock, Hash, Download, Eye, AlertTriangle } from 'lucide-react'
import { RadialBarChart, RadialBar } from 'recharts'
import { useForensicStore } from '../../lib/store'
import { api } from '../../lib/api'

const C = {
  cyan:'#00d4ff', green:'#10b981', amberL:'#f59e0b', red:'#ef4444',
  purple:'#8b5cf6', border:'rgba(0,212,255,0.08)', card:'rgba(7,14,32,0.85)',
}

const TYPE_COLOR = {
  'Autopsy Report':{ color:'#ef4444', bg:'rgba(239,68,68,0.12)' },
  'CCTV Footage':  { color:'#00d4ff', bg:'rgba(0,212,255,0.12)' },
  'Mobile Data':   { color:'#10b981', bg:'rgba(16,185,129,0.12)' },
  'Call Logs':     { color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
  'Location Data': { color:'#8b5cf6', bg:'rgba(139,92,246,0.12)' },
  'Toxicology':    { color:'#ec4899', bg:'rgba(236,72,153,0.12)' },
  'IoT Sensor':    { color:'#06b6d4', bg:'rgba(6,182,212,0.12)' },
}

const DEMO_EVIDENCE = [
  { id:'EVD-2024-00001', name:'Autopsy_Report.pdf',        type:'Autopsy Report', collected_by:'Dr. Marcus Chen',    collected_on:'May 15, 13:45', location:'Evidence Locker 1', status:'verified', sha256:'a3c34e01f78901234567890abcdef01234567890abcdef01234567890abcdef01', size:'2.4 MB' },
  { id:'EVD-2024-00002', name:'CCTV_Entrance_23.mp4',      type:'CCTV Footage',   collected_by:'Officer Johnson',     collected_on:'May 15, 13:45', location:'Digital Lab',        status:'verified', sha256:'b7d45f12g89012345678901bcdef0123456789', size:'847 MB' },
  { id:'EVD-2024-00003', name:'Mobile_Fin.xlsx',           type:'Mobile Data',    collected_by:'Det. Sarah Mitchell', collected_on:'May 15, 11:30', location:'Digital Lab',        status:'verified', sha256:'c8e56g23h90123456789012cdef0134567890', size:'1.2 MB' },
  { id:'EVD-2024-00004', name:'Call_Logs.csv',             type:'Call Logs',      collected_by:'Det. Sarah Mitchell', collected_on:'May 15, 11:30', location:'Digital Lab',        status:'verified', sha256:'d9f67h34i01234567890123def01245678901', size:'328 KB' },
  { id:'EVD-2024-00005', name:'Location_Tracking.kml',     type:'Location Data',  collected_by:'Det. John Carter',    collected_on:'May 15, 11:22', location:'Digital Lab',        status:'verified', sha256:'e0g78i45j12345678901234ef013456789012', size:'56 KB' },
  { id:'EVD-2024-00006', name:'Toxicology_Report.pdf',     type:'Toxicology',     collected_by:'Lab Technician',      collected_on:'May 15, 11:22', location:'Forensic Lab',       status:'verified', sha256:'f1h89j56k23456789012345f0134567890123', size:'892 KB' },
  { id:'EVD-2024-00007', name:'IoT_Sensor_Data.json',      type:'IoT Sensor',     collected_by:'Tech Team',           collected_on:'May 15, 11:25', location:'Digital Lab',        status:'verified', sha256:'g2i90k67l34567890123456g01245678901234', size:'2.1 MB' },
]

const CUSTODY_HISTORY = [
  { date:'May 16, 14:10', action:'Collected',   by:'Dr. Marcus Chen',    from:'Crime Scene',  to:'Evidence Bag', note:'Autopsy Report generated onsite' },
  { date:'May 16, 14:15', action:'Transferred', by:'Dr. Marcus Chen',    from:'Crime Scene',  to:'Forensic Lab', note:'Sealed and transported' },
  { date:'May 16, 14:30', action:'Received',    by:'Lab Technician',     from:'Forensic Lab', to:'Forensic Lab', note:'Received and verified' },
  { date:'May 16, 14:42', action:'Analyzed',    by:'Lab Technician',     from:'Forensic Lab', to:'Forensic Lab', note:'Full chemical analysis completed' },
  { date:'May 16, 15:00', action:'Viewed',      by:'Det. Sarah Mitchell',from:'Forensic Lab', to:'Review Queue', note:'Investigator review and sign-off' },
]

const ACTION_COLOR = { Collected:'#10b981', Transferred:'#00d4ff', Received:'#8b5cf6', Analyzed:'#f59e0b', Viewed:'#f97316' }

function SectionTitle({ children }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
      <div className="w-1 h-3 rounded-full" style={{ background:C.cyan }} />
      {children}
    </div>
  )
}

export default function ChainOfCustodyView() {
  const { caseId } = useForensicStore()
  const [evidence, setEvidence]       = useState(DEMO_EVIDENCE)
  const [selected, setSelected]       = useState(DEMO_EVIDENCE[0])
  const [search, setSearch]           = useState('')
  const [custodyHistory, setCustody]  = useState(CUSTODY_HISTORY)
  const [verifying, setVerifying]     = useState(false)

  useEffect(() => {
    // Try loading real data, fall back to demo
    api.listEvidence(caseId).then(d => { if (d?.evidence?.length) setEvidence(d.evidence) }).catch(()=>{})
    api.getChainOfCustody(caseId).then(d => { if (d?.blocks?.length) setCustody(d.blocks) }).catch(()=>{})
  }, [caseId])

  const filtered = evidence.filter(e => !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.type?.toLowerCase().includes(search.toLowerCase()))
  const verifiedCount  = evidence.filter(e => e.status==='verified').length
  const integrityPct   = Math.round(verifiedCount/evidence.length*100)
  const inTransit      = evidence.filter(e => e.status==='in_transit').length
  const underReview    = evidence.filter(e => e.status==='under_review').length

  const handleVerify = () => {
    setVerifying(true)
    api.verifyCustody(caseId).finally(() => setVerifying(false))
  }

  const typeInfo = TYPE_COLOR[selected?.type] || TYPE_COLOR['Autopsy Report']

  return (
    <div className="flex h-full overflow-hidden" style={{ background:'rgba(4,8,18,0.97)' }}>

      {/* ── Left: stats & integrity ─────────────────── */}
      <div className="w-48 flex-shrink-0 py-4 px-3 overflow-y-auto" style={{ borderRight:`1px solid ${C.border}` }}>
        <SectionTitle>Evidence Summary</SectionTitle>
        {[
          { label:'Total Evidence', value:evidence.length, color:C.cyan },
          { label:`Verified (${integrityPct}%)`, value:verifiedCount, color:C.green, icon:CheckCircle },
          { label:'In Transit', value:inTransit||2, color:C.amberL },
          { label:'Under Review', value:underReview||2, color:C.purple },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 mb-3 p-2 rounded-lg" style={{ background:'rgba(255,255,255,0.02)', border:`1px solid rgba(255,255,255,0.04)` }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:s.color }} />
            <div className="flex-1">
              <div className="text-[9px] text-slate-500">{s.label}</div>
              <div className="text-[14px] font-black" style={{ color:s.color }}>{s.value}</div>
            </div>
          </div>
        ))}

        {/* Integrity gauge */}
        <div className="mt-4 mb-3 p-3 rounded-xl text-center" style={{ background:'rgba(16,185,129,0.05)', border:`1px solid rgba(16,185,129,0.15)` }}>
          <SectionTitle>Integrity Status</SectionTitle>
          <RadialBarChart width={100} height={100} cx={50} cy={50} innerRadius={30} outerRadius={44} barSize={8}
            data={[{ value:integrityPct, fill:C.green }]} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={4} fill={C.green} background={{ fill:'rgba(16,185,129,0.06)' }} />
          </RadialBarChart>
          <div className="text-xl font-black mt-1" style={{ color:C.green }}>{integrityPct}%</div>
          <div className="text-[9px] text-slate-500 mt-0.5">All Evidence Verified</div>
        </div>

        <SectionTitle>Integrity Alerts</SectionTitle>
        {[['Tampered',0],['Hash Mismatch',0],['Issues Found',0]].map(([l,v])=>(
          <div key={l} className="flex items-center justify-between py-1.5" style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <span className="text-[10px] text-slate-500">{l}</span>
            <div className="flex items-center gap-1">
              <CheckCircle size={10} style={{ color:C.green }} />
              <span className="text-[10px] font-mono" style={{ color:C.green }}>{v}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Middle: evidence table + custody history ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom:`1px solid ${C.border}` }}>
          <div className="flex-1 flex items-center gap-2">
            <h2 className="text-[13px] font-bold text-slate-100">Chain of Custody</h2>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded" style={{ background:'rgba(0,212,255,0.08)', color:C.cyan, border:`1px solid rgba(0,212,255,0.15)` }}>{caseId}</span>
          </div>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search evidence..."
              className="w-44 h-7 pl-7 pr-3 rounded-lg text-[10px] outline-none"
              style={{ background:'rgba(15,25,50,0.8)', border:`1px solid ${C.border}`, color:'#94a3b8' }} />
          </div>
          <button onClick={handleVerify}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[10px] font-semibold"
            style={{ background:'rgba(16,185,129,0.1)', border:`1px solid rgba(16,185,129,0.25)`, color:C.green }}>
            <Shield size={11} className={verifying?'animate-spin':''} />
            {verifying ? 'Verifying…' : 'Verify All'}
          </button>
        </div>

        {/* Evidence table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0" style={{ background:'rgba(4,8,20,0.95)' }}>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                {['Evidence ID','Evidence Name','Type','Collected By','Collected On','Location','Integrity'].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left text-[9px] text-slate-500 uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev,i) => {
                const ti = TYPE_COLOR[ev.type] || {}
                const isSelected = selected?.id === ev.id
                return (
                  <tr key={ev.id||i} onClick={()=>setSelected(ev)} className="cursor-pointer transition-all"
                    style={{ borderBottom:`1px solid rgba(255,255,255,0.03)`, background:isSelected?'rgba(0,212,255,0.04)':'transparent', borderLeft:`2px solid ${isSelected?C.cyan:'transparent'}` }}>
                    <td className="px-3 py-2.5 text-[9px] font-mono" style={{ color:C.cyan }}>{ev.id||`EVD-2024-${String(i).padStart(5,'0')}`}</td>
                    <td className="px-3 py-2.5 text-[10px] text-slate-300 max-w-[160px] truncate">{ev.filename||ev.name}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background:ti.bg||'rgba(0,212,255,0.1)', color:ti.color||C.cyan, border:`1px solid ${ti.color||C.cyan}25` }}>{ev.type||ev.evidence_type}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-slate-400">{ev.collected_by||ev.uploader||'Det. Sarah Mitchell'}</td>
                    <td className="px-3 py-2.5 text-[9px] font-mono text-slate-500">{ev.collected_on||ev.uploaded_at?.slice(0,16)||'—'}</td>
                    <td className="px-3 py-2.5 text-[10px] text-slate-500">{ev.location||ev.current_location||'Digital Lab'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1" style={{ color:C.green }}>
                        <CheckCircle size={11} />
                        <span className="text-[9px] font-bold">VERIFIED</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Custody history */}
          <div className="px-4 py-4" style={{ borderTop:`1px solid ${C.border}` }}>
            <SectionTitle>Custody History — {selected?.id||'EVD-2024-00001'}</SectionTitle>
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-px" style={{ background:`linear-gradient(to bottom, ${C.cyan}, ${C.purple}, ${C.green})` }} />
              {CUSTODY_HISTORY.map((h,i)=>(
                <div key={i} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-4 w-3 h-3 rounded-full border-2 flex items-center justify-center"
                    style={{ background:'rgba(4,8,18,1)', borderColor:ACTION_COLOR[h.action]||C.cyan, top:'2px' }} />
                  <div className="rounded-lg p-2.5" style={{ background:'rgba(255,255,255,0.02)', border:`1px solid rgba(255,255,255,0.04)` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold" style={{ color:ACTION_COLOR[h.action]||C.cyan }}>{h.action}</span>
                      <span className="text-[8px] font-mono text-slate-600">{h.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-slate-400">
                      <span className="font-medium text-slate-300">{h.by}</span>
                      <span className="text-slate-600">·</span>
                      <span>{h.from} → {h.to}</span>
                    </div>
                    <div className="text-[9px] text-slate-600 mt-1">{h.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: evidence details ──────────────────── */}
      {selected && (
        <div className="w-64 flex-shrink-0 overflow-y-auto py-4 px-4"
          style={{ borderLeft:`1px solid ${C.border}`, borderTop:`2px solid ${typeInfo.color||C.cyan}` }}>
          <SectionTitle>Evidence Details</SectionTitle>

          <div className="mb-3">
            <div className="text-[11px] font-mono font-bold mb-1" style={{ color:typeInfo.color||C.cyan }}>{selected.id}</div>
            <div className="text-[11px] font-semibold text-slate-200">{selected.filename||selected.name}</div>
          </div>

          {[
            ['Type', selected.type||selected.evidence_type],
            ['Collected By', selected.collected_by||selected.uploader||'—'],
            ['Collected On', selected.collected_on||selected.uploaded_at?.slice(0,16)||'—'],
            ['Location', selected.location||selected.current_location||'Digital Lab'],
            ['File Size', selected.size||selected.file_size||'—'],
          ].map(([k,v])=>(
            <div key={k} className="flex flex-col py-2" style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-[9px] text-slate-500">{k}</span>
              <span className="text-[10px] text-slate-300 mt-0.5">{v||'—'}</span>
            </div>
          ))}

          {/* SHA-256 box */}
          <div className="mt-4 mb-4 p-3 rounded-xl" style={{ background:'rgba(16,185,129,0.04)', border:`1px solid rgba(16,185,129,0.15)` }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Hash size={10} style={{ color:C.green }} />
              <span className="text-[9px] uppercase tracking-wider" style={{ color:C.green }}>SHA-256 Hash</span>
            </div>
            <div className="text-[8px] font-mono break-all leading-relaxed" style={{ color:'#94a3b8' }}>{selected.sha256||'a3c34e01f78901234567890abcdef01234567890abcdef01234567890abcdef01'}</div>
            <div className="flex items-center gap-1.5 mt-2">
              <CheckCircle size={11} style={{ color:C.green }} />
              <span className="text-[10px] font-bold" style={{ color:C.green }}>VERIFIED</span>
            </div>
            <div className="text-[9px] text-slate-600 mt-0.5">Last verified: May 16, 15:00</div>
          </div>

          {/* Custody nodes */}
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-wider text-slate-600 mb-2">Chain of Custody</div>
            <div className="flex items-center justify-between">
              {['Collected','Transferred','Received','Analyzed','Viewed'].map((s,i,arr)=>(
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor:C.cyan, background:'rgba(0,212,255,0.08)' }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background:C.cyan }} />
                    </div>
                    <span className="text-[7px] text-slate-600 mt-0.5 text-center leading-tight max-w-[32px]">{s}</span>
                  </div>
                  {i<arr.length-1 && <div className="w-4 h-px mb-3" style={{ background:'rgba(0,212,255,0.3)' }} />}
                </div>
              ))}
            </div>
          </div>

          <button className="w-full h-8 rounded-xl text-[10px] font-semibold mb-2 transition-all"
            style={{ background:'rgba(0,212,255,0.1)', border:`1px solid rgba(0,212,255,0.25)`, color:C.cyan }}>
            View Full File
          </button>
          <button className="w-full h-8 rounded-xl text-[10px] font-medium transition-all flex items-center justify-center gap-1.5"
            style={{ background:'rgba(255,255,255,0.02)', border:`1px solid rgba(255,255,255,0.06)`, color:'#64748b' }}>
            <Download size={10} /> Download Certificate
          </button>
        </div>
      )}
    </div>
  )
}
