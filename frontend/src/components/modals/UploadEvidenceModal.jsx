import { useState, useRef } from 'react'
import { X, Upload, FileText, Video, Smartphone, Phone, MapPin, FlaskConical, Cpu, FileCheck, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { useForensicStore } from '../../lib/store'

const TYPES = [
  { id: 'autopsy',    label: 'Autopsy Report',    icon: FileText,   accept: '.pdf,.txt,.docx', color: '#ef4444' },
  { id: 'cctv',       label: 'CCTV Metadata',     icon: Video,      accept: '.json,.csv,.txt', color: '#00d4ff' },
  { id: 'mobile',     label: 'Mobile / Biometric',icon: Smartphone, accept: '.json,.csv',      color: '#10b981' },
  { id: 'calls',      label: 'Call Logs',          icon: Phone,      accept: '.csv,.json,.txt', color: '#f59e0b' },
  { id: 'location',   label: 'Location / GPS',     icon: MapPin,     accept: '.json,.csv,.kml', color: '#8b5cf6' },
  { id: 'toxicology', label: 'Toxicology Report',  icon: FlaskConical,accept:'.pdf,.txt',       color: '#ec4899' },
  { id: 'iot',        label: 'IoT Sensor Data',    icon: Cpu,        accept: '.json,.csv',      color: '#06b6d4' },
  { id: 'document',   label: 'Other Document',     icon: FileCheck,  accept: '*',               color: '#94a3b8' },
]

export default function UploadEvidenceModal() {
  const { caseId, ui, closeUpload, uploadEvidence } = useForensicStore()
  const [selectedType, setSelectedType] = useState(TYPES[0])
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  if (!ui.uploadOpen) return null

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setError(null); setResult(null)
    try {
      const res = await uploadEvidence(selectedType.id, file)
      setResult(res)
    } catch (e) {
      setError(e.message || 'Upload failed. Check backend connection.')
    }
  }

  const Icon = selectedType.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && closeUpload()}>
      <div className="w-[520px] rounded-2xl overflow-hidden"
        style={{ background: 'rgba(8,14,28,0.98)', border: '1px solid rgba(0,212,255,0.15)',
                 boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,212,255,0.08)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
          <div>
            <div className="text-[13px] font-bold text-slate-100">Upload Evidence</div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Case: {caseId}</div>
          </div>
          <button onClick={closeUpload} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Evidence Type Grid */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Evidence Type</div>
            <div className="grid grid-cols-4 gap-1.5">
              {TYPES.map(t => {
                const TIcon = t.icon
                const active = selectedType.id === t.id
                return (
                  <button key={t.id} onClick={() => setSelectedType(t)}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center"
                    style={{
                      background: active ? `${t.color}15` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${active ? t.color + '40' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    <TIcon size={14} style={{ color: active ? t.color : '#475569' }} />
                    <span className="text-[9px] leading-tight" style={{ color: active ? t.color : '#475569' }}>
                      {t.label.split(' ')[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="relative flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all"
            style={{
              height: 140,
              border: `2px dashed ${dragOver ? selectedType.color : 'rgba(0,212,255,0.12)'}`,
              background: dragOver ? `${selectedType.color}08` : 'rgba(0,0,0,0.2)',
            }}>
            <input ref={fileRef} type="file" className="hidden" accept={selectedType.accept}
              onChange={e => setFile(e.target.files[0])} />

            {file ? (
              <div className="text-center">
                <Icon size={28} style={{ color: selectedType.color, margin: '0 auto 8px' }} />
                <div className="text-[12px] font-semibold text-slate-200">{file.name}</div>
                <div className="text-[10px] text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB • {selectedType.label}</div>
              </div>
            ) : (
              <div className="text-center">
                <Upload size={28} className="mx-auto mb-2 text-slate-600" />
                <div className="text-[12px] text-slate-400">Drop file here or click to browse</div>
                <div className="text-[10px] text-slate-600 mt-1">Accepts: {selectedType.accept}</div>
              </div>
            )}
          </div>

          {/* Result / Error */}
          {result && (
            <div className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div className="text-[11px] font-semibold text-emerald-400">Upload successful</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {result.timeline_events_created} timeline events created · SHA-256: {result.sha256?.slice(0,16)}…
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              <div className="text-[11px] text-red-400">{error}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={closeUpload} className="flex-1 h-9 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button onClick={handleSubmit} disabled={!file || ui.uploading}
                className="flex-1 h-9 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: file && !ui.uploading ? `${selectedType.color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${file && !ui.uploading ? selectedType.color + '40' : 'rgba(255,255,255,0.06)'}`,
                  color: file && !ui.uploading ? selectedType.color : '#334155',
                }}>
                {ui.uploading ? <><Loader size={12} className="animate-spin" /> Processing…</> : <><Upload size={12} /> Upload & Ingest</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
