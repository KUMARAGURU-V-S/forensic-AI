import { useState } from 'react'
import { X, Download, FileText, Shield, CheckCircle, Loader } from 'lucide-react'
import { useForensicStore } from '../../lib/store'
import { api } from '../../lib/api'

const EXPORTS = [
  {
    id: 'report', label: 'Full Investigation Report',
    desc: 'HTML report with timeline, AI summary, risk score, suspects, and chain-of-custody.',
    icon: FileText, color: '#00d4ff',
    getUrl: (id) => api.getReportUrl(id),
    filename: (id) => `report_${id}.html`,
  },
  {
    id: 'manifest', label: 'Evidence Manifest (CSV)',
    desc: 'All uploaded evidence with SHA-256 hashes, timestamps, uploader, and status.',
    icon: Download, color: '#10b981',
    getUrl: (id) => api.getManifestUrl(id),
    filename: (id) => `manifest_${id}.csv`,
  },
  {
    id: 'custody', label: 'Chain-of-Custody Certificate',
    desc: 'Signed JSON certificate containing the SHA-256 hash chain for all evidence blocks.',
    icon: Shield, color: '#8b5cf6',
    getUrl: (id) => api.getCustodyUrl(id),
    filename: (id) => `custody_${id}.json`,
  },
]

export default function ExportModal() {
  const { caseId, ui, closeExport } = useForensicStore()
  const [downloading, setDownloading] = useState(null)
  const [done, setDone] = useState({})

  if (!ui.exportOpen) return null

  const handleDownload = (exp) => {
    setDownloading(exp.id)
    const a = document.createElement('a')
    a.href = exp.getUrl(caseId)
    a.download = exp.filename(caseId)
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => {
      setDownloading(null)
      setDone(d => ({ ...d, [exp.id]: true }))
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && closeExport()}>
      <div className="w-[480px] rounded-2xl overflow-hidden"
        style={{ background: 'rgba(7,12,26,0.98)', border: '1px solid rgba(0,212,255,0.12)',
                 boxShadow: '0 25px 60px rgba(0,0,0,0.65)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
          <div className="text-[13px] font-bold text-slate-100 flex items-center gap-2">
            <Download size={14} className="text-cyan-400" /> Export Case Data
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-600">{caseId}</span>
            <button onClick={closeExport} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
              <X size={14} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Export options */}
        <div className="p-5 space-y-3">
          {EXPORTS.map(exp => {
            const Icon = exp.icon
            const isDone = done[exp.id]
            const isLoading = downloading === exp.id
            return (
              <div key={exp.id} className="flex items-center gap-4 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${exp.color}12`, border: `1px solid ${exp.color}30` }}>
                  <Icon size={18} style={{ color: exp.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-slate-200">{exp.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{exp.desc}</div>
                </div>
                <button
                  onClick={() => handleDownload(exp)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold flex-shrink-0 transition-all"
                  style={{
                    background: isDone ? 'rgba(16,185,129,0.12)' : `${exp.color}12`,
                    border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : exp.color + '30'}`,
                    color: isDone ? '#10b981' : exp.color,
                  }}>
                  {isLoading  ? <Loader size={10} className="animate-spin" /> :
                   isDone     ? <CheckCircle size={10} /> : <Download size={10} />}
                  {isLoading ? 'Generating…' : isDone ? 'Done' : 'Download'}
                </button>
              </div>
            )
          })}
        </div>

        <div className="px-5 pb-5 text-center text-[10px] text-slate-600">
          All exports are logged in the audit trail for chain-of-custody integrity.
        </div>
      </div>
    </div>
  )
}
