import { useState } from 'react'
import {
  FileText, Video, Smartphone, Phone, MapPin,
  FlaskConical, Cpu, FileCheck, Plus, Filter, ChevronDown,
} from 'lucide-react'
import { useForensicStore } from '../../lib/store'

const SOURCES = [
  { id: 'autopsy',    label: 'Autopsy Report',    icon: FileText,   color: '#ef4444', countKey: 'autopsy' },
  { id: 'cctv',       label: 'CCTV Footage',      icon: Video,      color: '#00d4ff', countKey: 'cctv' },
  { id: 'mobile',     label: 'Mobile Devices',    icon: Smartphone, color: '#10b981', countKey: 'mobile' },
  { id: 'calls',      label: 'Call Logs',         icon: Phone,      color: '#f59e0b', countKey: 'calls' },
  { id: 'location',   label: 'Location Data',     icon: MapPin,     color: '#8b5cf6', countKey: 'location' },
  { id: 'toxicology', label: 'Toxicology Reports',icon: FlaskConical,color: '#ec4899',countKey: 'toxicology' },
  { id: 'iot',        label: 'IoT Sensor Data',   icon: Cpu,        color: '#06b6d4', countKey: 'iot' },
  { id: 'docs',       label: 'Other Documents',   icon: FileCheck,  color: '#94a3b8', countKey: 'docs' },
]

const TIME_RANGES    = ['All Time','Last 6 hours','Last 24 hours','Last 7 days','Custom Range']
const EVIDENCE_TYPES = ['All Types','CCTV','Phone','IoT','Biometric','Location','Autopsy']
const CONFIDENCE_LEVELS = ['All','High (>90%)','Medium (70-90%)','Low (<70%)']
const ANOMALY_LEVELS    = ['All','Critical','High','Medium','Low']

export default function EvidenceSidebar() {
  const { caseData, activeSource, filters, setActiveSource, applyFilters, openUpload } = useForensicStore()
  const [localFilters, setLocalFilters] = useState({ ...filters })

  const updateFilter = (key, val) => setLocalFilters(f => ({ ...f, [key]: val }))

  const handleApplyFilters = () => applyFilters(localFilters)

  const handleClearFilters = () => {
    const reset = { timeRange: 'All Time', evidenceType: 'All Types', confidence: 'All', anomalyLevel: 'All' }
    setLocalFilters(reset)
    applyFilters(reset)
  }

  const priority   = caseData?.priority || 'medium'
  const riskBadge  = ({
    critical: { label: 'CRITICAL', bg: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'rgba(239,68,68,0.3)' },
    high:     { label: 'HIGH',     bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    medium:   { label: 'MEDIUM',   bg: 'rgba(0,212,255,0.1)',   color: '#00d4ff', border: 'rgba(0,212,255,0.25)' },
  })[priority] || { label: priority.toUpperCase(), bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: 'rgba(148,163,184,0.2)' }

  const fmt = (iso) => iso
    ? new Date(iso).toLocaleString('en-US', { month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false })
    : '—'

  // Real evidence counts from caseData
  const de = caseData?.digital_evidence || {}
  const evCounts = {
    autopsy:    caseData?.autopsy_report ? 1 : 0,
    cctv:       de.cctv?.length || 0,
    mobile:     de.smartwatch_data ? 1 : 0,
    calls:      de.phone_metadata?.length || 0,
    location:   de.gps_data?.length || 0,
    toxicology: caseData?.autopsy_report?.toxicology?.findings?.length || 0,
    iot:        de.iot_sensors?.length || 0,
    docs:       0,
  }
  const totalItems = Object.values(evCounts).reduce((a, b) => a + b, 0)

  const Select = ({ label, options, value, onChange }) => (
    <div className="relative">
      <label className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 block">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full h-7 pl-2.5 pr-7 rounded text-[10px] appearance-none cursor-pointer outline-none transition-colors"
          style={{ background: 'rgba(15,29,56,0.8)', border: '1px solid rgba(0,212,255,0.1)', color: '#94a3b8' }}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full scroll-panel flex-shrink-0"
      style={{ width: 268, background: 'rgba(5,10,20,0.9)', borderRight: '1px solid rgba(0,212,255,0.08)' }}>

      {/* ── Case Summary ─────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Case Summary</span>
          {/* + button now opens upload modal */}
          <button id="upload-evidence-btn" onClick={openUpload}
            title="Upload Evidence"
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-cyan-500/10 transition-colors"
            style={{ border: '1px solid rgba(0,212,255,0.15)' }}>
            <Plus size={11} style={{ color: '#00d4ff' }} />
          </button>
        </div>
        <div className="space-y-1.5">
          <Row label="Case Type" value={caseData?.classification || '—'} />
          <Row label="Assigned To" value={caseData?.lead_investigator || '—'} />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Risk Level</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded"
              style={{ background: riskBadge.bg, color: riskBadge.color, border: `1px solid ${riskBadge.border}` }}>
              {riskBadge.label}
            </span>
          </div>
          <Row label="Created" value={fmt(caseData?.created_at)} mono />
          <Row label="Updated" value={fmt(caseData?.updated_at)} mono />
        </div>
      </div>

      {/* ── Evidence Sources ─────────────────────────────── */}
      <div className="px-3 pt-2 pb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Evidence Sources</span>
          <span className="text-[9px] font-mono text-slate-500">{totalItems} items</span>
        </div>
        <div className="space-y-0.5">
          {SOURCES.map(src => {
            const Icon = src.icon
            const count = evCounts[src.countKey] || 0
            const isActive = activeSource === src.id
            return (
              <button key={src.id} id={`src-${src.id}`}
                onClick={() => setActiveSource(src.id)}
                className="w-full text-left rounded-md transition-colors"
                style={{ background: isActive ? `${src.color}12` : 'transparent' }}>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Icon size={12} style={{ color: src.color, flexShrink: 0 }} />
                  <span className="text-[11px] text-slate-300 flex-1 truncate">{src.label}</span>
                  <span className="text-[9px] font-mono" style={{ color: src.color }}>{count}</span>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: count > 0 ? src.color : '#334155' }} />
                </div>
                <div className="mx-2 h-px rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: count > 0 ? '100%' : '0%', background: src.color, opacity: 0.6 }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="px-3 pt-2 pb-3 mt-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Filters</span>
          <button className="text-[9px] text-slate-500 hover:text-slate-300 transition-colors"
            onClick={handleClearFilters}>Clear All</button>
        </div>
        <div className="space-y-2">
          <Select label="Time Range"    options={TIME_RANGES}       value={localFilters.timeRange}    onChange={v => updateFilter('timeRange', v)} />
          <Select label="Evidence Type" options={EVIDENCE_TYPES}    value={localFilters.evidenceType} onChange={v => updateFilter('evidenceType', v)} />
          <Select label="Confidence"    options={CONFIDENCE_LEVELS} value={localFilters.confidence}   onChange={v => updateFilter('confidence', v)} />
          <Select label="Anomaly Level" options={ANOMALY_LEVELS}    value={localFilters.anomalyLevel} onChange={v => updateFilter('anomalyLevel', v)} />
        </div>
        <button id="apply-filters-btn"
          className="mt-3 w-full h-8 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 transition-all"
          style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', color: '#00d4ff' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.18)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,255,0.2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
          onClick={handleApplyFilters}>
          <Filter size={11} /> Apply Filters
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-[10px] text-slate-300 truncate text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
