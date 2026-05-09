import { useState } from 'react'
import { X, CheckCircle, XCircle, Tag, MessageSquare, Loader } from 'lucide-react'
import { useForensicStore } from '../../lib/store'

const ACTIONS = [
  { id: 'approve',  label: 'Approve Finding', color: '#10b981', icon: CheckCircle },
  { id: 'reject',   label: 'Reject Finding',  color: '#ef4444', icon: XCircle },
  { id: 'tag',      label: 'Tag Evidence',     color: '#f59e0b', icon: Tag },
  { id: 'annotate', label: 'Add Annotation',   color: '#8b5cf6', icon: MessageSquare },
]

const PRESET_TAGS = ['key-evidence','needs-verification','chain-broken','corroborated','disputed','flagged']

export default function ReviewModal() {
  const { ui, closeReview, submitReview } = useForensicStore()
  const [action, setAction] = useState('approve')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!ui.reviewOpen) return null
  const target = ui.reviewTarget || {}

  const toggleTag = (t) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await submitReview({
        action,
        target_type: target.type || 'finding',
        target_id:   target.id || null,
        note:        note || null,
        tags,
      })
      setDone(true)
    } catch (e) {
      console.error('[Review]', e)
    } finally {
      setLoading(false)
    }
  }

  const selectedAction = ACTIONS.find(a => a.id === action)
  const Icon = selectedAction.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && closeReview()}>
      <div className="w-[440px] rounded-2xl overflow-hidden"
        style={{ background: 'rgba(7,12,26,0.98)', border: '1px solid rgba(139,92,246,0.15)',
                 boxShadow: '0 25px 60px rgba(0,0,0,0.65), 0 0 30px rgba(139,92,246,0.08)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
          <div className="text-[13px] font-bold text-slate-100">Human Review</div>
          <button onClick={closeReview} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#10b981' }} />
            <div className="text-[14px] font-bold text-slate-100 mb-1">Review Submitted</div>
            <div className="text-[11px] text-slate-500">Persisted to audit trail with timestamp.</div>
            <button onClick={closeReview} className="mt-5 px-6 py-2 rounded-xl text-[11px] font-semibold text-slate-300 hover:text-white transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Close</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Target info */}
            {target.name && (
              <div className="px-3 py-2 rounded-xl text-[11px] text-slate-400"
                style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                Reviewing: <strong className="text-slate-200">{target.name}</strong>
              </div>
            )}

            {/* Action selector */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Review Action</div>
              <div className="grid grid-cols-2 gap-2">
                {ACTIONS.map(a => {
                  const AIcon = a.icon
                  const active = action === a.id
                  return (
                    <button key={a.id} onClick={() => setAction(a.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all"
                      style={{
                        background: active ? `${a.color}14` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${active ? a.color + '40' : 'rgba(255,255,255,0.06)'}`,
                        color: active ? a.color : '#475569',
                      }}>
                      <AIcon size={12} /> {a.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAGS.map(t => (
                  <button key={t} onClick={() => toggleTag(t)}
                    className="px-2 py-1 rounded-lg text-[9px] font-medium transition-all"
                    style={{
                      background: tags.includes(t) ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${tags.includes(t) ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      color: tags.includes(t) ? '#67e8f9' : '#475569',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Investigator Note</div>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Add your annotation or reasoning…"
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-[11px] text-slate-300 placeholder-slate-600 resize-none outline-none transition-colors"
                style={{ background: 'rgba(15,25,50,0.8)', border: '1px solid rgba(139,92,246,0.12)' }} />
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={loading}
              className="w-full h-10 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all"
              style={{
                background: `${selectedAction.color}18`,
                border: `1px solid ${selectedAction.color}40`,
                color: selectedAction.color,
              }}>
              {loading ? <Loader size={13} className="animate-spin" /> : <Icon size={13} />}
              {loading ? 'Submitting…' : `Submit: ${selectedAction.label}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
