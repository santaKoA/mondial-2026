import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/join')
  }

  const matchesHref = new Date() >= new Date('2026-06-11') ? '/?tab=today' : '/?tab=all'

  const desktopLinkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-green-500 text-black' : 'text-white/70 hover:text-white hover:bg-white/10'
    }`

  const mobileLinkClass = ({ isActive }) =>
    `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
      isActive ? 'text-green-400' : 'text-white/40'
    }`

  return (
    <>
      <header className="bg-pitch-800 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            <NavLink to={matchesHref} end className={desktopLinkClass}>⚽ משחקים</NavLink>
            <NavLink to="/leaderboard" className={desktopLinkClass}>🏆 טבלה</NavLink>
            <NavLink to="/special" className={desktopLinkClass}>⭐ מיוחדים</NavLink>
            {user?.is_admin && <NavLink to="/admin" className={desktopLinkClass}>🛠 ניהול</NavLink>}
          </div>

          {/* Mobile: app title */}
          <span className="sm:hidden text-sm font-bold text-white/70">⚽ מונדיאל 2026</span>

          {/* User + logout */}
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

      {/* Mobile bottom navigation */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 bg-pitch-800 border-t border-white/10 flex sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavLink to={matchesHref} end className={mobileLinkClass}>
          <span className="text-2xl">⚽</span>
          <span className="text-xs font-medium">משחקים</span>
        </NavLink>
        <NavLink to="/leaderboard" className={mobileLinkClass}>
          <span className="text-2xl">🏆</span>
          <span className="text-xs font-medium">טבלה</span>
        </NavLink>
        <NavLink to="/special" className={mobileLinkClass}>
          <span className="text-2xl">⭐</span>
          <span className="text-xs font-medium">מיוחדים</span>
        </NavLink>
        {user?.is_admin && (
          <NavLink to="/admin" className={mobileLinkClass}>
            <span className="text-2xl">🛠</span>
            <span className="text-xs font-medium">ניהול</span>
          </NavLink>
        )}
      </nav>
    </>
  )
}
