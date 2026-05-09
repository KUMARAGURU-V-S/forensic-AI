import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Check, Shield } from 'lucide-react'
import { api } from '../lib/api'
import { useForensicStore } from '../lib/store'

export default function ChainOfCustody() {
  const { caseId: paramId } = useParams()
  const storeCaseId = useForensicStore(s => s.caseId)
  const caseId = paramId || storeCaseId || 'FTI-2024-0847'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.getChainOfCustody(caseId).then(setData).catch(console.error).finally(() => setLoading(false)) }, [caseId])

  if (loading) return <div className="flex items-center justify-center min-h-[80vh]"><div className="w-8 h-8 border-2 border-forensic-cyan border-t-transparent rounded-full animate-spin" /></div>
  if (!data) return null

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl font-black text-white mb-1 flex items-center gap-2"><Lock size={20} className="text-forensic-cyan" />Blockchain Chain of Custody</h1>
        <p className="text-sm text-slate-400 font-mono">{caseId} • {data.ledger_type}</p>
      </motion.div>

      {/* Status */}
      <div className="forensic-card rounded-xl p-4 mb-6 flex items-center justify-between border-forensic-green/30">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-forensic-green" />
          <div>
            <div className="text-sm font-bold text-forensic-green">CHAIN INTEGRITY: {data.verification.chain_integrity}</div>
            <div className="text-[10px] text-slate-400 font-mono">Tampering Detected: {data.verification.tampering_detected ? 'YES ⚠️' : 'NONE ✓'} • Last verified: {data.verification.last_verification}</div>
          </div>
        </div>
        <div className="text-2xl font-black text-forensic-green">{data.total_blocks}</div>
      </div>

      {/* Blocks */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-forensic-cyan via-forensic-purple to-forensic-green" />
        <div className="space-y-4">
          {data.blocks.map((block, i) => (
            <motion.div key={block.block_number} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="relative pl-14">
              <div className="absolute left-4 w-5 h-5 rounded-full bg-forensic-cyan/20 border-2 border-forensic-cyan flex items-center justify-center">
                <span className="text-[8px] font-bold text-forensic-cyan">{block.block_number}</span>
              </div>
              <div className="forensic-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-white">{block.evidence_type}</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{block.timestamp} • {block.custodian}</div>
                  </div>
                  <div className="flex items-center gap-1 text-forensic-green">
                    <Check size={12} /><span className="text-[10px] font-bold">VERIFIED</span>
                  </div>
                </div>
                
                {/* Hash */}
                <div className="p-2 rounded bg-forensic-bg border border-forensic-border mb-3">
                  <div className="text-[9px] text-slate-500 font-mono mb-0.5">SHA-256 HASH</div>
                  <div className="text-[10px] text-forensic-cyan font-mono break-all">{block.hash}</div>
                </div>
                <div className="p-2 rounded bg-forensic-bg border border-forensic-border mb-3">
                  <div className="text-[9px] text-slate-500 font-mono mb-0.5">PREVIOUS HASH</div>
                  <div className="text-[10px] text-slate-400 font-mono break-all">{block.previous_hash.substring(0, 32)}...</div>
                </div>

                {/* Access Log */}
                <div className="text-[9px] text-slate-500 font-mono mb-1">ACCESS LOG</div>
                <div className="space-y-1">
                  {block.access_log.map((log, j) => (
                    <div key={j} className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-500 font-mono w-36">{log.timestamp.substring(11, 19)}</span>
                      <span className="text-white">{log.user}</span>
                      <span className="text-forensic-cyan">{log.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
