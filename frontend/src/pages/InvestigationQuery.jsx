import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Send, Sparkles, Clock } from 'lucide-react'
import { api } from '../lib/api'

export default function InvestigationQuery() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => { api.getQuerySuggestions().then(d => setSuggestions(d.suggestions)).catch(console.error) }, [])

  const handleQuery = async (q) => {
    const question = q || query
    if (!question.trim()) return
    setLoading(true)
    try {
      const res = await api.query(question)
      setResult(res)
      setHistory(prev => [{ question, response: res, timestamp: new Date().toISOString() }, ...prev.slice(0, 4)])
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-xl font-black text-white mb-1 flex items-center gap-2"><Search size={20} className="text-forensic-green" />Natural Language Investigation</h1>
        <p className="text-sm text-slate-400 font-mono">RAG + Graph Reasoning + LLM • Ask anything about the case</p>
      </motion.div>

      {/* Query Input */}
      <div className="forensic-card rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            placeholder="Ask: Who was last seen with victim? / Show suspicious activity before death..."
            className="flex-1 bg-forensic-bg border border-forensic-border rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-forensic-cyan transition-colors" />
          <button onClick={() => handleQuery()} disabled={loading}
            className="px-6 py-3 bg-forensic-cyan text-black font-bold rounded-lg hover:bg-forensic-cyan/90 disabled:opacity-50 flex items-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* Suggestions */}
      {!result && (
        <div className="mb-8">
          <div className="text-xs font-mono text-slate-500 mb-3 flex items-center gap-2"><Sparkles size={12} />SUGGESTED QUERIES</div>
          <div className="grid md:grid-cols-2 gap-2">
            {suggestions.map((s, i) => (
              <motion.button key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => { setQuery(s); handleQuery(s) }}
                className="text-left p-3 rounded-lg bg-forensic-card border border-forensic-border hover:border-forensic-cyan/50 text-xs text-slate-300 hover:text-white transition-all">
                "{s}"
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="forensic-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-mono text-forensic-cyan">AI RESPONSE • Confidence: {(result.response.confidence * 100).toFixed(0)}%</div>
              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><Clock size={10} />{result.processing.response_time_ms}ms</div>
            </div>
            <div className="text-sm text-white whitespace-pre-line leading-relaxed mb-4">{result.response.answer}</div>
            
            <div className="border-t border-forensic-border pt-4 grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-mono text-slate-500 mb-2">EVIDENCE SOURCES</div>
                <div className="space-y-1">{result.response.evidence_sources.map((s, i) => <div key={i} className="text-[11px] text-forensic-cyan pl-2 border-l border-forensic-cyan/40">{s}</div>)}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-slate-500 mb-2">RELATED FINDINGS</div>
                <div className="space-y-1">{result.response.related_findings.map((f, i) => <div key={i} className="text-[11px] text-slate-300 pl-2 border-l border-forensic-amber/40">{f}</div>)}</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-forensic-border flex items-center gap-4 text-[10px] text-slate-500 font-mono">
              <span>Method: {result.processing.method}</span>
              <span>•</span>
              <span>Sources: {result.processing.retrieval_sources}</span>
              <span>•</span>
              <span>Reasoning Steps: {result.processing.reasoning_steps}</span>
            </div>
          </div>

          {/* Query History */}
          {history.length > 1 && (
            <div className="forensic-card rounded-xl p-4">
              <div className="text-[10px] font-mono text-slate-500 mb-3">QUERY HISTORY</div>
              <div className="space-y-2">{history.slice(1).map((h, i) => (
                <button key={i} onClick={() => { setQuery(h.question); handleQuery(h.question) }}
                  className="w-full text-left p-2 rounded bg-forensic-bg border border-forensic-border hover:border-forensic-cyan/30 text-[11px] text-slate-400 transition-colors">
                  {h.question}
                </button>
              ))}</div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
