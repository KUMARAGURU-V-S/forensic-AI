const ROLE_COLORS = {
  Suspect: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#f87171' },
  Victim:  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24' },
  Witness: { bg: 'rgba(0,212,255,0.1)',   border: 'rgba(0,212,255,0.25)', text: '#00d4ff' },
}

export default function SuspectCard({ name, role = 'Suspect', confidence = 0, id, onValidate, onVerify }) {
  const handleVerify = onVerify || onValidate
  const c = ROLE_COLORS[role] || ROLE_COLORS.Witness
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg glass-hover"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
        style={{ background: `${c.border}`, color: c.text }}>
        {initials}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-slate-200 truncate">{name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
            {role.toUpperCase()}
          </span>
          <span className="text-[9px] font-mono text-slate-400">{confidence}% conf.</span>
        </div>
      </div>
      {/* Validate btn */}
      {handleVerify && (
        <button
          onClick={() => handleVerify(id)}
          className="text-[9px] px-2 py-1 rounded border transition-colors"
          style={{ borderColor: c.border, color: c.text }}
          onMouseEnter={e => e.currentTarget.style.background = c.bg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          VERIFY
        </button>
      )}
    </div>
  )
}
