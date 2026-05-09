import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import InvestigationWorkspace from './pages/InvestigationWorkspace'
import Login from './pages/Login'

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/login"                element={<Login />} />
        {/* Main workspace */}
        <Route path="/workspace/:caseId"    element={<InvestigationWorkspace />} />
        <Route path="/workspace"            element={<InvestigationWorkspace />} />
        {/* Default redirect */}
        <Route path="/"                     element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
        <Route path="/dashboard"            element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
        {/* Legacy routes */}
        <Route path="/case/:caseId"         element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
        <Route path="/timeline/:caseId"     element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
        <Route path="/risk/:caseId"         element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
        <Route path="/graph/:caseId"        element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
        <Route path="/agents"               element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
        <Route path="/custody/:caseId"      element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
        <Route path="/query"                element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
        {/* Catch-all */}
        <Route path="*"                     element={<Navigate to="/workspace/FTI-2024-0847" replace />} />
      </Routes>
    </Router>
  )
}

export default App
