import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Brain, Network, Clock, AlertTriangle, Lock, Search, Activity } from 'lucide-react'

const features = [
  { icon: Brain, title: 'Autopsy NLP Intelligence', desc: 'AI extracts cause of death, injury patterns, and toxicology from unstructured reports', color: '#00d4ff' },
  { icon: Clock, title: 'Dual-Mode TOD Estimation', desc: 'Henssge nomogram + metabolomic AI for precise time-of-death calculation', color: '#00ff88' },
  { icon: Network, title: 'Evidence Graph Engine', desc: 'Property graph correlates suspects, devices, locations, and digital traces', color: '#cc00ff' },
  { icon: AlertTriangle, title: 'Risk Scoring & Anomaly', desc: 'LSTM + Isolation Forest detects suspicious patterns and behavioral anomalies', color: '#ffaa00' },
  { icon: Shield, title: 'SHAP/LIME Explainability', desc: 'Legally defensible AI decisions with full factor attribution', color: '#ff3333' },
  { icon: Lock, title: 'Blockchain Chain of Custody', desc: 'SHA-256 immutable ledger ensures evidence integrity and tamper detection', color: '#00d4ff' },
  { icon: Search, title: 'Natural Language Queries', desc: 'Ask questions like "Who was last seen with victim?" using RAG + Graph reasoning', color: '#00ff88' },
  { icon: Activity, title: 'Multi-Agent FEAT System', desc: '7 specialized AI agents for autopsy, CCTV, toxicology, timeline, and more', color: '#cc00ff' },
]

function AnimatedCounter({ target, suffix, duration = 2000 }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let start = 0
    const increment = target / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(start * 10) / 10)
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return <span>{target > 100 ? Math.floor(count).toLocaleString() : count}{suffix}</span>
}

export default function Landing() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#0a0e1a] overflow-hidden relative">
      <div className="fixed inset-0 grid-bg opacity-50" />
      
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="absolute top-6 left-6 right-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-forensic-cyan pulse-dot" />
            <span className="text-xs font-mono text-slate-400">SYSTEM ACTIVE</span>
          </div>
          <div className="text-xs font-mono text-slate-500">v2.4.1 // CLASSIFIED</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center z-10">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="inline-block mb-6 px-4 py-1.5 rounded-full border border-forensic-cyan/30 bg-forensic-cyan/5">
            <span className="text-xs tracking-[0.3em] text-forensic-cyan font-mono uppercase">AI-Powered Forensic Intelligence Platform</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-4">
            <span className="text-white">FORENSIC</span><br />
            <span className="text-forensic-cyan text-glow-cyan">TRIAGE</span>
          </h1>
          
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="text-lg md:text-xl text-slate-400 font-mono tracking-wider max-w-2xl mx-auto mb-4">
            POSTMORTEM INTELLIGENCE & DIGITAL STRATIGRAPHY
          </motion.p>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="text-sm text-slate-500 max-w-3xl mx-auto mb-10 leading-relaxed">
            Unified multimodal forensic intelligence that semantically correlates autopsy findings, digital evidence, CCTV metadata, IoT telemetry, and behavioral anomalies into a legally explainable investigative graph using AI-powered reasoning.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-forensic-cyan text-black font-bold rounded-lg hover:bg-forensic-cyan/90 transition-all glow-cyan">
              ACCESS SYSTEM →
            </button>
            <button onClick={() => navigate('/query')} className="px-8 py-3 border border-forensic-cyan/50 text-forensic-cyan font-bold rounded-lg hover:bg-forensic-cyan/10 transition-all">
              INVESTIGATION QUERY
            </button>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="absolute bottom-10 flex flex-col items-center gap-2">
          <span className="text-xs font-mono text-slate-500">SCROLL TO EXPLORE</span>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-5 h-8 border border-slate-600 rounded-full flex items-start justify-center p-1">
            <div className="w-1 h-2 bg-forensic-cyan rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[{ label: 'Cases Processed', value: 12847, suffix: '+' }, { label: 'AI Accuracy', value: 94.7, suffix: '%' },
            { label: 'Avg Triage Time', value: 4.2, suffix: 'hrs' }, { label: 'Evidence Items', value: 284700, suffix: '+' }
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="forensic-card rounded-xl p-6 text-center">
              <div className="text-3xl md:text-4xl font-black text-forensic-cyan text-glow-cyan mb-2">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">DIGITAL <span className="text-forensic-cyan">STRATIGRAPHY</span></h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Combining physical forensic evidence + digital evidence into synchronized investigative layers.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                  className="forensic-card rounded-xl p-5">
                  <div className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center mb-3" style={{color: feature.color}}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{feature.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto forensic-card rounded-2xl p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-8 text-center">SYSTEM <span className="text-forensic-purple">ARCHITECTURE</span></h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-4"><div className="text-forensic-cyan text-4xl font-black mb-2">7</div><div className="text-sm font-bold text-white mb-1">AI AGENTS</div><div className="text-xs text-slate-400">Autopsy • Timeline • CCTV • Toxicology • Correlation • Explainability • Risk</div></div>
            <div className="text-center p-4"><div className="text-forensic-green text-4xl font-black mb-2">5</div><div className="text-sm font-bold text-white mb-1">DATA LAYERS</div><div className="text-xs text-slate-400">Pathology • Digital • Surveillance • Geospatial • Behavioral</div></div>
            <div className="text-center p-4"><div className="text-forensic-purple text-4xl font-black mb-2">∞</div><div className="text-sm font-bold text-white mb-1">CORRELATIONS</div><div className="text-xs text-slate-400">Graph Intelligence • Cross-case Matching • Temporal Alignment</div></div>
          </div>
          <div className="mt-8 pt-8 border-t border-forensic-border grid grid-cols-2 md:grid-cols-6 gap-3">
            {['FastAPI', 'BioBERT', 'Neo4j', 'SHAP/LIME', 'SHA-256', 'RAG+LLM'].map((tech) => (
              <div key={tech} className="text-center py-2 px-3 rounded-lg bg-forensic-bg border border-forensic-border"><span className="text-xs font-mono text-slate-300">{tech}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 px-4 mb-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Ready to <span className="text-forensic-cyan">Investigate</span>?</h2>
          <p className="text-slate-400 mb-8">Access the forensic triage system to analyze cases, correlate evidence, and uncover hidden patterns.</p>
          <button onClick={() => navigate('/dashboard')} className="px-10 py-4 bg-gradient-to-r from-forensic-cyan to-forensic-purple text-white font-bold text-lg rounded-lg hover:opacity-90 transition-all shadow-lg shadow-forensic-cyan/20">
            ENTER INVESTIGATION DASHBOARD →
          </button>
        </div>
      </section>

      <footer className="border-t border-forensic-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-xs font-mono text-slate-500">ForensicAI Triage Intelligence System v2.4.1 // RESEARCH PROTOTYPE</div>
          <div className="text-xs font-mono text-slate-500">AI-Powered • Explainable • Legally Transparent</div>
        </div>
      </footer>
    </div>
  )
}
