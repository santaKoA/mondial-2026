import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/join')
  }

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-green-500 text-black' : 'text-white/70 hover:text-white hover:bg-white/10'
    }`

  return (
    <header className="bg-pitch-800 border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 flex-wrap">
          <NavLink to="/" className={linkClass}>⚽ משחקים</NavLink>
          <NavLink to="/leaderboard" className={linkClass}>🏆 טבלה</NavLink>
          <NavLink to="/special" className={linkClass}>⭐ מיוחדים</NavLink>
          {user?.is_admin && <NavLink to="/admin" className={linkClass}>🛠 ניהול</NavLink>}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-white/60 hidden sm:block">
            שלום, <span className="text-white font-medium">{user?.name}</span>
          </span>
          <button onClick={handleLogout} className="text-white/40 hover:text-white text-xs transition-colors">
            יציאה
          </button>
        </div>
      </div>
    </header>
  )
}
