import { useState, useEffect, useRef } from 'react'
import { X, Search, Send, Loader, MessageSquare, BookOpen } from 'lucide-react'
import { useForensicStore } from '../../lib/store'

const SUGGESTIONS = [
  'Who was last seen with the victim?',
  'What is the timeline of events on the day of death?',
  'What evidence links the suspect to the scene?',
  'How was the poison administered?',
  'What does the smartwatch data reveal?',
  'Summarize all evidence against the primary suspect',
]

export default function SearchResultsModal() {
  const { ui, closeSearch, search } = useForensicStore()
  const [query, setQuery]   = useState(ui.searchQuery || '')
  const inputRef = useRef()

  useEffect(() => { if (ui.searchOpen) setTimeout(() => inputRef.current?.focus(), 50) }, [ui.searchOpen])

  if (!ui.searchOpen) return null

  const handleSearch = (q) => {
    const text = q || query
    if (!text.trim()) return
    setQuery(text)
    search(text)
  }

  const results = ui.searchResults
  const sources = results?.response?.evidence_sources || []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && closeSearch()}>
      <div className="w-[660px] rounded-2xl overflow-hidden"
        style={{ background: 'rgba(7,12,26,0.98)', border: '1px solid rgba(0,212,255,0.15)',
                 boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.06)' }}>

        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
          <Search size={16} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ask the AI investigator anything about this case…"
            className="flex-1 bg-transparent text-[13px] text-slate-200 placeholder-slate-600 outline-none"
          />
          <button onClick={() => handleSearch()}
            disabled={!query.trim() || ui.searchLoading}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
            style={{ background: query.trim() ? 'rgba(0,212,255,0.12)' : 'transparent',
                     border: '1px solid rgba(0,212,255,0.15)' }}>
            {ui.searchLoading ? <Loader size={13} className="animate-spin text-cyan-400" /> : <Send size={13} className="text-cyan-400" />}
          </button>
          <button onClick={closeSearch} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
            <X size={13} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[520px] overflow-y-auto">
          {/* Answer */}
          {results?.response?.answer && (
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <MessageSquare size={11} style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-300">AI INVESTIGATOR</span>
                  <span className="text-[9px] text-slate-600 ml-2">
                    Confidence: {Math.round((results.response.confidence || 0) * 100)}%
                    {' · '}{results.response.ai_model || 'Featherless AI'}
                  </span>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                {results.response.answer}
              </p>
              {sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sources.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[9px] font-medium"
                      style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#67e8f9' }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestions */}
          {!results && !ui.searchLoading && (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={12} className="text-slate-600" />
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Suggested Queries</span>
              </div>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => handleSearch(s)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {ui.searchLoading && (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader size={20} className="animate-spin text-cyan-400" />
              <span className="text-[12px] text-slate-500">AI is reasoning over case evidence…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
