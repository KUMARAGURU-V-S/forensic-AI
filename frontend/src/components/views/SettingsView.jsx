/**
 * SettingsView — inline settings panel shown in the "Settings" tab.
 */
import { useState } from 'react'
import { Shield, Database, Brain, Bell, Key, Save, CheckCircle } from 'lucide-react'
import { useForensicStore } from '../../lib/store'

const SECTIONS = [
  { id: 'system', label: 'System', icon: Database },
  { id: 'ai', label: 'AI Config', icon: Brain },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

export default function SettingsView({ caseId }) {
  const { auth, logout } = useForensicStore()
  const [activeSection, setActiveSection] = useState('system')
  const [saved, setSaved] = useState(false)
  const [aiModel, setAiModel] = useState('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
  const [wsEnabled, setWsEnabled] = useState(true)
  const [auditEnabled, setAuditEnabled] = useState(true)
  const [alertLevel, setAlertLevel] = useState('critical')

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Field = ({ label, children, desc }) => (
    <div className="flex items-start justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex-1 max-w-xs">
        <div className="text-[12px] font-semibold text-slate-200">{label}</div>
        {desc && <div className="text-[10px] text-slate-500 mt-0.5">{desc}</div>}
      </div>
      <div className="flex-shrink-0 ml-4">{children}</div>
    </div>
  )

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)}
      className="relative w-10 h-5.5 rounded-full transition-all flex-shrink-0"
      style={{ background: value ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)', border: `1px solid ${value ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.12)'}`, width: 40, height: 22 }}>
      <div className="absolute top-0.5 rounded-full transition-all"
        style={{ width: 18, height: 18, background: value ? '#00d4ff' : '#475569', left: value ? 19 : 2 }} />
    </button>
  )

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'rgba(4,8,18,0.95)' }}>
      {/* Sidebar */}
      <div className="w-44 flex-shrink-0 py-4 px-3 space-y-0.5" style={{ borderRight: '1px solid rgba(0,212,255,0.06)' }}>
        <div className="text-[10px] text-slate-600 uppercase tracking-widest px-2 mb-3">Settings</div>
        {SECTIONS.map(s => {
          const Icon = s.icon
          const active = activeSection === s.id
          return (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                color: active ? '#00d4ff' : '#475569',
                border: `1px solid ${active ? 'rgba(0,212,255,0.2)' : 'transparent'}`,
              }}>
              <Icon size={13} /> {s.label}
            </button>
          )
        })}

        {/* User info */}
        <div className="absolute bottom-4 left-0 w-44 px-3">
          <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="text-[10px] text-slate-500">Logged in as</div>
            <div className="text-[11px] font-semibold text-slate-300 mt-0.5 truncate">{auth.user?.username || 'investigator'}</div>
            <button onClick={logout}
              className="mt-2 text-[10px] text-slate-600 hover:text-red-400 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {activeSection === 'system' && (
          <div>
            <h2 className="text-[15px] font-bold text-slate-100 mb-1">System Configuration</h2>
            <p className="text-[11px] text-slate-500 mb-5">Backend and database settings for the forensic platform.</p>
            <Field label="Active Case" desc="Current case loaded in the workspace">
              <span className="text-[11px] font-mono text-cyan-400 px-2 py-1 rounded"
                style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)' }}>
                {caseId}
              </span>
            </Field>
            <Field label="Database" desc="Persistent storage backend">
              <span className="text-[10px] text-slate-400 font-mono">SQLite (WAL mode)</span>
            </Field>
            <Field label="WebSocket Updates" desc="Real-time push for evidence and risk changes">
              <Toggle value={wsEnabled} onChange={setWsEnabled} />
            </Field>
            <Field label="Audit Logging" desc="Immutable log of all investigative actions">
              <Toggle value={auditEnabled} onChange={setAuditEnabled} />
            </Field>
            <Field label="Platform Version">
              <span className="text-[10px] text-slate-500 font-mono">v3.1.0</span>
            </Field>
          </div>
        )}

        {activeSection === 'ai' && (
          <div>
            <h2 className="text-[15px] font-bold text-slate-100 mb-1">AI Configuration</h2>
            <p className="text-[11px] text-slate-500 mb-5">Featherless AI model and inference settings.</p>
            <Field label="Active Model" desc="LLM used for all analysis and Q&A">
              <select value={aiModel} onChange={e => setAiModel(e.target.value)}
                className="text-[10px] px-2 py-1 rounded outline-none"
                style={{ background: 'rgba(15,25,50,0.8)', border: '1px solid rgba(0,212,255,0.15)', color: '#94a3b8' }}>
                <option value="meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo">Llama-3.1-8B-Instruct-Turbo</option>
                <option value="meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo">Llama-3.1-70B-Instruct-Turbo</option>
                <option value="mistralai/Mixtral-8x7B-Instruct-v0.1">Mixtral-8x7B-Instruct</option>
              </select>
            </Field>
            <Field label="API Backend" desc="Featherless.ai OpenAI-compatible endpoint">
              <span className="text-[10px] text-slate-500 font-mono">api.featherless.ai/v1</span>
            </Field>
            <Field label="Max Tokens" desc="Per request token limit">
              <span className="text-[10px] text-slate-400 font-mono">1024</span>
            </Field>
            <Field label="Temperature" desc="Determinism of AI responses (lower = more precise)">
              <span className="text-[10px] text-slate-400 font-mono">0.1</span>
            </Field>
          </div>
        )}

        {activeSection === 'security' && (
          <div>
            <h2 className="text-[15px] font-bold text-slate-100 mb-1">Security & Authentication</h2>
            <p className="text-[11px] text-slate-500 mb-5">JWT tokens, roles, and access control.</p>
            <Field label="Auth Method">
              <span className="text-[10px] text-slate-400 font-mono">JWT (HS256)</span>
            </Field>
            <Field label="Token Expiry">
              <span className="text-[10px] text-slate-400 font-mono">24 hours</span>
            </Field>
            <Field label="Role">
              <span className="text-[10px] text-cyan-400 font-mono">{auth.user?.role || 'investigator'}</span>
            </Field>
            <Field label="Chain-of-Custody Hashing" desc="SHA-256 for all uploaded evidence">
              <div className="flex items-center gap-1 text-emerald-400">
                <CheckCircle size={12} />
                <span className="text-[10px]">Enabled</span>
              </div>
            </Field>
            <Field label="API Key" desc="Featherless AI key (set via environment variable)">
              <div className="flex items-center gap-1.5">
                <Key size={11} className="text-slate-600" />
                <span className="text-[10px] text-slate-600 font-mono">FEATHERLESS_API_KEY</span>
              </div>
            </Field>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div>
            <h2 className="text-[15px] font-bold text-slate-100 mb-1">Notification Preferences</h2>
            <p className="text-[11px] text-slate-500 mb-5">Configure alert thresholds and notification types.</p>
            <Field label="Risk Alert Threshold" desc="Minimum risk level to trigger notifications">
              <select value={alertLevel} onChange={e => setAlertLevel(e.target.value)}
                className="text-[10px] px-2 py-1 rounded outline-none"
                style={{ background: 'rgba(15,25,50,0.8)', border: '1px solid rgba(0,212,255,0.15)', color: '#94a3b8' }}>
                <option value="critical">Critical only</option>
                <option value="high">High and above</option>
                <option value="medium">Medium and above</option>
              </select>
            </Field>
            <Field label="Evidence Ingestion Alerts" desc="Alert when new evidence is processed">
              <Toggle value={true} onChange={() => {}} />
            </Field>
            <Field label="Timeline Auto-Update" desc="Push new events to timeline without refresh">
              <Toggle value={wsEnabled} onChange={setWsEnabled} />
            </Field>
          </div>
        )}

        <button onClick={handleSave}
          className="mt-6 flex items-center gap-2 h-9 px-5 rounded-xl text-[11px] font-semibold transition-all"
          style={{ background: saved ? 'rgba(16,185,129,0.12)' : 'rgba(0,212,255,0.1)', border: `1px solid ${saved ? 'rgba(16,185,129,0.3)' : 'rgba(0,212,255,0.25)'}`, color: saved ? '#10b981' : '#00d4ff' }}>
          {saved ? <CheckCircle size={12} /> : <Save size={12} />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
