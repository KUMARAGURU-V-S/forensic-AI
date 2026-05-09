import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Loader, AlertCircle } from 'lucide-react'
import { useForensicStore } from '../lib/store'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useForensicStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!username || !password) { setError('Please enter credentials.'); return }
    setLoading(true); setError('')
    try {
      await login(username, password)
      navigate('/workspace/FTI-2024-0847')
    } catch {
      setError('Invalid username or password. Default: investigator / forensic2024')
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = async () => {
    setUsername('investigator'); setPassword('forensic2024')
    setLoading(true); setError('')
    try {
      await login('investigator', 'forensic2024')
      navigate('/workspace/FTI-2024-0847')
    } catch {
      // Demo login failed — allow access anyway (demo mode)
      navigate('/workspace/FTI-2024-0847')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center grid-bg"
      style={{ background: '#040810' }}>
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-[380px] px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', boxShadow: '0 0 30px rgba(0,212,255,0.15)' }}>
            <Shield size={26} style={{ color: '#00d4ff' }} />
          </div>
          <h1 className="text-[20px] font-black text-slate-100 tracking-tight">FORENSIC AI</h1>
          <p className="text-[11px] text-slate-500 mt-1 tracking-widest uppercase">Intelligence System v3.1</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(7,12,26,0.95)', border: '1px solid rgba(0,212,255,0.1)',
                   boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
          <div className="px-6 pt-5 pb-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Investigator Login</div>
          </div>

          <form onSubmit={handleLogin} className="px-6 pb-6 pt-4 space-y-4">
            {/* Username */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" placeholder="investigator"
                className="w-full h-10 px-3 rounded-xl text-[12px] text-slate-200 placeholder-slate-600 outline-none transition-all"
                style={{ background: 'rgba(15,25,50,0.8)', border: '1px solid rgba(0,212,255,0.12)' }}
                onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.35)'}
                onBlur={e => e.target.style.borderColor = 'rgba(0,212,255,0.12)'} />
            </div>

            {/* Password */}
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <input value={password} onChange={e => setPassword(e.target.value)}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password" placeholder="••••••••"
                  className="w-full h-10 px-3 pr-10 rounded-xl text-[12px] text-slate-200 placeholder-slate-600 outline-none transition-all"
                  style={{ background: 'rgba(15,25,50,0.8)', border: '1px solid rgba(0,212,255,0.12)' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.35)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(0,212,255,0.12)'} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-red-400"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={13} className="flex-shrink-0" /> {error}
              </div>
            )}

            {/* Login button */}
            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all"
              style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff',
                       boxShadow: '0 0 20px rgba(0,212,255,0.1)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.2)'; e.currentTarget.style.boxShadow = '0 0 25px rgba(0,212,255,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.12)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(0,212,255,0.1)' }}>
              {loading ? <Loader size={14} className="animate-spin" /> : <Shield size={14} />}
              {loading ? 'Authenticating…' : 'Sign In'}
            </button>

            {/* Demo access */}
            <button type="button" onClick={handleDemo}
              className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400 transition-colors py-1">
              Continue as Demo Investigator →
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-700 mt-5">
          Default credentials: <span className="font-mono text-slate-600">investigator / forensic2024</span>
        </p>
      </div>
    </div>
  )
}
