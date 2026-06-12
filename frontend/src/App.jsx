import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Header from './components/Header'
import JoinPage from './pages/JoinPage'
import MatchesPage from './pages/MatchesPage'
import LeaderboardPage from './pages/LeaderboardPage'
import SpecialPredictionsPage from './pages/SpecialPredictionsPage'
import UserProfilePage from './pages/UserProfilePage'
import AdminPage from './pages/AdminPage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050c07' }}><div style={{ color: '#1ede62', fontSize: '1.5rem' }}>⚽ טוען...</div></div>
  if (!user) return <Navigate to="/join" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user?.is_admin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050c07' }}>
        <div style={{ fontSize: '2rem', animation: 'pulse 1.5s infinite' }}>⚽</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pitch-900">
      {user && <Header />}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-28 sm:pb-8">
        <Routes>
          <Route path="/join" element={user ? <Navigate to="/" replace /> : <JoinPage />} />
          <Route path="/" element={<PrivateRoute><MatchesPage /></PrivateRoute>} />
          <Route path="/leaderboard" element={<PrivateRoute><LeaderboardPage /></PrivateRoute>} />
          <Route path="/special" element={<PrivateRoute><SpecialPredictionsPage /></PrivateRoute>} />
          <Route path="/user/:userId" element={<PrivateRoute><UserProfilePage /></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
