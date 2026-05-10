/**
 * Zustand global store — single source of truth for the entire forensic workspace.
 * Every component reads from here; every action writes through here.
 */
import { create } from 'zustand'
import { api } from './api'

const CONF_MAP = { 'High (>90%)': 'high', 'Medium (70-90%)': 'medium', 'Low (<70%)': 'low' }
const SEV_MAP  = { 'Critical': 'critical', 'High': 'high', 'Medium': 'medium', 'Low': 'low' }
const TYPE_MAP = { 'CCTV': 'cctv', 'Phone': 'phone', 'IoT': 'iot', 'Biometric': 'biometric',
                   'Location': 'location', 'Autopsy': 'autopsy' }

export const useForensicStore = create((set, get) => ({

  // ── Core Data ──────────────────────────────────────────────────────────────
  caseId:         'FTI-2024-0847',
  caseData:       null,
  timelineEvents: [],
  riskData:       null,
  explainData:    null,
  graphData:      null,
  chronographData:null,
  reviews:        [],
  evidenceList:   [],

  // ── Selection / Navigation ──────────────────────────────────────────────────
  selectedEvent:  null,
  activeSource:   null,
  activeTab:      'Investigation Workspace',
  activeNavId:    'timeline',   // icon nav sync
  filters: {
    timeRange: 'All Time', evidenceType: 'All Types',
    confidence: 'All',     anomalyLevel: 'All',
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    token: localStorage.getItem('forensic_token') || null,
    user:  JSON.parse(localStorage.getItem('forensic_user') || 'null'),
  },

  // ── UI Flags ──────────────────────────────────────────────────────────────
  ui: {
    loading:      false,
    uploading:    false,
    rerunning:    false,
    correlating:  false,
    searchOpen:   false,
    uploadOpen:   false,
    exportOpen:   false,
    reviewOpen:   false,
    reviewTarget: null,
    searchQuery:  '',
    searchResults:null,
    searchLoading:false,
    wsConnected:  false,
    lastAction:   null,
  },

  // ── Data Actions ────────────────────────────────────────────────────────────

  /** Fetch all case data in parallel — call on mount or case switch. */
  fetchAll: async (caseId) => {
    const id = caseId || get().caseId
    set(s => ({ ...s, caseId: id, ui: { ...s.ui, loading: true } }))
    try {
      const [caseRes, timelineRes, riskRes] = await Promise.allSettled([
        api.getCase(id),
        api.getTimeline(id),
        api.getRisk(id),
      ])
      set(s => ({
        caseData:       caseRes.status       === 'fulfilled' ? caseRes.value : s.caseData,
        timelineEvents: timelineRes.status   === 'fulfilled' ? (timelineRes.value?.events || []) : s.timelineEvents,
        riskData:       riskRes.status       === 'fulfilled' ? riskRes.value : s.riskData,
        ui: { ...s.ui, loading: false, lastAction: 'fetchAll' },
      }))
    } catch {
      set(s => ({ ui: { ...s.ui, loading: false } }))
    }
  },

  /** Fetch only the timeline, applying current filters. */
  fetchTimeline: async (extraFilters = {}) => {
    const { caseId, filters } = get()
    const merged = { ...filters, ...extraFilters }
    const apiFilters = {
      type:       TYPE_MAP[merged.evidenceType] || null,
      confidence: CONF_MAP[merged.confidence]  || null,
      severity:   SEV_MAP[merged.anomalyLevel] || null,
    }
    // Remove null values
    Object.keys(apiFilters).forEach(k => apiFilters[k] === null && delete apiFilters[k])
    try {
      const data = await api.getTimeline(caseId, apiFilters)
      set({ timelineEvents: data?.events || [] })
    } catch (e) {
      console.warn('[Store] Timeline fetch failed:', e)
    }
  },

  /** Select a timeline event — all bottom panels respond. */
  setSelectedEvent: (event) => set({ selectedEvent: event }),

  /** Toggle active evidence source filter. */
  setActiveSource: (sourceId) => {
    const current = get().activeSource
    const next = current === sourceId ? null : sourceId
    set({ activeSource: next })
    // Translate sidebar source → API type filter
    get().fetchTimeline({ type: next || null })
  },

  /** Apply sidebar filter dropdowns and re-fetch timeline. */
  applyFilters: (newFilters) => {
    set(s => ({ filters: { ...s.filters, ...newFilters } }))
    get().fetchTimeline()
  },

  // Tab → icon nav mapping
  setActiveTab: (tab) => {
    const TAB_TO_NAV = {
      'Overview':                 'dashboard',
      'Investigation Workspace':  'timeline',
      'Evidence':                 'evidence',
      'Analytics':                'graph',
      'Reports':                  'ai',
      'Chain of Custody':         'custody',
      'Settings':                 'settings',
    }
    set({ activeTab: tab, activeNavId: TAB_TO_NAV[tab] || 'timeline' })
  },

  setActiveNavId: (navId) => {
    const NAV_TO_TAB = {
      'dashboard': 'Overview',
      'cases':     'Overview',
      'evidence':  'Evidence',
      'timeline':  'Investigation Workspace',
      'graph':     'Analytics',
      'custody':   'Chain of Custody',
      'ai':        'Reports',
      'settings':  'Settings',
    }
    set({ activeNavId: navId, activeTab: NAV_TO_TAB[navId] || 'Investigation Workspace' })
  },

  // ── AI Actions ─────────────────────────────────────────────────────────────

  /** Re-run all AI agents + recompute risk. Updates risk panel. */
  rerunAI: async () => {
    const { caseId } = get()
    set(s => ({ ui: { ...s.ui, rerunning: true, lastAction: 'rerun' } }))
    try {
      const [riskRes] = await Promise.allSettled([
        api.recomputeRisk(caseId),
        api.runAgentAnalysis(caseId),
      ])
      if (riskRes.status === 'fulfilled') {
        set({ riskData: riskRes.value })
      }
    } catch (e) {
      console.warn('[Store] Re-run failed:', e)
    } finally {
      set(s => ({ ui: { ...s.ui, rerunning: false } }))
    }
  },

  /** Run auto-correlation (all 7 agents). */
  autoCorrelate: async () => {
    const { caseId } = get()
    set(s => ({ ui: { ...s.ui, correlating: true } }))
    try {
      const res = await api.autoCorrelate(caseId)
      // Update risk if consensus contains risk score
      if (res?.consensus?.risk_score) {
        set(s => ({
          riskData: s.riskData
            ? { ...s.riskData, overall_score: res.consensus.risk_score }
            : s.riskData
        }))
      }
      return res
    } catch (e) {
      console.warn('[Store] Auto-correlate failed:', e)
    } finally {
      set(s => ({ ui: { ...s.ui, correlating: false } }))
    }
  },

  /** Run full Intelligence Engine (multi-agent + cross-case + correlation) via new API */
  runIntelligenceEngine: async (reportText, evidence) => {
    set(s => ({ ui: { ...s.ui, correlating: true } }))
    try {
      const res = await api.runMultiAgent(reportText, evidence, get().caseId)
      // Update risk data from intelligence results
      if (res?.riskScore) {
        set(s => ({
          riskData: s.riskData
            ? { ...s.riskData, overall_score: res.riskScore, severity: res.riskLevel }
            : { overall_score: res.riskScore, severity: res.riskLevel, components: [] }
        }))
      }
      return res
    } catch (e) {
      console.warn('[Store] Intelligence engine failed:', e)
    } finally {
      set(s => ({ ui: { ...s.ui, correlating: false } }))
    }
  },

  /** Run cross-case intelligence matching */
  runCrossCaseMatch: async (signature) => {
    try {
      return await api.runCrossCase(signature)
    } catch (e) {
      console.warn('[Store] Cross-case failed:', e)
      return null
    }
  },

  /** AI Chat with GraphRAG */
  chatWithAI: async (messages) => {
    try {
      return await api.chatAI(messages)
    } catch (e) {
      console.warn('[Store] AI Chat failed:', e)
      return { response: 'AI Chat unavailable. Check LLM provider settings.', meta: {} }
    }
  },

  /** Analyze report with full NLP + LLM + GraphRAG */
  analyzeWithGraphRAG: async (text) => {
    try {
      return await api.analyzeReport(text)
    } catch (e) {
      console.warn('[Store] Analyze failed:', e)
      return null
    }
  },

  // ── Upload ─────────────────────────────────────────────────────────────────

  /** Upload a file as evidence. Refreshes case data after. */
  uploadEvidence: async (evidenceType, file) => {
    const { caseId, auth } = get()
    set(s => ({ ui: { ...s.ui, uploading: true } }))
    try {
      const result = await api.uploadEvidence(
        caseId, evidenceType, file,
        auth.user?.username || 'investigator'
      )
      // Refresh data after upload
      await get().fetchAll(caseId)
      return result
    } catch (e) {
      console.warn('[Store] Upload failed:', e)
      throw e
    } finally {
      set(s => ({ ui: { ...s.ui, uploading: false } }))
    }
  },

  // ── Review ─────────────────────────────────────────────────────────────────

  submitReview: async (reviewData) => {
    const { caseId } = get()
    try {
      const result = await api.submitReview(caseId, reviewData)
      // Append to local reviews
      set(s => ({ reviews: [result, ...s.reviews] }))
      return result
    } catch (e) {
      console.warn('[Store] Review failed:', e)
      throw e
    }
  },

  fetchReviews: async () => {
    const { caseId } = get()
    try {
      const data = await api.getReviews(caseId)
      set({ reviews: data.reviews || [] })
    } catch {}
  },

  // ── Search ─────────────────────────────────────────────────────────────────

  search: async (query) => {
    const { caseId } = get()
    set(s => ({ ui: { ...s.ui, searchQuery: query, searchLoading: true, searchResults: null } }))
    try {
      const result = await api.query(query, caseId)
      set(s => ({ ui: { ...s.ui, searchResults: result, searchLoading: false } }))
      return result
    } catch (e) {
      set(s => ({ ui: { ...s.ui, searchLoading: false } }))
      throw e
    }
  },

  // ── Auth ──────────────────────────────────────────────────────────────────

  login: async (username, password) => {
    const data = await api.login(username, password)
    localStorage.setItem('forensic_token', data.access_token)
    localStorage.setItem('forensic_user', JSON.stringify(data.user))
    set({ auth: { token: data.access_token, user: data.user } })
    return data
  },

  logout: () => {
    localStorage.removeItem('forensic_token')
    localStorage.removeItem('forensic_user')
    set({ auth: { token: null, user: null } })
  },

  // ── UI Helpers ─────────────────────────────────────────────────────────────

  openUpload:  ()       => set(s => ({ ui: { ...s.ui, uploadOpen: true } })),
  closeUpload: ()       => set(s => ({ ui: { ...s.ui, uploadOpen: false } })),
  openSearch:  ()       => set(s => ({ ui: { ...s.ui, searchOpen: true } })),
  closeSearch: ()       => set(s => ({ ui: { ...s.ui, searchOpen: false } })),
  openExport:  ()       => set(s => ({ ui: { ...s.ui, exportOpen: true } })),
  closeExport: ()       => set(s => ({ ui: { ...s.ui, exportOpen: false } })),
  openReview:  (target) => set(s => ({ ui: { ...s.ui, reviewOpen: true,  reviewTarget: target } })),
  closeReview: ()       => set(s => ({ ui: { ...s.ui, reviewOpen: false, reviewTarget: null } })),
  setWsConnected: (v)   => set(s => ({ ui: { ...s.ui, wsConnected: v } })),
}))
