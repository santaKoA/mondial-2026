import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ChangePasswordModal from './ChangePasswordModal'

const IcBall = ({ sz = 22, c = 'currentColor' }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth="1.7"/>
    <path d="M12 2.5v4.2M12 17.3v4.2M2.5 12h4.2M17.3 12h4.2" stroke={c} strokeWidth="1.4" strokeLinecap="round" opacity=".45"/>
    <circle cx="12" cy="12" r="3.2" fill={c} opacity=".35"/>
    <path d="M7.2 7.2l3.3 3.3M13.5 13.5l3.3 3.3M16.8 7.2l-3.3 3.3M10.5 13.5l-3.3 3.3" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity=".3"/>
  </svg>
)

const IcTrophy = ({ sz = 22, c = 'currentColor' }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
    <path d="M7 3h10v7a5 5 0 01-10 0V3z" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/>
    <path d="M4 5H7M17 5h3" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M12 15v3M8.5 21h7" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M4 5c0 3 1.5 5 3 5.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" opacity=".55"/>
    <path d="M20 5c0 3-1.5 5-3 5.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" opacity=".55"/>
  </svg>
)

const IcStar = ({ sz = 22, c = 'currentColor' }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      stroke={c} strokeWidth="1.7" strokeLinejoin="round"/>
  </svg>
)

const IcWrench = ({ sz = 22, c = 'currentColor' }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
      stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showChangePw, setShowChangePw] = useState(false)

  function handleLogout() {
    logout()
    navigate('/join')
  }

  const israelDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
  const matchesHref = israelDate >= '2026-06-11' ? '/?tab=today' : '/?tab=all'

  const links = [
    { to: matchesHref, label: 'משחקים', Icon: IcBall, end: true },
    { to: '/leaderboard', label: 'טבלה',    Icon: IcTrophy },
    { to: '/special',     label: 'מיוחדים', Icon: IcStar   },
    ...(user?.is_admin ? [{ to: '/admin', label: 'ניהול', Icon: IcWrench, isAdmin: true }] : []),
  ]

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(5,12,7,.9)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{
          maxWidth: '768px', margin: '0 auto', padding: '0 16px', height: '54px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          {/* Desktop nav */}
          <nav className="desk-nav" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {links.map(({ to, label, Icon, end, isAdmin }) => (
              <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px',
                border: 'none', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: '13px', fontWeight: 500,
                textDecoration: 'none',
                background: isActive ? (isAdmin ? '#f0b429' : '#1ede62') : 'transparent',
                color: isActive ? '#000' : isAdmin ? 'rgba(240,180,40,.7)' : 'rgba(255,255,255,.55)',
                transition: 'all .15s',
              })}>
                {({ isActive }) => (
                  <>
                    <Icon sz={16} c={isActive ? '#000' : 'currentColor'} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Mobile title */}
          <span className="mob-title" style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>
            ⚽ מונדיאל 2026
          </span>

          {/* User area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="desk-name" style={{ fontSize: '13px', color: 'rgba(255,255,255,.45)' }}>
              שלום, <span style={{ color: '#fff', fontWeight: 600 }}>{user?.name}</span>
            </span>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'rgba(30,222,98,.14)', border: '1px solid rgba(30,222,98,.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: '#1ede62', flexShrink: 0,
            }}>{user?.name?.charAt(0)}</div>
            <button onClick={() => setShowChangePw(true)} title="שינוי סיסמה" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,.25)', fontSize: '15px', lineHeight: 1, transition: 'color .15s',
              padding: '10px', minWidth: '44px', minHeight: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.7)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.25)'}
            >🔑</button>
            <button onClick={handleLogout} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,.2)', fontSize: '12px', fontFamily: 'Heebo, sans-serif', transition: 'color .15s',
              padding: '10px 8px', minWidth: '44px', minHeight: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.6)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.2)'}
            >יציאה</button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="mob-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(5,12,7,.95)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,.07)',
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {links.map(({ to, label, Icon, end, isAdmin }) => (
          <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '8px 0', gap: '3px', textDecoration: 'none',
            color: isActive ? (isAdmin ? '#f0b429' : '#1ede62') : isAdmin ? 'rgba(240,180,40,.35)' : 'rgba(255,255,255,.22)',
            fontFamily: 'Heebo, sans-serif', transition: 'color .15s',
          })}>
            {({ isActive }) => (
              <>
                <Icon sz={24} c="currentColor" />
                <span style={{ fontSize: '10px', fontWeight: 600 }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </>
  )
}
