import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DataProvider } from './context/DataContext'
import Navbar from './components/Navbar'
import UploadPage from './pages/UploadPage'
import OverviewPage from './pages/OverviewPage'
import LeaderboardPage from './pages/LeaderboardPage'
import QuarterlyBonusPage from './pages/QuarterlyBonusPage'
import UnitsPage from './pages/UnitsPage'
import AgentsPage from './pages/AgentsPage'
import ActivationPage from './pages/ActivationPage'
import TargetsPage from './pages/TargetsPage'
import AwardsPage from './pages/AwardsPage'
import AgentProfilePage from './pages/AgentProfilePage'
import BulletinPage from './pages/BulletinPage'
import HighlightsPage from './pages/HighlightsPage'

function WithNavbar({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/overview" element={<WithNavbar><OverviewPage /></WithNavbar>} />
          <Route path="/leaderboard" element={<WithNavbar><LeaderboardPage /></WithNavbar>} />
          <Route path="/monthly"         element={<Navigate to="/leaderboard" replace />} />
          <Route path="/quarterly-bonus" element={<WithNavbar><QuarterlyBonusPage /></WithNavbar>} />
          <Route path="/activation" element={<WithNavbar><ActivationPage /></WithNavbar>} />
          <Route path="/targets" element={<WithNavbar><TargetsPage /></WithNavbar>} />
          <Route path="/units" element={<WithNavbar><UnitsPage /></WithNavbar>} />
          <Route path="/agents" element={<WithNavbar><AgentsPage /></WithNavbar>} />
          <Route path="/awards" element={<WithNavbar><AwardsPage /></WithNavbar>} />
          <Route path="/agent/:code" element={<WithNavbar><AgentProfilePage /></WithNavbar>} />
          <Route path="/bulletin" element={<WithNavbar><BulletinPage /></WithNavbar>} />
          <Route path="/highlights" element={<WithNavbar><HighlightsPage /></WithNavbar>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  )
}
