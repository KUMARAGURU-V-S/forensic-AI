import { useEffect, Suspense, lazy } from 'react'
import { useParams } from 'react-router-dom'
import { useForensicStore } from '../lib/store'
import { connectWS } from '../lib/websocket'

// Layout shell (always visible)
import TopHeader       from '../components/layout/TopHeader'
import IconNav         from '../components/layout/IconNav'
import EvidenceSidebar from '../components/layout/EvidenceSidebar'
import AIAnalysisPanel from '../components/layout/AIAnalysisPanel'

// Timeline view (default center)
import ForensicTimeline from '../components/timeline/ForensicTimeline'

// Bottom panels
import EventDetailsPanel     from '../components/panels/EventDetailsPanel'
import EvidencePreviewPlayer from '../components/panels/EvidencePreviewPlayer'
import ExtractedInfoPanel    from '../components/panels/ExtractedInfoPanel'

// ── Inline views (instantaneous, no lazy-load) ─────────────────────────────
import EvidenceView      from '../components/views/EvidenceView'
import SettingsView      from '../components/views/SettingsView'
import CasesView         from '../components/views/CasesView'
import ChainOfCustodyView from '../components/views/ChainOfCustodyView'
import AIModulesView     from '../components/views/AIModulesView'
import AutopsyWorkspaceView from '../components/views/AutopsyWorkspaceView'

// ── Lazy-load heavier pages ────────────────────────────────────────────────
const ForensicCommandDashboard = lazy(() => import('./ForensicCommandDashboard'))
const EvidenceGraphPage        = lazy(() => import('./EvidenceGraph'))
const RiskScoringPage          = lazy(() => import('./RiskScoring'))

const DEFAULT_CASE = 'FTI-2024-0847'
const BOTTOM_H     = 220

const Spinner = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <div className="w-7 h-7 rounded-full border-2 animate-spin mx-auto mb-3"
        style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
      <div className="text-[11px] font-mono text-slate-500">Loading…</div>
    </div>
  </div>
)

/** Wrap a page in a scrollable dark container for embedded use */
const EmbeddedPage = ({ children }) => (
  <div className="h-full overflow-y-auto" style={{ background: 'rgba(4,8,18,0.97)' }}>
    {children}
  </div>
)

export default function InvestigationWorkspace() {
  const { caseId: paramId } = useParams()
  const caseId = paramId || DEFAULT_CASE

  const {
    fetchAll, setSelectedEvent, setActiveTab, setActiveNavId,
    timelineEvents, selectedEvent, activeSource, activeTab, activeNavId, ui,
    caseData, openSearch, openExport,
  } = useForensicStore()

  useEffect(() => { fetchAll(caseId) }, [caseId])

  useEffect(() => {
    try { connectWS(caseId, { getState: useForensicStore.getState }) } catch {}
  }, [caseId])

  const todTs = caseData?.autopsy_report?.time_of_death?.estimated
  const nav   = activeNavId || 'timeline'

  // ── Route resolver ─────────────────────────────────────────────────────────
  // Returns the JSX for the current view, or null for the default timeline workspace.
  function getView() {
    switch (nav) {
      case 'dashboard':
        return (
          <Suspense fallback={<Spinner />}>
            <EmbeddedPage><ForensicCommandDashboard /></EmbeddedPage>
          </Suspense>
        )
      case 'cases':
        return <CasesView />

      case 'evidence':
        return <EvidenceView caseId={caseId} />

      case 'graph':
        return (
          <Suspense fallback={<Spinner />}>
            <EmbeddedPage><EvidenceGraphPage /></EmbeddedPage>
          </Suspense>
        )

      case 'custody':
        return <ChainOfCustodyView />

      case 'ai':
        return <AIModulesView />

      case 'autopsy':
        return <AutopsyWorkspaceView />

      case 'settings':
        return <SettingsView caseId={caseId} />

      case 'timeline':
      default:
        return null // renders timeline workspace below
    }
  }

  const view = getView()
  const isTimeline = view === null

  return (
    <div className="flex flex-col grid-bg" style={{ height: '100vh', overflow: 'hidden' }}>

      {/* ── Top Header ─────────────────────────────────────────────── */}
      <TopHeader
        caseId={caseId}
        caseData={caseData}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSearch={openSearch}
        onExport={openExport}
      />

      {/* ── Main Body ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Icon Sidebar — wired to store */}
        <IconNav activeId={nav} onChange={setActiveNavId} />

        {!isTimeline ? (
          /* ── Full-panel views ──────────────────────────────────── */
          <div className="flex-1 min-w-0 overflow-hidden">
            {view}
          </div>

        ) : (
          /* ── Timeline Workspace (default) ─────────────────────── */
          <>
            <EvidenceSidebar />

            <div className="flex flex-col flex-1 min-w-0">
              {/* Timeline */}
              <div className="flex-1 min-h-0">
                {ui.loading ? <Spinner /> : (
                  <ForensicTimeline
                    events={timelineEvents}
                    todTimestamp={todTs}
                    onEventClick={setSelectedEvent}
                    activeSource={activeSource}
                  />
                )}
              </div>

              {/* Bottom three panels */}
              <div className="flex flex-shrink-0"
                style={{ height: BOTTOM_H, borderTop: '1px solid rgba(0,212,255,0.08)' }}>
                <div className="flex-1 min-w-0"
                  style={{ background: 'rgba(5,10,22,0.85)', borderRight: '1px solid rgba(0,212,255,0.08)' }}>
                  <EventDetailsPanel event={selectedEvent} />
                </div>
                <div className="flex-1 min-w-0"
                  style={{ background: 'rgba(4,8,16,0.9)', borderRight: '1px solid rgba(0,212,255,0.08)' }}>
                  <EvidencePreviewPlayer event={selectedEvent} />
                </div>
                <div className="flex-1 min-w-0" style={{ background: 'rgba(5,10,22,0.85)' }}>
                  <ExtractedInfoPanel event={selectedEvent} />
                </div>
              </div>
            </div>

            <AIAnalysisPanel />
          </>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <ModalLayer />
    </div>
  )
}

function ModalLayer() {
  const UploadEvidenceModal = lazy(() => import('../components/modals/UploadEvidenceModal'))
  const SearchResultsModal  = lazy(() => import('../components/modals/SearchResultsModal'))
  const ExportModal         = lazy(() => import('../components/modals/ExportModal'))
  const ReviewModal         = lazy(() => import('../components/modals/ReviewModal'))
  return (
    <Suspense fallback={null}>
      <UploadEvidenceModal />
      <SearchResultsModal />
      <ExportModal />
      <ReviewModal />
    </Suspense>
  )
}
