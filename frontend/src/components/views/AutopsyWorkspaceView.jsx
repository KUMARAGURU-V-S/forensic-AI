/**
 * AutopsyWorkspaceView — Forensic Autopsy Intelligence Workspace
 * Slots into InvestigationWorkspace as nav='autopsy'.
 * 4-panel layout: Left | Center | Right | Bottom
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useForensicStore } from '../../lib/store'
import { api } from '../../lib/api'

import LeftPanel   from './autopsy/LeftPanel'
import CenterPanel from './autopsy/CenterPanel'
import RightPanel  from './autopsy/RightPanel'
import BottomPanel from './autopsy/BottomPanel'

export default function AutopsyWorkspaceView() {
  const { caseId } = useForensicStore()

  const [reports,       setReports]       = useState([])
  const [activeReport,  setActiveReport]  = useState(null)
  const [uploading,     setUploading]     = useState(false)
  const [pollTimer,     setPollTimer]     = useState(null)
  const pollRef = useRef(null)

  // ── Load reports on mount ───────────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    try {
      const data = await api.listAutopsyReports(caseId)
      const list = data.reports || []
      setReports(list)
      // If active report updated, refresh it
      setActiveReport(prev => {
        if (!prev) return list[0] || null
        const updated = list.find(r => r.id === prev.id)
        return updated || prev
      })
    } catch (e) {
      console.warn('[AutopsyWorkspace] Could not load reports:', e)
    }
  }, [caseId])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  // ── Poll while any report is processing ─────────────────────────────────────
  useEffect(() => {
    const anyProcessing = reports.some(r => r.status !== 'complete' && r.status !== 'error')
    if (anyProcessing) {
      const t = setInterval(loadReports, 2500)
      pollRef.current = t
      return () => clearInterval(t)
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [reports, loadReports])

  // ── Upload handler ──────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    setUploading(true)
    try {
      const res = await api.uploadAutopsyReport(caseId, file)
      // Immediately add placeholder
      const placeholder = {
        id: res.report_id, case_id: caseId, filename: file.name,
        size_bytes: file.size, status: 'processing', ocr_status: 'pending',
        page_count: 0, sha256: res.sha256, uploaded_at: new Date().toISOString(),
        uploader: 'investigator', structured_json: null, ocr_text: null,
      }
      setReports(prev => [placeholder, ...prev])
      setActiveReport(placeholder)
      // Start polling
      loadReports()
    } catch (e) {
      console.error('[AutopsyWorkspace] Upload failed:', e)
      alert('Upload failed: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────────
  const handleDelete = async (reportId) => {
    try {
      await api.deleteAutopsyReport(caseId, reportId)
      setReports(prev => prev.filter(r => r.id !== reportId))
      setActiveReport(prev => prev?.id === reportId ? null : prev)
    } catch (e) {
      console.warn('[AutopsyWorkspace] Delete failed:', e)
    }
  }

  // ── Re-run handler ──────────────────────────────────────────────────────────
  const handleRerun = async (reportId) => {
    try {
      await api.rerunAutopsyReport(caseId, reportId)
      setReports(prev => prev.map(r => r.id===reportId ? {...r, status:'processing', structured_json:null} : r))
      setActiveReport(prev => prev?.id===reportId ? {...prev, status:'processing', structured_json:null} : prev)
    } catch (e) {
      console.warn('[AutopsyWorkspace] Rerun failed:', e)
    }
  }

  // ── Select report ───────────────────────────────────────────────────────────
  const handleSelect = async (report) => {
    setActiveReport(report)
    // Fetch full detail if complete
    if (report.status === 'complete' && !report.ocr_text) {
      try {
        const full = await api.getAutopsyReport(caseId, report.id)
        setActiveReport(full)
        setReports(prev => prev.map(r => r.id===report.id ? full : r))
      } catch {}
    }
  }

  // ── RAG query ───────────────────────────────────────────────────────────────
  const handleQuery = async (question) => {
    if (!activeReport) return
    return api.queryAutopsyReport(caseId, activeReport.id, question)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{background:'rgba(4,8,18,0.97)'}}>
      {/* Page header */}
      <div className="flex items-center px-5 py-2.5 flex-shrink-0"
        style={{borderBottom:'1px solid rgba(0,212,255,0.08)', background:'rgba(4,8,15,0.95)'}}>
        <div>
          <h1 className="text-[13px] font-black text-slate-100">Autopsy Analysis</h1>
          <p className="text-[9px] font-mono mt-0.5" style={{color:'#475569'}}>
            AI-powered forensic autopsy intelligence · Featherless AI · RAG Pipeline
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{background:'#10b981', boxShadow:'0 0 6px rgba(16,185,129,0.6)'}}/>
            <span className="text-[9px]" style={{color:'#10b981'}}>Featherless AI · RAG Active</span>
          </div>
          <div className="text-[9px] font-mono px-2 py-1 rounded-lg"
            style={{background:'rgba(0,212,255,0.06)', border:'1px solid rgba(0,212,255,0.15)', color:'#00d4ff'}}>
            {reports.length} Report{reports.length!==1?'s':''} · {caseId}
          </div>
        </div>
      </div>

      {/* Main body: Left + Center + Right */}
      <div className="flex flex-1 min-h-0">
        <LeftPanel
          reports={reports}
          activeReport={activeReport}
          onSelect={handleSelect}
          onUpload={handleUpload}
          onDelete={handleDelete}
          onRerun={handleRerun}
          uploading={uploading}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <CenterPanel
            report={activeReport}
            onEntityClick={(text, kind) => {}}
            onRetry={handleRerun}
          />
        </div>
        <RightPanel
          report={activeReport}
          onQuery={handleQuery}
        />
      </div>

      {/* Bottom panel */}
      <BottomPanel report={activeReport} />
    </div>
  )
}
