import { useState } from 'react'

const TABS = ['Objects','Text','Audio','Metadata']

const DEMO_OBJECTS = [
  { entity: 'Person',  count: 1, confidence: 98 },
  { entity: 'Firearm', count: 1, confidence: 95 },
  { entity: 'Vehicle', count: 0, confidence: null },
]
const DEMO_TEXT = ['Loading dock sign visible','Warning: restricted area','Timestamp: 2024-11-14']
const DEMO_METADATA = [
  ['Format',     'MP4 H.264'],
  ['Resolution', '1920×1080'],
  ['FPS',        '25.0'],
  ['Duration',   '00:10:32'],
  ['Camera',     'Hikvision DS-2CD2143'],
  ['Hash (SHA)', 'a3f92b…e44c'],
]

export default function ExtractedInfoPanel({ event }) {
  const [tab, setTab] = useState('Objects')

  return (
    <div className="flex flex-col h-full px-3 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Extracted Information</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-2 rounded overflow-hidden flex-shrink-0"
        style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-1 text-[9px] font-semibold transition-colors"
            style={{
              background: tab === t ? 'rgba(0,212,255,0.1)' : 'transparent',
              color: tab === t ? '#00d4ff' : '#475569',
              borderRight: t !== 'Metadata' ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'Objects' && (
          <div className="fade-up">
            <table className="w-full">
              <thead>
                <tr>
                  {['Entity','Count','Confidence'].map(h => (
                    <th key={h} className="text-left pb-1.5 text-[9px] text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEMO_OBJECTS.map((obj, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-1.5 text-[11px] text-slate-200">{obj.entity}</td>
                    <td className="py-1.5 text-[11px] font-mono" style={{ color: obj.count > 0 ? '#00d4ff' : '#475569' }}>{obj.count}</td>
                    <td className="py-1.5">
                      {obj.confidence ? (
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-12 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${obj.confidence}%`, background: obj.confidence >= 90 ? '#10b981' : '#f59e0b' }} />
                          </div>
                          <span className="text-[9px] font-mono text-slate-400">{obj.confidence}%</span>
                        </div>
                      ) : <span className="text-[9px] text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="text-[9px] text-slate-500 mb-1">Scene Description</div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                {event?.type === 'cctv'
                  ? 'A person holding a handgun in right hand walking towards the alley exit.'
                  : event?.description || 'Select a CCTV event to view scene description.'}
              </p>
            </div>
          </div>
        )}

        {tab === 'Text' && (
          <div className="fade-up space-y-1.5">
            {DEMO_TEXT.map((t, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded"
                style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.08)' }}>
                <span className="text-[9px] font-mono text-slate-500">OCR_{i+1}</span>
                <span className="text-[10px] text-slate-300">{t}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'Audio' && (
          <div className="fade-up text-center py-6">
            <div className="text-[11px] text-slate-500">No audio stream detected</div>
            <div className="text-[9px] text-slate-600 mt-1">CCTV source is video-only</div>
          </div>
        )}

        {tab === 'Metadata' && (
          <div className="fade-up space-y-0">
            {DEMO_METADATA.map(([label, val]) => (
              <div key={label} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] text-slate-500">{label}</span>
                <span className="text-[10px] font-mono text-slate-300">{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
