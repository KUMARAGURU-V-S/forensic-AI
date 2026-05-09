/**
 * SHAP Explainability horizontal bar chart (pure SVG – no recharts overhead)
 */
export default function SHAPChart({ data = [] }) {
  if (!data.length) return null
  const maxVal = Math.max(...data.map(d => Math.abs(d.impact || d.value || 0)), 0.01)

  const colors = {
    positive: '#ef4444',   // red → increases risk
    negative: '#10b981',   // green → decreases risk
  }

  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const val = item.impact ?? item.value ?? 0
        const pct = Math.abs(val) / maxVal
        const isPositive = val >= 0
        const barColor = isPositive ? colors.positive : colors.negative
        const label = item.factor || item.feature || item.name || `Factor ${i+1}`
        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{label}</span>
              <span className="text-[10px] font-mono" style={{ color: barColor }}>
                {isPositive ? '+' : ''}{val.toFixed(2)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct * 100}%`,
                  background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                  boxShadow: `0 0 6px ${barColor}66`,
                  transitionDelay: `${i * 60}ms`,
                }}
              />
            </div>
          </div>
        )
      })}
      <div className="flex justify-between pt-1 border-t border-white/5">
        <span className="text-[9px] text-slate-500">← Decreases Risk</span>
        <span className="text-[9px] text-slate-500">Increases Risk →</span>
      </div>
    </div>
  )
}
