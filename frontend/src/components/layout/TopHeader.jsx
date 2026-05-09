import { useState } from 'react'
import {
  Search, Bell, Moon, Sun, ChevronDown, Zap, RefreshCw, Download,
} from 'lucide-react'
import { useForensicStore } from '../../lib/store'

const TABS = ['Overview','Investigation Workspace','Evidence','Analytics','Reports','Chain of Custody','Settings']

export default function TopHeader({ caseId, caseData, activeTab, onTabChange, onSearch, onExport }) {
  const [darkMode, setDarkMode] = useState(true)
  const { ui, openSearch } = useForensicStore()

  const handleSearchClick = () => openSearch()
  const handleSearchKey = (e) => { if (e.key === 'Enter') openSearch() }

  return (
    <div className="flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
      {/* ── Primary Header Row ────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 h-14"
        style={{ background: 'rgba(4,8,15,0.95)', backdropFilter: 'blur(20px)' }}>

        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0 mr-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', boxShadow: '0 0 12px rgba(0,212,255,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="#00d4ff" strokeWidth="1.2" fill="rgba(0,212,255,0.1)" />
              <circle cx="8" cy="8" r="2.5" fill="#00d4ff" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-black tracking-widest" style={{ color: '#00d4ff' }}>FORENSIC AI</div>
            <div className="text-[8px] tracking-widest text-slate-500">INTELLIGENCE SYSTEM</div>
          </div>
        </div>

        {/* Case ID pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-shrink-0"
          style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
          <span className="text-[10px] text-slate-500 font-mono">CASE ID:</span>
          <span className="text-[11px] font-mono font-bold" style={{ color: '#00d4ff' }}>{caseId || '---'}</span>
          <RefreshCw size={10} className="text-slate-600 cursor-pointer hover:text-slate-400 transition-colors" />
        </div>

        {/* Active Investigation badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <div className="w-1.5 h-1.5 rounded-full blink" style={{ background: '#10b981' }} />
          <span className="text-[10px] font-semibold" style={{ color: '#10b981' }}>Active Investigation</span>
        </div>

        {/* Search — opens AI modal */}
        <div className="flex-1 mx-4 max-w-lg relative" onClick={handleSearchClick}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="global-search"
            type="text"
            readOnly
            placeholder="Ask the AI investigator... (Ctrl+K)"
            onKeyDown={handleSearchKey}
            className="w-full h-9 pl-9 pr-4 rounded-lg text-[12px] outline-none cursor-pointer transition-all"
            style={{
              background: 'rgba(15,29,56,0.8)',
              border: '1px solid rgba(0,212,255,0.12)',
              color: '#94a3b8',
              fontFamily: 'Inter, sans-serif',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,255,0.1)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,212,255,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* WS indicator */}
          {ui?.wsConnected && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full blink" style={{ background:'#10b981' }} />
              <span className="text-[9px]" style={{ color:'#10b981' }}>Live</span>
            </div>
          )}

          {/* Export */}
          <button id="export-btn" onClick={onExport}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold transition-all"
            style={{ background:'rgba(0,212,255,0.06)', border:'1px solid rgba(0,212,255,0.15)', color:'#67e8f9' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(0,212,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(0,212,255,0.06)'}>
            <Download size={11} /> Export
          </button>

          {/* Notification */}
          <button id="notifications-btn" className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
            <Bell size={15} className="text-slate-400" />
            <div className="absolute top-1 right-1 w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold"
              style={{ background: '#ef4444', color: '#fff' }}>3</div>
          </button>

          {/* Dark/Light toggle */}
          <button id="theme-toggle" onClick={() => setDarkMode(d => !d)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
            {darkMode ? <Moon size={14} className="text-slate-400" /> : <Sun size={14} className="text-yellow-400" />}
          </button>

          {/* Profile */}
          <div className="flex items-center gap-2 pl-2 cursor-pointer group">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{ background: 'linear-gradient(135deg, #162645, #1e3460)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
              AR
            </div>
            <div className="hidden md:block">
              <div className="text-[11px] font-semibold text-slate-200 leading-none">{caseData?.lead_investigator || 'Det. Investigator'}</div>
              <div className="text-[9px] text-slate-500 mt-0.5">Lead Investigator</div>
            </div>
            <ChevronDown size={11} className="text-slate-500" />
          </div>
        </div>
      </div>

      {/* ── Secondary Tab Navigation ───────────────────────── */}
      <div className="flex items-center gap-0 px-4 h-9"
        style={{ background: 'rgba(7,13,26,0.9)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            id={`tab-${tab.toLowerCase().replace(/\s+/g,'-')}`}
            onClick={() => onTabChange?.(tab)}
            className={`px-4 h-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              activeTab === tab ? 'tab-active' : 'tab-inactive'
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-500">
          <Zap size={10} style={{ color: '#00d4ff' }} />
          <span className="font-mono">Featherless AI · SQLite</span>
        </div>
      </div>
    </div>
  )
}
