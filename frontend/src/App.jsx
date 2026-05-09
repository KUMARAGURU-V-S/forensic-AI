import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import CaseAnalysis from './pages/CaseAnalysis'
import Timeline from './pages/Timeline'
import EvidenceGraph from './pages/EvidenceGraph'
import RiskScoring from './pages/RiskScoring'
import Agents from './pages/Agents'
import ChainOfCustody from './pages/ChainOfCustody'
import InvestigationQuery from './pages/InvestigationQuery'
import Navbar from './components/Navbar'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0a0e1a]">
        <div className="scanline-overlay"></div>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<><Navbar /><Dashboard /></>} />
          <Route path="/case/:caseId" element={<><Navbar /><CaseAnalysis /></>} />
          <Route path="/timeline/:caseId" element={<><Navbar /><Timeline /></>} />
          <Route path="/graph/:caseId" element={<><Navbar /><EvidenceGraph /></>} />
          <Route path="/risk/:caseId" element={<><Navbar /><RiskScoring /></>} />
          <Route path="/agents" element={<><Navbar /><Agents /></>} />
          <Route path="/custody/:caseId" element={<><Navbar /><ChainOfCustody /></>} />
          <Route path="/query" element={<><Navbar /><InvestigationQuery /></>} />
        </Routes>
      </div>
    </Router>
  )
}
export default App
