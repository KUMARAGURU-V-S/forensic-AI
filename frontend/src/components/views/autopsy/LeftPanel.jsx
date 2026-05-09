import { useRef } from 'react'
import { FileText, Plus, Trash2, RefreshCw, CheckCircle, Loader, AlertCircle, Clock, Shield } from 'lucide-react'

const C = { cyan:'#00d4ff', red:'#ef4444', green:'#10b981', amber:'#f59e0b', purple:'#8b5cf6', border:'rgba(0,212,255,0.08)' }

const STATUS_STEPS = ['File Upload','OCR Extraction','Text Chunking','Embedding Generation','RAG Indexing','AI Analysis (Featherless)']

function StatusIcon({ s }) {
  if (s === 'complete') return <CheckCircle size={10} style={{color:C.green}}/>
  if (s === 'running')  return <Loader size={10} style={{color:C.cyan}} className="animate-spin"/>
  if (s === 'error')    return <AlertCircle size={10} style={{color:C.red}}/>
  return <Clock size={10} style={{color:'#475569'}}/>
}

function ReportItem({ r, active, onClick, onDelete, onRerun }) {
  const kb = r.size_bytes ? (r.size_bytes/1024).toFixed(0) : '?'
  const statusColor = r.status==='complete' ? C.green : r.status==='error' ? C.red : C.amber
  const statusLabel = r.status==='complete' ? 'Complete' : r.status==='error' ? 'Error' : r.status
  return (
    <div onClick={onClick} className="p-2.5 rounded-xl cursor-pointer transition-all mb-2"
      style={{background: active ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
              border:`1px solid ${active ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.05)'}`,
              boxShadow: active ? '0 0 12px rgba(0,212,255,0.1)' : 'none'}}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)'}}>
            <FileText size={12} style={{color:C.red}}/>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-200 truncate">{r.filename}</div>
            <div className="text-[8px] text-slate-600 mt-0.5">{kb} KB · {r.page_count||'?'} pages</div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{background:statusColor}}/>
          {r.status==='error' && (
            <button onClick={e=>{e.stopPropagation();onRerun(r.id)}} 
              className="px-1.5 py-0.5 rounded text-[7px] font-bold"
              style={{background:'rgba(239,68,68,0.15)', color:C.red, border:'1px solid rgba(239,68,68,0.3)'}}>
              Retry
            </button>
          )}
          {active && r.status!=='error' && <button onClick={e=>{e.stopPropagation();onDelete(r.id)}} className="p-0.5 rounded hover:bg-red-500/10">
            <Trash2 size={9} style={{color:'#475569'}}/>
          </button>}
        </div>
      </div>
      {r.status!=='complete' && (
        <div className="mt-2">
          <div className="h-0.5 rounded-full" style={{background:'rgba(255,255,255,0.05)'}}>
            <div className="h-full rounded-full transition-all" style={{
              width: r.status==='processing'?'20%':r.status==='ocr'?'35%':r.status==='chunking'?'55%':r.status==='embedding'?'70%':r.status==='analyzing'?'85%':'100%',
              background:C.cyan, boxShadow:`0 0 4px ${C.cyan}60`}}/>
          </div>
          <div className="text-[8px] mt-1" style={{color:C.cyan}}>{r.status}…</div>
        </div>
      )}
      {r.uploaded_at && (
        <div className="text-[8px] text-slate-600 mt-1">{new Date(r.uploaded_at).toLocaleDateString()} · {r.uploader}</div>
      )}
    </div>
  )
}

