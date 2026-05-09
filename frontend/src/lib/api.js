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
}
