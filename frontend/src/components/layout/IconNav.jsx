import { useState } from 'react'
import {
  LayoutDashboard, FolderOpen, Shield, Clock, Share2,
  Settings, Link, Brain, MessageSquare, Bot, Cpu, FlaskConical, Globe,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'cases',     icon: FolderOpen,      label: 'Cases' },
  { id: 'evidence',  icon: Shield,          label: 'Evidence' },
  { id: 'timeline',  icon: Clock,           label: 'Timeline' },
  { id: 'graph',     icon: Share2,          label: 'Graph Analysis' },
  { id: 'custody',   icon: Link,            label: 'Chain of Custody' },
  // ── AI / ML section ────────────────────────────────
  { id: 'ai',        icon: Brain,           label: 'AI Modules',         dividerBefore: true },
  { id: 'agents',    icon: Bot,             label: 'AI Agents (LangGraph)' },
  { id: 'chronograph', icon: Globe,         label: '4D Chronograph' },
  { id: 'chat',      icon: MessageSquare,   label: 'AI Chat' },
  { id: 'intel',     icon: Cpu,             label: 'Intelligence Engine' },
  { id: 'ml',        icon: FlaskConical,    label: 'ML Pipeline' },
  // ── Bottom ─────────────────────────────────────────
  { id: 'settings',  icon: Settings,        label: 'Settings',           bottom: true },
]

export default function IconNav({ activeId = 'timeline', onChange }) {
  const [hovered, setHovered] = useState(null)

  const top = NAV_ITEMS.filter(i => !i.bottom)
  const bot = NAV_ITEMS.filter(i => i.bottom)

  const Item = ({ item }) => {
    const Icon = item.icon
    const isActive = activeId === item.id
    return (
      <div className="relative flex items-center justify-center">
        <button
          id={`nav-${item.id}`}
          onClick={() => onChange?.(item.id)}
          onMouseEnter={() => setHovered(item.id)}
          onMouseLeave={() => setHovered(null)}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{
            background: isActive
              ? 'rgba(0,212,255,0.12)'
              : hovered === item.id ? 'rgba(255,255,255,0.04)' : 'transparent',
            border: isActive ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
            boxShadow: isActive ? '0 0 12px rgba(0,212,255,0.2)' : 'none',
          }}
        >
          <Icon
            size={17}
            style={{ color: isActive ? '#00d4ff' : '#475569' }}
          />
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
              style={{ background: '#00d4ff', boxShadow: '0 0 6px #00d4ff' }} />
          )}
        </button>
        {/* Tooltip */}
        {hovered === item.id && (
          <div className="tooltip left-12 top-1/2 -translate-y-1/2 z-50"
            style={{ pointerEvents: 'none' }}>
            {item.label}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-between py-3 flex-shrink-0"
      style={{
        width: 52,
        background: 'rgba(4,8,15,0.9)',
        borderRight: '1px solid rgba(0,212,255,0.08)',
      }}>
      <div className="flex flex-col gap-1">
        {top.map(item => (
          <div key={item.id}>
            {item.dividerBefore && <div className="w-6 h-px bg-white/5 mx-auto my-1.5" />}
            <Item item={item} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1 mb-2">
        <div className="w-6 h-px bg-white/5 mx-auto mb-1" />
        {bot.map(item => <Item key={item.id} item={item} />)}
      </div>
    </div>
  )
}
