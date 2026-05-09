/**
 * Updated API client — adds all new backend endpoints.
 * Uses /api prefix (proxied by Vite dev server → localhost:8000).
 */

const API_BASE = '/api'

function _token() {
  return localStorage.getItem('forensic_token') || ''
}

function _authHeaders() {
  const t = _token()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function fetchAPI(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ..._authHeaders(),
        ...options.headers,
      },
      ...options,
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`API ${res.status}: ${endpoint} — ${err}`)
    }
    return res.json()
  } catch (e) {
    console.warn('[API]', e.message)
    throw e
  }
}

export const api = {
  // ── Core ──────────────────────────────────────────────────────
  getHealth:           ()            => fetchAPI('/health'),
  getStatus:           ()            => fetchAPI('/api/status'),

  // ── Auth ──────────────────────────────────────────────────────
  login:               (u, p)        => fetchAPI('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  register:            (body)        => fetchAPI('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  getMe:               ()            => fetchAPI('/auth/me'),

  // ── Cases ─────────────────────────────────────────────────────
  getCases:            ()            => fetchAPI('/cases/'),
  getCase:             (id)          => fetchAPI(`/cases/${id}`),
  createCase:          (body)        => fetchAPI('/cases/', { method: 'POST', body: JSON.stringify(body) }),
  updateCase:          (id, body)    => fetchAPI(`/cases/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  addSuspect:          (id, body)    => fetchAPI(`/cases/${id}/suspects`, { method: 'POST', body: JSON.stringify(body) }),
  getCaseSummary:      (id)          => fetchAPI(`/cases/${id}/summary`),

  // ── Timeline ──────────────────────────────────────────────────
  getTimeline:         (id, filters) => {
    const params = new URLSearchParams()
    if (filters?.type)       params.set('type', filters.type)
    if (filters?.confidence) params.set('confidence', filters.confidence)
    if (filters?.severity)   params.set('severity', filters.severity)
    if (filters?.from_ts)    params.set('from_ts', filters.from_ts)
    if (filters?.to_ts)      params.set('to_ts', filters.to_ts)
    const qs = params.toString()
    return fetchAPI(`/timeline/${id}${qs ? '?' + qs : ''}`)
  },
  addTimelineEvent:    (id, body)    => fetchAPI(`/timeline/${id}/event`, { method: 'POST', body: JSON.stringify(body) }),

  // ── Risk ──────────────────────────────────────────────────────
  getRisk:             (id)          => fetchAPI(`/risk/${id}`),
  recomputeRisk:       (id)          => fetchAPI(`/risk/${id}/recompute`, { method: 'POST' }),

  // ── Analysis ──────────────────────────────────────────────────
  analyzeAutopsy:      (id)          => fetchAPI(`/analysis/autopsy/${id}`),
  estimateTOD:         (id)          => fetchAPI(`/analysis/tod/${id}`),
  getExplainability:   (id)          => fetchAPI(`/analysis/explainability/${id}`),
  rerunAnalysis:       (id)          => fetchAPI(`/analysis/rerun/${id}`, { method: 'POST' }),

  // ── Graph ─────────────────────────────────────────────────────
  getGraph:            (id)          => fetchAPI(`/graph/${id}`),

  // ── Agents ────────────────────────────────────────────────────
  getAgentsStatus:     ()            => fetchAPI('/agents/status'),
  runAgentAnalysis:    (id)          => fetchAPI(`/agents/analysis/${id}`),
  autoCorrelate:       (id)          => fetchAPI(`/agents/analysis/${id}`),

  // ── Upload ────────────────────────────────────────────────────
  uploadEvidence: async (caseId, evidenceType, file, uploader = 'investigator') => {
    const form = new FormData()
    form.append('file', file)
    form.append('evidence_type', evidenceType)
    form.append('uploader', uploader)
    const res = await fetch(`${API_BASE}/upload/${caseId}`, {
      method: 'POST',
      headers: _authHeaders(),
      body: form,
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  },
  listEvidence:        (id)          => fetchAPI(`/upload/${id}`),

  // ── Review ────────────────────────────────────────────────────
  submitReview:        (id, body)    => fetchAPI(`/review/${id}/action`, { method: 'POST', body: JSON.stringify(body) }),
  getReviews:          (id)          => fetchAPI(`/review/${id}`),
  getAuditTrail:       (id)          => fetchAPI(`/review/${id}/audit`),

  // ── Export ────────────────────────────────────────────────────
  getReportUrl:        (id)          => `${API_BASE}/export/${id}/report`,
  getManifestUrl:      (id)          => `${API_BASE}/export/${id}/manifest`,
  getCustodyUrl:       (id)          => `${API_BASE}/export/${id}/custody`,

  // ── Query ─────────────────────────────────────────────────────
  query:               (q, caseId)   => fetchAPI('/query/', { method: 'POST', body: JSON.stringify({ question: q, case_id: caseId }) }),
  getQuerySuggestions: ()            => fetchAPI('/query/suggestions'),

  // ── Custody ───────────────────────────────────────────────────
  getChainOfCustody:   (id)          => fetchAPI(`/custody/${id}`),
  verifyCustody:       (id)          => fetchAPI(`/custody/${id}/verify`),

  // ── Autopsy Intelligence ───────────────────────────────────────────────────
  uploadAutopsyReport: async (caseId, file, uploader = 'investigator') => {
    const form = new FormData()
    form.append('file', file)
    form.append('uploader', uploader)
    const res = await fetch(`${API_BASE}/autopsy/upload/${caseId}`, {
      method: 'POST',
      headers: _authHeaders(),
      body: form,
    })
    if (!res.ok) throw new Error(`Autopsy upload failed: ${res.status}`)
    return res.json()
  },
  listAutopsyReports:  (caseId)               => fetchAPI(`/autopsy/${caseId}/reports`),
  getAutopsyReport:    (caseId, reportId)      => fetchAPI(`/autopsy/${caseId}/report/${reportId}`),
  queryAutopsyReport:  (caseId, reportId, q)   => fetchAPI(`/autopsy/${caseId}/report/${reportId}/query`,
                                                           { method: 'POST', body: JSON.stringify({ question: q }) }),
  rerunAutopsyReport:  (caseId, reportId)      => fetchAPI(`/autopsy/${caseId}/report/${reportId}/rerun`,
                                                           { method: 'POST' }),
  deleteAutopsyReport: (caseId, reportId)      => fetchAPI(`/autopsy/${caseId}/report/${reportId}`,
                                                           { method: 'DELETE' }),
  analyzeAutopsyText:  (text, caseId)          => fetchAPI('/autopsy/analyze-text',
                                                           { method: 'POST', body: JSON.stringify({ text, case_id: caseId }) }),

  // ══════════════════════════════════════════════════════════════════════════
  // NEW APIs — Ported from forensix-ai-nextjs (100% feature transfer)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Intelligence Engine (Multi-Agent, Cross-Case, Query, Custody) ──────
  runIntelligence:     (action, body = {}) => fetchAPI('/api/intelligence/', { method: 'POST', body: JSON.stringify({ action, ...body }) }),
  runMultiAgent:       (reportText, evidence, caseId) => fetchAPI('/api/intelligence/', { method: 'POST', body: JSON.stringify({ action: 'multi-agent', reportText, evidence, caseId }) }),
  runCrossCase:        (signature)         => fetchAPI('/api/intelligence/', { method: 'POST', body: JSON.stringify({ action: 'cross-case', signature }) }),
  runDualTod:          (params)            => fetchAPI('/api/intelligence/', { method: 'POST', body: JSON.stringify({ action: 'dual-tod', params }) }),
  runCorrelation:      (evidence)          => fetchAPI('/api/intelligence/', { method: 'POST', body: JSON.stringify({ action: 'correlate', evidence }) }),
  runPrioritize:       (findings)          => fetchAPI('/api/intelligence/', { method: 'POST', body: JSON.stringify({ action: 'prioritize', findings }) }),
  runNLQuery:          (query, findings)   => fetchAPI('/api/intelligence/', { method: 'POST', body: JSON.stringify({ action: 'query', query, findings }) }),
  addCustodyEntry:     (evidenceId, content, actor, action) => fetchAPI('/api/intelligence/', { method: 'POST', body: JSON.stringify({ action: 'custody-add', evidenceId, content, actor, custodyAction: action }) }),
  verifyCustodyChain:  ()                  => fetchAPI('/api/intelligence/', { method: 'POST', body: JSON.stringify({ action: 'custody-verify' }) }),

  // ── AI Chat (GraphRAG-enhanced) ────────────────────────────────────────
  chatAI:              (messages, provider = null) => fetchAPI('/api/chat/', { method: 'POST', body: JSON.stringify({ messages, provider }) }),

  // ── ML Pipeline (HuggingFace Inference) ─────────────────────────────────
  runNER:              (text)              => fetchAPI('/api/ml/', { method: 'POST', body: JSON.stringify({ task: 'ner', text }) }),
  classifyText:        (text, labels)      => fetchAPI('/api/ml/', { method: 'POST', body: JSON.stringify({ task: 'classify', text, labels }) }),
  getEmbeddings:       (text)             => fetchAPI('/api/ml/', { method: 'POST', body: JSON.stringify({ task: 'embeddings', text }) }),
  forensicClassify:    (text)             => fetchAPI('/api/ml/', { method: 'POST', body: JSON.stringify({ task: 'forensic-classify', text }) }),

  // ── Analyze (Full NLP + LLM + GraphRAG) ─────────────────────────────────
  analyzeReport:       (text, caseTitle)   => fetchAPI('/api/analyze/', { method: 'POST', body: JSON.stringify({ text, caseTitle }) }),
  analyzeTOD:          (params)            => fetchAPI('/api/analyze/', { method: 'POST', body: JSON.stringify({ type: 'tod', params }) }),

  // ── GraphRAG Knowledge Base ─────────────────────────────────────────────
  retrieveKnowledge:   (query, count = 5)  => fetchAPI('/api/graphrag/retrieve', { method: 'POST', body: JSON.stringify({ query, count }) }),
  seedKnowledge:       ()                  => fetchAPI('/api/graphrag/seed', { method: 'POST' }),
  getKnowledgeStats:   ()                  => fetchAPI('/api/graphrag/stats'),

  // ── Triage Stream (SSE) ────────────────────────────────────────────────
  getTriageStreamUrl:  ()                  => `${API_BASE}/api/triage/stream`,

  // ── LangGraph Investigation (SSE streaming) ────────────────────────────
  getLangGraphStatus:  ()                  => fetchAPI('/api/investigate/status'),

  /**
   * Stream a full 8-agent LangGraph investigation.
   * onEvent(event) is called for each SSE event object.
   * Returns a function to abort the stream.
   */
  streamInvestigation: (payload, onEvent) => {
    const controller = new AbortController()
    const run = async () => {
      onEvent?.({ type: 'connection', state: 'connecting' })
      const res = await fetch(`${API_BASE}/api/investigate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._authHeaders() },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Investigate stream ${res.status}`)
      onEvent?.({ type: 'connection', state: 'open', status: res.status })
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { onEvent(JSON.parse(line.slice(6))) } catch { /* skip bad json */ }
          }
        }
      }
      onEvent?.({ type: 'connection', state: 'closed' })
    }
    run().catch(e => {
      if (e.name !== 'AbortError') {
        onEvent?.({ type: 'connection', state: 'error', error: e.message })
        onEvent({ type: 'error', error: e.message })
      }
    })
    return () => controller.abort()
  },

  /**
   * Resume an interrupted investigation (human-in-the-loop).
   * response: "approve" | "reject" | "escalate"
   */
  resumeInvestigation: (threadId, response, onEvent) => {
    const controller = new AbortController()
    const run = async () => {
      onEvent?.({ type: 'connection', state: 'connecting' })
      const res = await fetch(`${API_BASE}/api/investigate/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._authHeaders() },
        body: JSON.stringify({ thread_id: threadId, response }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Resume ${res.status}`)
      onEvent?.({ type: 'connection', state: 'open', status: res.status })
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { onEvent(JSON.parse(line.slice(6))) } catch { /* skip */ }
          }
        }
      }
      onEvent?.({ type: 'connection', state: 'closed' })
    }
    run().catch(e => {
      if (e.name !== 'AbortError') {
        onEvent?.({ type: 'connection', state: 'error', error: e.message })
        onEvent({ type: 'error', error: e.message })
      }
    })
    return () => controller.abort()
  },

  getInvestigationState: (threadId) =>
    fetchAPI('/api/investigate/state', { method: 'POST', body: JSON.stringify({ thread_id: threadId }) }),

  /** Extract plain text from a PDF file using server-side pdfplumber. */
  extractPdfText: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${API_BASE}/api/investigate/extract-pdf`, {
      method: 'POST',
      headers: _authHeaders(),
      body: fd,
    })
    if (!res.ok) throw new Error(`PDF extraction ${res.status}`)
    return res.json()
  },
}
