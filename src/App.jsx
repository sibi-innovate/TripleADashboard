import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { DataProvider, useData } from './context/DataContext'
import { PhotoVersionProvider } from './context/PhotoVersionContext'
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
import UnitProfilePage from './pages/UnitProfilePage'
import RecognitionPage from './pages/RecognitionPage'
import SettingsPage from './pages/SettingsPage'

// Redirects to / if data is not loaded; shows nothing while Supabase is loading
function RequireData({ children }) {
  const { isLoaded, isLoading } = useData()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isLoaded) navigate('/', { replace: true })
  }, [isLoading, isLoaded, navigate])

  if (isLoading) return (
    <div className="min-h-screen bg-aia-gray flex items-center justify-center">
      <svg className="w-10 h-10 text-aia-red animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )

  if (!isLoaded) return null
  return children
}

function WithNavbar({ children }) {
  return (
    <RequireData>
      <Navbar />
      {children}
    </RequireData>
  )
}

export default function App() {
  return (
    <PhotoVersionProvider>
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/overview"        element={<WithNavbar><OverviewPage /></WithNavbar>} />
          <Route path="/leaderboard"     element={<WithNavbar><LeaderboardPage /></WithNavbar>} />
          <Route path="/monthly"         element={<Navigate to="/leaderboard" replace />} />
          <Route path="/quarterly-bonus" element={<WithNavbar><QuarterlyBonusPage /></WithNavbar>} />
          <Route path="/activation"      element={<WithNavbar><ActivationPage /></WithNavbar>} />
          <Route path="/goals"    element={<WithNavbar><TargetsPage /></WithNavbar>} />
          <Route path="/targets"  element={<Navigate to="/goals" replace />} />
          <Route path="/settings" element={<WithNavbar><SettingsPage /></WithNavbar>} />
          <Route path="/units"           element={<WithNavbar><UnitsPage /></WithNavbar>} />
          <Route path="/agents"          element={<WithNavbar><AgentsPage /></WithNavbar>} />
          <Route path="/awards"          element={<WithNavbar><AwardsPage /></WithNavbar>} />
          <Route path="/agent/:code"     element={<WithNavbar><AgentProfilePage /></WithNavbar>} />
          <Route path="/unit/:unitCode"  element={<WithNavbar><UnitProfilePage /></WithNavbar>} />
          <Route path="/recognition/*"   element={<WithNavbar><RecognitionPage /></WithNavbar>} />
          <Route path="/bulletin"        element={<Navigate to="/recognition" replace />} />
          <Route path="/highlights"      element={<Navigate to="/recognition" replace />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
    </PhotoVersionProvider>
  )
}
