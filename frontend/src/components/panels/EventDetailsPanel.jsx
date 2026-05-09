import { FileText, MapPin, Camera, Clock, Database } from 'lucide-react'

export default function EventDetailsPanel({ event }) {
  if (!event) return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <Clock size={22} className="text-slate-600 mb-2" />
      <p className="text-[11px] text-slate-600">Select a timeline event<br />to view details</p>
    </div>
  )

  const detectedObj = event.type === 'cctv' ? 'Firearm' : null
  const confPct = Math.round((event.confidence || 0.9) * 100)

  const fmt = (ts) => ts ? new Date(ts).toLocaleString('en-US',{
    month:'short', day:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false,
  }) : '—'

  const Row = ({ label, val, children }) => (
    <div className="flex items-start justify-between gap-2 py-1.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[10px] text-slate-500 flex-shrink-0">{label}</span>
      {children || <span className="text-[10px] text-slate-300 text-right font-mono">{val}</span>}
    </div>
  )

  return (
    <div className="flex flex-col h-full px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Event Details</span>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded"
          style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
          <div className="w-1 h-1 rounded-full" style={{ background: '#00d4ff' }} />
          <span className="text-[8px] font-bold" style={{ color: '#00d4ff' }}>
            {confPct >= 90 ? 'HIGH' : confPct >= 70 ? 'MEDIUM' : 'LOW'} CONFIDENCE
          </span>
        </div>
      </div>

      <div className="text-[12px] font-semibold text-slate-100 mb-2 leading-tight">{event.title}</div>

      <Row label="Time"     val={fmt(event.timestamp)} />
      <Row label="Source"   val={event.source || '—'} />
      <Row label="Location" val={event.description?.split('|')[0]?.trim() || '—'} />
      <Row label="Category" val={event.category || event.type || '—'} />
      {detectedObj && (
        <Row label="Detected Object">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded badge-red">{detectedObj}</span>
        </Row>
      )}
      <Row label="Confidence" val={`${confPct}%`} />
      <Row label="Analyst"   val="AI Model (YOLOv8)" />

      <button id="view-full-metadata-btn"
        className="mt-auto w-full h-8 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5"
        style={{ background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.13)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,212,255,0.07)'}
      >
        <Database size={11} />
        View Full Metadata
      </button>
    </div>
  )
}
