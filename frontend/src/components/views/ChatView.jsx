/**
 * ChatView — GraphRAG-enhanced AI Chat
 * Wired to /api/chat/ with knowledge retrieval context display.
 */
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, RefreshCw, Brain, BookOpen } from 'lucide-react'
import { api } from '../../lib/api'

const C = {
  cyan: '#00d4ff', green: '#10b981', amber: '#f59e0b',
  border: 'rgba(0,212,255,0.08)', card: 'rgba(7,14,32,0.85)', bg: 'rgba(4,8,18,0.97)',
}

const SYSTEM_MSG = {
  role: 'system',
  content: `You are ForensiX AI, an expert forensic investigation assistant with deep knowledge of forensic pathology, crime scene analysis, evidence correlation, time-of-death estimation (Henssge nomogram), toxicology, and legal investigative procedures. Use court-appropriate language: "consistent with", "suggests", "indicates". Never state absolute certainty. Always cite the evidence type supporting your analysis.`,
}

const QUICK_PROMPTS = [
  'Explain Henssge nomogram for TOD estimation',
  'What do petechial hemorrhages indicate?',
  'Signs of involuntary drug administration?',
  'How do defensive wounds establish manner of death?',
  'What anomalies suggest staged crime scenes?',
  'Interpret blunt force trauma vs sharp force',
]

function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: isUser ? 'rgba(0,212,255,0.15)' : msg.error ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
          border: `1px solid ${isUser ? 'rgba(0,212,255,0.3)' : msg.error ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
        }}>
        {isUser ? <User size={12} style={{ color: C.cyan }} /> : <Bot size={12} style={{ color: C.green }} />}
      </div>
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
          style={{
            background: isUser ? 'rgba(0,212,255,0.09)' : C.card,
            border: `1px solid ${isUser ? 'rgba(0,212,255,0.18)' : msg.error ? 'rgba(239,68,68,0.2)' : C.border}`,
            color: msg.error ? '#fca5a5' : '#cbd5e1',
          }}>
          <MsgBody text={msg.content} />
        </div>
        {msg.model && (
          <div className="flex gap-2 text-[9px] font-mono text-slate-600 px-1">
            <span>{msg.provider} • {msg.model}</span>
            {msg.tokens > 0 && <span>{msg.tokens} tok • {msg.latency}ms</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function MsgBody({ text }) {
  return (
    <div>
      {(text || '').split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <div key={i} className="font-bold text-slate-200 mb-1 mt-2">{line.slice(3)}</div>
        if (line.startsWith('**') && line.endsWith('**')) return <div key={i} className="font-bold text-white mb-1">{line.slice(2, -2)}</div>
        if (line.startsWith('• ') || line.startsWith('- ')) return <div key={i} className="flex gap-2 mb-0.5"><span style={{ color: C.cyan }}>▸</span><span>{line.slice(2)}</span></div>
        if (line === '') return <div key={i} className="h-1.5" />
        return <span key={i}>{line}</span>
      })}
    </div>
  )
}

export default function ChatView({ caseId }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `**ForensiX AI online.** I have access to the GraphRAG forensic knowledge base covering pathology, toxicology, crime scene analysis, and investigative procedures.\n\nAsk me anything about Case ${caseId || 'FTI-2024-0847'} or general forensic science.`,
      ts: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState('auto')
  const [kbStats, setKbStats] = useState(null)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { api.getKnowledgeStats().then(setKbStats).catch(() => {}) }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg = { role: 'user', content: text, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = [...messages.filter(m => m.role !== 'system'), userMsg]
      const apiMsgs = [SYSTEM_MSG, ...history.map(m => ({ role: m.role, content: m.content }))]
      const res = await api.chatAI(apiMsgs, provider === 'auto' ? null : provider)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.content || 'No response generated.',
        model: res.model,
        provider: res.provider,
        tokens: res.tokens_used,
        latency: res.latency_ms,
        ts: Date.now(),
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${e.message}. Check LLM provider in Settings.`,
        error: true,
        ts: Date.now(),
      }])
    }
    setLoading(false)
  }

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: C.bg }}>

      {/* ── Chat column ─────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <Brain size={15} style={{ color: C.cyan }} />
            <span className="text-sm font-black text-white">AI Chat</span>
            <span className="text-[10px] text-slate-500 font-mono">GraphRAG-Enhanced</span>
          </div>
          <div className="flex items-center gap-3">
            <select value={provider} onChange={e => setProvider(e.target.value)}
              className="text-[10px] font-mono rounded-lg px-2 py-1 focus:outline-none focus:border-forensic-cyan"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: '#94a3b8' }}>
              {['auto','featherless','openai','groq','huggingface'].map(p => (
                <option key={p} value={p} style={{ background: '#0f172a' }}>{p}</option>
              ))}
            </select>
            <button onClick={() => setMessages(msgs => [msgs[0]])} title="Clear chat"
              className="text-slate-600 hover:text-slate-400 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">
          {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <Bot size={12} style={{ color: C.green }} />
              </div>
              <div className="px-4 py-3 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#475569', animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input bar */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex gap-2 items-end">
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              placeholder="Ask about the case, forensic procedures, evidence interpretation…"
              rows={2}
              className="flex-1 text-xs resize-none rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none font-mono leading-relaxed"
              style={{ background: C.card, border: `1px solid ${C.border}` }} />
            <button onClick={send} disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30"
              style={{ background: 'rgba(0,212,255,0.15)', border: `1px solid rgba(0,212,255,0.3)` }}>
              <Send size={13} style={{ color: C.cyan }} />
            </button>
          </div>
          <div className="text-[9px] text-slate-600 mt-1 font-mono">Enter to send • Shift+Enter for new line</div>
        </div>
      </div>

      {/* ── Right sidebar ─────────────────────────────── */}
      <div className="w-60 flex-shrink-0 overflow-y-auto py-4 px-4 space-y-4"
        style={{ borderLeft: `1px solid ${C.border}` }}>

        {/* KB Stats */}
        <div className="p-3 rounded-xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
            <BookOpen size={10} style={{ color: C.cyan }} />GraphRAG KB
          </div>
          {kbStats ? (
            <div className="space-y-2">
              {[
                ['Knowledge Nodes', kbStats.node_count ?? 25],
                ['Relationships', kbStats.edge_count ?? 48],
                ['Retrieval Mode', kbStats.embedding_mode ?? 'hybrid'],
                ['Dimensions', kbStats.embedding_dim ?? 384],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-[10px] text-slate-500">{l}</span>
                  <span className="text-[10px] text-slate-300 font-mono">{v}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
                <span className="text-[9px]" style={{ color: C.green }}>Knowledge base ready</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-600 animate-pulse">Loading…</div>
          )}
        </div>

        {/* Quick prompts */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
            <Sparkles size={10} style={{ color: C.amber }} />Quick Prompts
          </div>
          <div className="space-y-1">
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => setInput(p)}
                className="w-full text-left px-3 py-2 rounded-lg transition-all text-[10px] text-slate-400 hover:text-white hover:bg-white/5 leading-snug"
                style={{ border: '1px solid transparent' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
