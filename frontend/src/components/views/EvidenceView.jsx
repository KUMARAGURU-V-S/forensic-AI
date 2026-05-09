import { useState, useEffect } from 'react'
import {
  FileText, Video, Smartphone, Phone, MapPin, FlaskConical,
  Cpu, FileCheck, Upload, Hash, Eye, Download, Search,
  Filter, ChevronLeft, ChevronRight, Shield, AlertTriangle, Clock
} from 'lucide-react'
import { useForensicStore } from '../../lib/store'
import { api } from '../../lib/api'

const TYPE_META = {
  autopsy:    { label: 'Autopsy Report',    icon: FileText,    color: '#ef4444' },
  cctv:       { label: 'CCTV Footage',      icon: Video,       color: '#00d4ff' },
  mobile:     { label: 'Mobile Activity',   icon: Smartphone,  color: '#10b981' },
  calls:      { label: 'Call Logs',         icon: Phone,       color: '#f59e0b' },
  location:   { label: 'Location Data',     icon: MapPin,      color: '#8b5cf6' },
  toxicology: { label: 'Toxicology Report', icon: FlaskConical,color: '#ec4899' },
  iot:        { label: 'IoT / Sensor Data', icon: Cpu,         color: '#06b6d4' },
  physical:   { label: 'Physical Evidence', icon: FileCheck,   color: '#f97316' },
  comms:      { label: 'Communication',     icon: Phone,       color: '#a78bfa' },
  document:   { label: 'Document',          icon: FileCheck,   color: '#94a3b8' },
}

const DEMO = [
  { id:'EVD-2024-00068', filename:'Autopsy_Report_001.pdf',  evidence_type:'autopsy',    source:'Forensic Lab',       collected_by:'Dr. Marcus Chen',   uploaded_at:'2024-05-15T10:24:00Z', size_bytes:2516582, sha256:'a1b2c3d4e5f67890', integrity:'verified',   confidence:98, status:'Active' },
  { id:'EVD-2024-00069', filename:'CCTV_FrontGate_01.mp4',   evidence_type:'cctv',       source:'CCTV Camera 01',     collected_by:'Det. John Carter',  uploaded_at:'2024-05-15T09:11:00Z', size_bytes:268959744,sha256:'b2c3d4e5f6789012',integrity:'verified',   confidence:95, status:'Active' },
  { id:'EVD-2024-00070', filename:'CCTV_Warehouse_02.mp4',   evidence_type:'cctv',       source:'CCTV Camera 05',     collected_by:'Det. Mike Brown',   uploaded_at:'2024-05-15T09:45:00Z', size_bytes:197132288,sha256:'c3d4e5f678901234',integrity:'verified',   confidence:91, status:'Active' },
  { id:'EVD-2024-00071', filename:'Call_Logs_Suspect1.zip',  evidence_type:'calls',      source:'Mobile Extraction',  collected_by:'Lab Technician',    uploaded_at:'2024-05-15T12:50:00Z', size_bytes:19660800, sha256:'d4e5f67890123456',integrity:'verified',   confidence:97, status:'Active' },
  { id:'EVD-2024-00072', filename:'Location_Trace.kml',      evidence_type:'location',   source:'Mobile Extraction',  collected_by:'Lab Technician',    uploaded_at:'2024-05-15T12:50:00Z', size_bytes:4404224,  sha256:'e5f6789012345678',integrity:'verified',   confidence:86, status:'Active' },
  { id:'EVD-2024-00073', filename:'Toxicology_Report.pdf',   evidence_type:'toxicology', source:'Forensic Lab',       collected_by:'Dr. Elena Vasquez', uploaded_at:'2024-05-15T13:09:00Z', size_bytes:1153434,  sha256:'f6789012345678ab',integrity:'verified',   confidence:94, status:'Active' },
  { id:'EVD-2024-00074', filename:'Weapon_Swab_01.jpg',      evidence_type:'physical',   source:'Crime Scene Unit',   collected_by:'CSI Team',          uploaded_at:'2024-05-15T10:15:00Z', size_bytes:3774873,  sha256:'01234567890abcde',integrity:'verified',   confidence:99, status:'Active' },
  { id:'EVD-2024-00075', filename:'Blood_Sample_01.jpg',     evidence_type:'physical',   source:'Crime Scene Unit',   collected_by:'CSI Team',          uploaded_at:'2024-05-15T10:16:00Z', size_bytes:3041894,  sha256:'12345678901abcde',integrity:'verified',   confidence:91, status:'Active' },
  { id:'EVD-2024-00076', filename:'Smartwatch_Data.json',    evidence_type:'iot',        source:'Device Extraction',  collected_by:'Digital Forensics', uploaded_at:'2024-05-15T11:35:00Z', size_bytes:13004800, sha256:'234c5d6e7f890a1b',integrity:'verified',   confidence:92, status:'Active' },
  { id:'EVD-2024-00077', filename:'Email_Thread.eml',        evidence_type:'comms',      source:'Device Extraction',  collected_by:'Digital Forensics', uploaded_at:'2024-05-15T11:40:00Z', size_bytes:1782579,  sha256:'345d6e7f8901b2c3',integrity:'verified',   confidence:88, status:'Active' },
  { id:'EVD-2024-00078', filename:'Phone_Records_S2.pdf',    evidence_type:'calls',      source:'Carrier Subpoena',   collected_by:'Det. Sarah Mitchell',uploaded_at:'2024-05-15T14:00:00Z', size_bytes:892928,   sha256:'456e7f8901c2d3e4',integrity:'in_transit', confidence:90, status:'Active' },
  { id:'EVD-2024-00079', filename:'GPS_Route_Nov14.gpx',     evidence_type:'location',   source:'Mobile Extraction',  collected_by:'Lab Technician',    uploaded_at:'2024-05-15T14:20:00Z', size_bytes:524288,   sha256:'567f890123d4e5f6',integrity:'verified',   confidence:93, status:'Active' },
  { id:'EVD-2024-00080', filename:'CCTV_ParkingLot.mp4',     evidence_type:'cctv',       source:'CCTV Camera 03',     collected_by:'Det. John Carter',  uploaded_at:'2024-05-15T15:00:00Z', size_bytes:314572800,sha256:'6789012345e6f7a8',integrity:'compromised', confidence:72, status:'Active' },
  { id:'EVD-2024-00081', filename:'IoT_Sensor_Log.csv',      evidence_type:'iot',        source:'Building Management',collected_by:'Digital Forensics', uploaded_at:'2024-05-15T15:30:00Z', size_bytes:2097152,  sha256:'789012345678f9ab',integrity:'verified',   confidence:85, status:'Active' },
  { id:'EVD-2024-00082', filename:'Financial_Records.xlsx',  evidence_type:'document',   source:'Bank Subpoena',      collected_by:'Det. Sarah Mitchell',uploaded_at:'2024-05-15T16:00:00Z', size_bytes:3145728,  sha256:'89abcdef01234567',integrity:'verified',   confidence:96, status:'Active' },
]