export default function LeftPanel({ reports, activeReport, onSelect, onUpload, onDelete, onRerun, uploading, pipelineState }) {
  const fileRef = useRef()
  const active = activeReport

  const pipelineSteps = STATUS_STEPS.map((label, i) => {
    const stageMap = ['complete','ocr','chunking','embedding','analyzing','complete']
    const currentIdx = ['processing','ocr','chunking','embedding','analyzing','complete'].indexOf(active?.status || 'processing')
    const s = i < currentIdx ? 'complete' : i === currentIdx ? 'running' : 'pending'
    return {label, s}
  })

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{width:220, borderRight:`1px solid ${C.border}`, background:'rgba(4,8,15,0.9)', flexShrink:0}}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0" style={{borderBottom:`1px solid ${C.border}`}}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{color:C.cyan}}>Uploaded Reports</div>
          <div className="flex gap-1">
            <button onClick={()=>fileRef.current?.click()} disabled={uploading}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
              style={{background:'rgba(0,212,255,0.1)', border:`1px solid rgba(0,212,255,0.25)`}}>
              {uploading ? <Loader size={10} style={{color:C.cyan}} className="animate-spin"/> : <Plus size={10} style={{color:C.cyan}}/>}
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.txt,.jpg,.jpeg,.png,.docx,.bmp,.tiff"
          onChange={e => { if(e.target.files[0]) { onUpload(e.target.files[0]); e.target.value=''; }}}/>
        {!reports.length && (
          <button onClick={()=>fileRef.current?.click()} className="w-full mt-2 py-2 rounded-xl text-[9px] border-dashed border transition-all"
            style={{borderColor:'rgba(0,212,255,0.2)', color:'#475569'}}>
            + Import Autopsy Report
          </button>
        )}
      </div>

      {/* Reports list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 scroll-panel">
        {reports.map(r => (
          <ReportItem key={r.id} r={r} active={active?.id===r.id} onClick={()=>onSelect(r)} onDelete={onDelete}/>
        ))}
      </div>

      {/* Metadata */}
      {active && (
        <div className="px-3 py-2 flex-shrink-0" style={{borderTop:`1px solid ${C.border}`}}>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Report Metadata</div>
          {[
            ['Report Type', active.report_type || 'Autopsy Report'],
            ['Collected By', active.collected_by || 'Forensic Lab'],
            ['Pages', active.page_count || '?'],
            ['Language', active.language || 'English'],
            ['Integrity', active.sha256 ? '✓ Verified' : 'Pending'],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between mb-1.5">
              <span className="text-[8px] text-slate-600">{k}</span>
              <span className="text-[8px] font-mono text-slate-400 text-right" style={{maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{v}</span>
            </div>
          ))}
          {active.sha256 && (
            <div className="mt-1 p-1.5 rounded-lg" style={{background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.1)'}}>
              <div className="flex items-center gap-1 mb-0.5">
                <Shield size={8} style={{color:C.green}}/>
                <span className="text-[8px]" style={{color:C.green}}>SHA-256 Hash</span>
              </div>
              <div className="text-[7px] font-mono text-slate-600 break-all">{active.sha256.slice(0,32)}…</div>
            </div>
          )}
        </div>
      )}

      {/* Pipeline status */}
      {active && (
        <div className="px-3 py-2 flex-shrink-0" style={{borderTop:`1px solid ${C.border}`}}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Processing Status</div>
            {active.status==='complete' && (
              <button onClick={()=>onRerun(active.id)} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px]"
                style={{background:'rgba(0,212,255,0.08)', color:C.cyan}}>
                <RefreshCw size={8}/> Rerun
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {pipelineSteps.map(({label, s}, i) => (
              <div key={i} className="flex items-center gap-2">
                <StatusIcon s={s}/>
                <span className="text-[8px]" style={{color: s==='complete'?C.green : s==='running'?C.cyan : '#334155'}}>{label}</span>
                {s==='complete' && <span className="ml-auto text-[7px]" style={{color:C.green}}>✓</span>}
              </div>
            ))}
          </div>
          {active.status==='complete' && (
            <div className="mt-2 h-1 rounded-full" style={{background:'rgba(255,255,255,0.05)'}}>
              <div className="h-full rounded-full" style={{width:'100%', background:C.green, boxShadow:`0 0 6px rgba(16,185,129,0.5)`}}/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
