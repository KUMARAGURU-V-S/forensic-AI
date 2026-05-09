import { Link, useLocation } from 'react-router-dom'
import { Shield, LayoutDashboard, Bot, Search, Home } from 'lucide-react'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/agents', icon: Bot, label: 'AI Agents' },
  { path: '/query', icon: Search, label: 'Query' },
]

export default function Navbar() {
  const location = useLocation()
  return (
    <nav className="sticky top-0 z-50 bg-[#0a0e1a]/90 backdrop-blur-xl border-b border-forensic-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Shield className="text-forensic-cyan" size={20} />
          <span className="font-black text-white text-sm tracking-wider">FORENSIC<span className="text-forensic-cyan">AI</span></span>
          <span className="text-[10px] font-mono text-slate-500 ml-2 hidden sm:block">v2.4.1</span>
        </Link>
        <div className="flex items-center gap-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link key={path} to={path} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              location.pathname === path ? 'bg-forensic-cyan/10 text-forensic-cyan border border-forensic-cyan/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <Icon size={14} /><span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-forensic-green pulse-dot" />
          <span className="text-[10px] font-mono text-slate-400 hidden sm:block">SYSTEM ACTIVE</span>
        </div>
      </div>
    </nav>
  )
}