const RECENT = [
  { text:'CCTV_Warehouse_03.mp4 uploaded',    time:'2m ago'  },
  { text:'Toxicology_Report.pdf verified',     time:'8m ago'  },
  { text:'Call_Logs_Suspect2.zip uploaded',    time:'15m ago' },
  { text:'Smartwatch_Data.json verified',      time:'18m ago' },
  { text:'Email_Thread.eml extracted',         time:'22m ago' },
]

const PAGE_SIZE = 10

function fmtSize(b) {
  if (b >= 1073741824) return (b/1073741824).toFixed(1)+' GB'
  if (b >= 1048576)    return (b/1048576).toFixed(1)+' MB'
  return (b/1024).toFixed(1)+' KB'
}
function fmtDate(s) {
  return new Date(s).toLocaleString('en-US',{month:'short',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
}

const INTEGRITY_COLOR = { verified:'#10b981', in_transit:'#f59e0b', compromised:'#ef4444', unknown:'#64748b' }

export default function EvidenceView({ caseId }) {
  const { openUpload } = useForensicStore()
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading]   = useState(true)
  const [searchQ, setSearchQ]   = useState('')
  const [page, setPage]         = useState(1)

  useEffect(() => {
    if (!caseId) return
    setLoading(true)
    api.listEvidence(caseId)
      .then(data => {
        const rows = data?.evidence || []
        setEvidence(rows.length > 0 ? rows : DEMO)
      })
      .catch(() => setEvidence(DEMO))
      .finally(() => setLoading(false))
  }, [caseId])

  const filtered = evidence.filter(e =>
    !searchQ || e.filename?.toLowerCase().includes(searchQ.toLowerCase()) ||
    e.evidence_type?.toLowerCase().includes(searchQ.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Sidebar stats
  const byType = evidence.reduce((a, e) => { a[e.evidence_type] = (a[e.evidence_type]||0)+1; return a }, {})
  const totalGB = evidence.reduce((a,e) => a + (e.size_bytes||0), 0) / 1073741824
  const intStats = { verified:0, in_transit:0, compromised:0, unknown:0 }
  evidence.forEach(e => { const k = e.integrity||'unknown'; if(intStats[k]!==undefined) intStats[k]++ })

  const C = { bg:'rgba(4,8,18,0.95)', card:'rgba(7,14,32,0.9)', border:'rgba(0,212,255,0.08)', cyan:'#00d4ff' }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: C.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom:`1px solid ${C.border}` }}>
        <div>
          <div className="text-[13px] font-bold text-slate-100">Evidence Management</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{evidence.length} items · Case {caseId}</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={searchQ} onChange={e=>{setSearchQ(e.target.value);setPage(1)}}
              placeholder="Search evidence..."
              className="h-8 pl-8 pr-3 rounded-lg text-[11px] outline-none"
              style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:'#94a3b8', width:180 }} />
          </div>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px]"
            style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, color:'#64748b' }}>
            <Filter size={11}/> Filters
          </button>
          <button onClick={openUpload}
            className="flex items-center gap-2 h-8 px-4 rounded-xl text-[11px] font-semibold"
            style={{ background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.25)', color: C.cyan }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(0,212,255,0.18)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(0,212,255,0.1)'}>
            <Upload size={12}/> Upload Evidence
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Table */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3">
              <div className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{ borderColor: C.cyan, borderTopColor:'transparent' }}/>
              <span className="text-[12px] text-slate-500">Loading evidence…</span>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom:`1px solid rgba(255,255,255,0.05)` }}>
                    {['Evidence ID','Name','Type','Source','Collected On','Collected By','Size','Hash (SHA-256)','Integrity','Confidence','Status','Actions'].map(h => (
                      <th key={h} className="pb-2 pr-3 text-[9px] uppercase tracking-wider font-semibold"
                        style={{ color:'#475569', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((ev, i) => {
                    const tm = TYPE_META[ev.evidence_type] || TYPE_META.document
                    const Icon = tm.icon
                    const intColor = INTEGRITY_COLOR[ev.integrity||'unknown']
                    return (
                      <tr key={ev.id||i}
                        className="transition-colors hover:bg-white/[0.02] cursor-pointer"
                        style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                        <td className="py-2.5 pr-3">
                          <span className="text-[9px] font-mono" style={{ color: C.cyan }}>{ev.id}</span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="text-[11px] text-slate-200 font-medium" style={{ whiteSpace:'nowrap' }}>
                            {ev.filename || ev.file_name || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full w-fit"
                            style={{ background:`${tm.color}15`, border:`1px solid ${tm.color}30` }}>
                            <Icon size={9} style={{ color: tm.color }}/>
                            <span className="text-[9px] font-medium" style={{ color: tm.color, whiteSpace:'nowrap' }}>{tm.label}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-[10px] text-slate-400" style={{ whiteSpace:'nowrap' }}>{ev.source||'Forensic Lab'}</td>
                        <td className="py-2.5 pr-3 text-[10px] text-slate-400 font-mono" style={{ whiteSpace:'nowrap' }}>
                          {ev.uploaded_at ? fmtDate(ev.uploaded_at) : '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-[10px] text-slate-400" style={{ whiteSpace:'nowrap' }}>{ev.collected_by||ev.uploader||'Investigator'}</td>
                        <td className="py-2.5 pr-3 text-[10px] text-slate-400 font-mono" style={{ whiteSpace:'nowrap' }}>
                          {ev.size_bytes ? fmtSize(ev.size_bytes) : ev.file_size ? fmtSize(ev.file_size*1024) : '—'}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="text-[9px] font-mono text-slate-600">
                            {ev.sha256 ? ev.sha256.slice(0,14)+'…' : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: intColor }}/>
                            <span className="text-[9px] capitalize" style={{ color: intColor }}>
                              {(ev.integrity||'unknown').replace('_',' ')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1">
                            <div className="h-1 w-12 rounded-full" style={{ background:'rgba(255,255,255,0.08)' }}>
                              <div className="h-full rounded-full" style={{ width:`${ev.confidence||90}%`, background: C.cyan }}/>
                            </div>
                            <span className="text-[9px] font-mono" style={{ color: C.cyan }}>{ev.confidence||90}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="px-2 py-0.5 rounded text-[9px] font-semibold"
                            style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', color:'#10b981' }}>
                            {ev.status||'Active'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1">
                            <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5"
                              title="Preview"><Eye size={11} className="text-slate-500"/></button>
                            <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5"
                              title="Download"><Download size={11} className="text-slate-500"/></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-3"
                style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] text-slate-500">
                  Showing {(page-1)*PAGE_SIZE+1} to {Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length} items
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5 disabled:opacity-30">
                    <ChevronLeft size={13} className="text-slate-400"/>
                  </button>
                  {Array.from({length:totalPages},(_,i)=>i+1).slice(
                    Math.max(0,page-3), Math.min(totalPages,page+2)
                  ).map(p => (
                    <button key={p} onClick={()=>setPage(p)}
                      className="w-7 h-7 rounded text-[10px] font-mono transition-colors"
                      style={{
                        background: p===page ? 'rgba(0,212,255,0.15)' : 'transparent',
                        color: p===page ? C.cyan : '#64748b',
                        border: p===page ? `1px solid rgba(0,212,255,0.3)` : '1px solid transparent',
                      }}>{p}</button>
                  ))}
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5 disabled:opacity-30">
                    <ChevronRight size={13} className="text-slate-400"/>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 overflow-y-auto px-4 py-3 space-y-5"
          style={{ borderLeft:`1px solid ${C.border}` }}>

          {/* Summary donut */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Summary</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8"/>
                  {(() => {
                    const total = evidence.length || 1
                    const types = Object.entries(byType)
                    const colors = ['#ef4444','#00d4ff','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316']
                    let offset = 0
                    const circ = 2*Math.PI*24
                    return types.map(([,count],i) => {
                      const dash = (count/total)*circ
                      const el = <circle key={i} cx="32" cy="32" r="24" fill="none"
                        stroke={colors[i%colors.length]} strokeWidth="8"
                        strokeDasharray={`${dash} ${circ-dash}`}
                        strokeDashoffset={-offset} transform="rotate(-90 32 32)"/>
                      offset += dash
                      return el
                    })
                  })()}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-[14px] font-black text-slate-100">{evidence.length}</div>
                    <div className="text-[8px] text-slate-500">Total</div>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                {Object.entries(byType).slice(0,5).map(([type,count],i) => {
                  const tm = TYPE_META[type]||TYPE_META.document
                  const pct = ((count/evidence.length)*100).toFixed(1)
                  return (
                    <div key={type} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tm.color }}/>
                      <span className="text-[9px] text-slate-400 flex-1 truncate">{tm.label}</span>
                      <span className="text-[9px] font-mono" style={{ color: tm.color }}>{count} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Integrity Status */}
          <div style={{ borderTop:`1px solid rgba(255,255,255,0.04)`, paddingTop:12 }}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Integrity Status</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key:'verified',   label:'Verified',    Icon: Shield,        bg:'rgba(16,185,129,0.1)',  border:'rgba(16,185,129,0.2)',  c:'#10b981' },
                { key:'in_transit', label:'In Transit',  Icon: Clock,         bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.2)',  c:'#f59e0b' },
                { key:'compromised',label:'Compromised', Icon: AlertTriangle, bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.2)',   c:'#ef4444' },
                { key:'unknown',    label:'Unknown',     Icon: FileCheck,     bg:'rgba(100,116,139,0.1)',border:'rgba(100,116,139,0.2)', c:'#64748b' },
              ].map(({ key, label, Icon, bg, border, c }) => (
                <div key={key} className="rounded-lg p-2 text-center"
                  style={{ background: bg, border:`1px solid ${border}` }}>
                  <Icon size={12} style={{ color: c, margin:'0 auto 2px' }}/>
                  <div className="text-[13px] font-black" style={{ color: c }}>{intStats[key]}</div>
                  <div className="text-[8px]" style={{ color: c, opacity:0.8 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Storage */}
          <div style={{ borderTop:`1px solid rgba(255,255,255,0.04)`, paddingTop:12 }}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Storage Usage</div>
            <div className="h-1.5 rounded-full" style={{ background:'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width:`${Math.min(100,(totalGB/10)*100).toFixed(1)}%`, background: C.cyan }}/>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-mono" style={{ color: C.cyan }}>{totalGB.toFixed(2)} GB</span>
              <span className="text-[9px] text-slate-600">/ 10.00 GB</span>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ borderTop:`1px solid rgba(255,255,255,0.04)`, paddingTop:12 }}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Recent Activity</div>
            <div className="space-y-2">
              {RECENT.map((r,i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: C.cyan }}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-slate-300 leading-snug">{r.text}</div>
                    <div className="text-[9px] text-slate-600">{r.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
              style={{ background:'rgba(0,212,255,0.06)', border:`1px solid ${C.border}`, color: C.cyan }}>
              View All Activity
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
