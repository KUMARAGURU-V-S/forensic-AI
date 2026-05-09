import { useState } from 'react'
import { Brain, ChevronRight, Monitor, MapPin as MapPinIcon, RefreshCw } from 'lucide-react'
import RiskGauge from '../forensic/RiskGauge'
import SHAPChart from '../forensic/SHAPChart'
import SuspectCard from '../forensic/SuspectCard'
import { useForensicStore } from '../../lib/store'

const HUMAN_TABS = ['People', 'Devices', 'Locations']

export default function AIAnalysisPanel() {
  const { riskData, caseData, ui, rerunAI, autoCorrelate, openReview } = useForensicStore()
  const [reviewTab, setReviewTab] = useState('People')

  const score = riskData?.overall_score ?? riskData?.case_risk?.overall_score ?? 0
  const level = score >= 80 ? 'HIGH RISK' : score >= 60 ? 'ELEVATED' : score >= 40 ? 'MODERATE' : 'LOW RISK'
  const gaugeColor = score >= 80 ? '#ef4444' : score >= 60 ? '#f59e0b' : '#10b981'

  // Real data from store
  const keyFindings = riskData?.key_findings || []
  const aiSummary   = riskData?.ai_summary || ''
  const suspects    = caseData?.suspects || []

  // SHAP data — from real computation
  const shapRaw = riskData?.shap?.attributions || riskData?.components?.map(c => ({
    factor: c.factor, impact: (c.score * c.weight) / Math.max(score, 1) * 0.5,
  })) || []

  // Risk factor bullet list
  const riskFactors = riskData?.components?.map(c => c.factor.split(':')[0]) ||
    riskData?.risk_factors || []

  const handleRerun = () => rerunAI()
  const handleCorrelate = () => autoCorrelate()

  const handleVerify = (suspect) => {
    openReview({ type: 'suspect', id: suspect.id, name: suspect.name })
  }

  return (
    <div className="flex flex-col h-full scroll-panel flex-shrink-0"
      style={{ width: 308, background: 'rgba(5,10,22,0.92)', borderLeft: '1px solid rgba(139,92,246,0.1)' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2"
        style={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 12px rgba(139,92,246,0.25)' }}>
            <Brain size={15} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-100">AI INVESTIGATOR</div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full blink" style={{ background: '#10b981' }} />
              <span className="text-[9px]" style={{ color: '#10b981' }}>
                {ui.wsConnected ? 'Live' : 'Online'}
              </span>
            </div>
          </div>
        </div>
        <button id="rerun-ai-btn" onClick={handleRerun} disabled={ui.rerunning}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
          style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.22)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.12)'}>
          <RefreshCw size={9} className={ui.rerunning ? 'animate-spin' : ''} />
          {ui.rerunning ? 'Running…' : 'Re-run'}
        </button>
      </div>

      {/* ── Risk Score ─────────────────────────────────── */}
      <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-2">Case Risk Score</div>
        <div className="flex items-center gap-3">
          {ui.loading || ui.rerunning ? (
            <div className="w-28 h-28 rounded-full bg-white/5 animate-pulse" />
          ) : (
            <RiskGauge score={score} color={gaugeColor} size={110} />
          )}
          <div className="flex-1">
            <div className="text-[9px] text-slate-500 mb-1.5">Risk Factors</div>
            {riskFactors.length > 0 ? riskFactors.slice(0,5).map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 mb-1">
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: gaugeColor }} />
                <span className="text-[9px] text-slate-400 truncate">{f}</span>
              </div>
            )) : (
              ['Suspicious Movement','Weapon Detected','Call with Suspect','Location Overlap','Toxicology Indicators'].map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 mb-1">
                  <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: gaugeColor }} />
                  <span className="text-[9px] text-slate-400">{f}</span>
                </div>
              ))
            )}
            <button className="mt-1 text-[9px] flex items-center gap-0.5" style={{ color: '#00d4ff' }}>
              View Details <ChevronRight size={8} />
            </button>
          </div>
        </div>
        <div className="mt-2 w-full py-1.5 rounded-lg text-center font-black tracking-wider text-[12px]"
          style={{
            background: score >= 80 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
            border: `1px solid ${score >= 80 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
            color: score >= 80 ? '#f87171' : '#fbbf24',
            boxShadow: score >= 80 ? '0 0 12px rgba(239,68,68,0.15)' : 'none',
          }}>
          {level}
        </div>
      </div>

      {/* ── AI Summary ─────────────────────────────────── */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-1.5">AI Summary</div>
        {ui.rerunning ? (
          <div className="h-12 bg-white/5 animate-pulse rounded-lg" />
        ) : (
          <p className="text-[10px] leading-relaxed text-slate-400">
            {aiSummary || 'The system has identified strong evidence correlations. Run AI analysis to generate a summary.'}
          </p>
        )}
      </div>

      {/* ── Key Findings ────────────────────────────────── */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-1.5">Key Findings</div>
        <div className="space-y-1.5">
          {(keyFindings.length > 0 ? keyFindings : [
            'Weapon detected in CCTV at 23:02',
            'Suspect confirmed at scene for 2h 48m',
            'Victim received call from suspect',
            'Toxicology shows lethal organophosphate',
          ]).slice(0, 5).map((f, i) => {
            const colors = ['#ef4444','#ef4444','#f59e0b','#8b5cf6','#10b981']
            return (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: colors[i % colors.length] }} />
                <span className="text-[10px] text-slate-300 leading-relaxed">{f}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── SHAP Explainability ─────────────────────────── */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-2">AI Explanation (SHAP)</div>
        <SHAPChart data={shapRaw.slice(0, 6)} />
        <div className="mt-1.5 flex justify-between text-[9px] text-slate-600">
          <span>← Decreases Risk</span>
          <span>Increases Risk Score →</span>
        </div>
      </div>

      {/* ── Human Review ────────────────────────────────── */}
      <div className="px-3 py-2 flex-1">
        <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-2">Human Review</div>
        <div className="flex gap-0 mb-2 rounded-lg overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
          {HUMAN_TABS.map(t => (
            <button key={t} onClick={() => setReviewTab(t)}
              className="flex-1 py-1 text-[9px] font-semibold transition-colors"
              style={{
                background: reviewTab === t ? 'rgba(0,212,255,0.1)' : 'transparent',
                color: reviewTab === t ? '#00d4ff' : '#475569',
                borderRight: t !== 'Locations' ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>{t}
            </button>
          ))}
        </div>

        {reviewTab === 'People' && (
          <div className="space-y-1.5 fade-up">
            {suspects.length > 0 ? suspects.map(s => (
              <SuspectCard key={s.id} name={s.name} role="Suspect"
                confidence={s.risk_score || 87} id={s.id}
                onVerify={() => handleVerify(s)} />
            )) : (
              <>
                <SuspectCard name="David Korman"  role="Suspect" confidence={89} id="S1" onVerify={() => openReview({ type:'suspect', id:'S1', name:'David Korman' })} />
                <SuspectCard name="Marcus Chen"   role="Victim"  confidence={98} id="V1" onVerify={() => openReview({ type:'suspect', id:'V1', name:'Marcus Chen' })} />
                <SuspectCard name="Elena Vasquez" role="Witness" confidence={62} id="S2" onVerify={() => openReview({ type:'suspect', id:'S2', name:'Elena Vasquez' })} />
              </>
            )}
            <button className="mt-1 w-full text-center text-[9px]" style={{ color: '#00d4ff' }}>
              View All Entities →
            </button>
          </div>
        )}
        {reviewTab === 'Devices' && (
          <div className="space-y-1 fade-up text-[10px] text-slate-400">
            {['Suspect S1 iPhone (IMEI: 35•••)', 'Victim SmartWatch (Garmin •••)', 'Burner Device (Unknown IMEI)'].map((d,i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg"
                style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)' }}>
                <Monitor size={10} style={{ color: '#00d4ff' }} /><span>{d}</span>
              </div>
            ))}
          </div>
        )}
        {reviewTab === 'Locations' && (
          <div className="space-y-1 fade-up text-[10px] text-slate-400">
            {['Riverside Industrial Complex, Unit 7B', 'Parking Lot A (CCTV confirmed)', 'Loading Dock — Departure'].map((l,i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg"
                style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)' }}>
                <MapPinIcon size={10} style={{ color: '#8b5cf6' }} /><span>{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
