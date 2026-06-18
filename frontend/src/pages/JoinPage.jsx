import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api'
import { useAuth } from '../context/AuthContext'

// ─── Styles (outside component so they're stable references) ─────────────────
const inputStyle = {
  width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.14)',
  borderRadius: '10px', padding: '12px 14px', color: '#ecf0ed',
  fontFamily: 'Heebo, sans-serif', fontSize: '15px',
  outline: 'none', transition: 'border-color .15s', boxSizing: 'border-box',
}

const btnPrimary = {
  width: '100%', padding: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer',
  background: '#1ede62', color: '#000', fontFamily: 'Heebo, sans-serif',
  fontSize: '15px', fontWeight: 700, boxShadow: '0 2px 18px rgba(30,222,98,.2)',
}

function fieldWrap(label, input) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,.35)', marginBottom: '6px', fontWeight: 500 }}>{label}</label>
      {input}
    </div>
  )
}

// ─── FormCard defined OUTSIDE JoinPage so it never remounts on state change ──
function FormCard({ title, fields, cta, onSubmit, loading, onBack }) {
  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', paddingBottom: '40px' }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.35)',
        fontSize: '13px', fontFamily: 'Heebo, sans-serif', marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>← חזור</button>
      <div style={{
        background: '#0c1810', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '24px',
        boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 28px rgba(0,0,0,.5)',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '22px' }}>{title}</h2>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {fields}
          <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>{cta}</button>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function JoinPage() {
  const [mode, setMode] = useState(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastUser, setLastUser] = useState(null)
  const [quickPassword, setQuickPassword] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  function loginDest() {
    const israelDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
    return israelDate >= '2026-06-11' ? '/?tab=today' : '/?tab=all'
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mondial_last_user')
      if (stored) setLastUser(JSON.parse(stored))
    } catch {
      localStorage.removeItem('mondial_last_user')
    }
  }, [])

  function clearLastUser() {
    localStorage.removeItem('mondial_last_user')
    setLastUser(null)
  }

  async function handleQuickLogin(e) {
    e.preventDefault()
    if (!quickPassword.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', {
        name: lastUser.name,
        password: quickPassword,
      })
      login(data.token, data.user)
      toast.success(`ברוך הבא, ${data.user.name}! ⚽`)
      navigate(loginDest())
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!name.trim() || !password.trim()) return
    if (password !== confirmPassword) { toast.error('הסיסמאות אינן תואמות'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/register', {
        name: name.trim(),
        password,
      })
      login(data.token, data.user)
      toast.success(`ברוך הבא, ${data.user.name}! ⚽ עכשיו הצטרף לקבוצה דרך מסך הטבלה`)
      navigate('/leaderboard')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!name.trim() || !password.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', {
        name: name.trim(),
        password,
      })
      login(data.token, data.user)
      toast.success(`ברוך הבא, ${data.user.name}! ⚽`)
      navigate(loginDest())
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שם משתמש או סיסמה שגויים')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'register') return (
    <FormCard
      title="🆕 הרשמה"
      cta={loading ? '...' : 'הירשם'}
      onSubmit={handleRegister}
      loading={loading}
      onBack={() => setMode(null)}
      fields={<>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,.35)', margin: '-6px 0 4px' }}>
          אחרי ההרשמה תוכל להצטרף לקבוצה עם קוד דרך מסך הטבלה
        </p>
        {fieldWrap('שם משתמש', <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="איך קוראים לך?" style={inputStyle} maxLength={30} autoFocus
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
        {fieldWrap('סיסמה', <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="בחר סיסמה (לפחות 4 תווים)" style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
        {fieldWrap('אימות סיסמה', <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="הכנס שוב" style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
      </>}
    />
  )

  if (mode === 'login') return (
    <FormCard
      title="🔓 התחברות"
      cta={loading ? '...' : 'התחבר'}
      onSubmit={handleLogin}
      loading={loading}
      onBack={() => setMode(null)}
      fields={<>
        {fieldWrap('שם משתמש', <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="השם שנרשמת איתו" style={inputStyle} maxLength={30} autoFocus
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
        {fieldWrap('סיסמה', <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="הסיסמה שלך" style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
      </>}
    />
  )

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', padding: '48px 0 32px' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '18px',
          background: 'rgba(30,222,98,.12)', border: '1px solid rgba(30,222,98,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '36px', margin: '0 auto 18px',
        }}>⚽</div>
        <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '6px' }}>מונדיאל 2026</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,.35)' }}>ניחושים ותחרות חברים</p>
      </div>

      {/* Quick login */}
      {lastUser && (
        <div style={{
          background: '#0c1810', border: '1px solid rgba(30,222,98,.22)', borderRadius: '14px', padding: '20px', marginBottom: '12px',
          boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.45)',
        }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.3)', marginBottom: '12px', fontWeight: 500 }}>כניסה מהירה</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: 'rgba(30,222,98,.14)', border: '1px solid rgba(30,222,98,.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: '#1ede62',
            }}>{lastUser.name.charAt(0)}</div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{lastUser.name}</div>
          </div>
          <form onSubmit={handleQuickLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="password" value={quickPassword} onChange={e => setQuickPassword(e.target.value)}
              placeholder="סיסמה" style={{ ...inputStyle, fontSize: '14px' }} autoFocus
              onFocus={e => e.target.style.borderColor = '#1ede62'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'}
            />
            <button type="submit" disabled={loading || !quickPassword.trim()} style={{
              ...btnPrimary, fontSize: '14px', padding: '11px',
              opacity: loading || !quickPassword.trim() ? 0.5 : 1,
            }}>{loading ? '...' : 'כניסה לאפליקציה ⚽'}</button>
          </form>
          <button onClick={clearLastUser} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)',
            fontSize: '12px', fontFamily: 'Heebo, sans-serif', marginTop: '8px', width: '100%', textAlign: 'center', transition: 'color .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.6)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.25)'}
          >לא אתה?</button>
        </div>
      )}

      {/* Mode buttons */}
      {[
        { key: 'register', emoji: '🆕', title: 'הרשמה',    sub: 'משתמש חדש? צור חשבון' },
        { key: 'login',    emoji: '🔓', title: 'התחברות', sub: 'כבר נרשמת? היכנס לחשבון שלך' },
      ].map(o => (
        <button key={o.key} onClick={() => setMode(o.key)} style={{
          width: '100%', background: '#0c1810', border: '1px solid rgba(255,255,255,.07)',
          borderRadius: '14px', padding: '18px 20px', cursor: 'pointer',
          fontFamily: 'Heebo, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '8px', transition: 'all .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(30,222,98,.3)'; e.currentTarget.style.background = 'rgba(30,222,98,.06)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'; e.currentTarget.style.background = '#0c1810' }}
        >
          <span style={{ fontSize: '24px' }}>{o.emoji}</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ecf0ed' }}>{o.title}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.35)', marginTop: '2px' }}>{o.sub}</div>
          </div>
        </button>
      ))}

      {/* Scoring table */}
      <div style={{
        background: '#0c1810', border: '1px solid rgba(255,255,255,.06)', borderRadius: '14px', padding: '16px 18px', marginTop: '4px',
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,.5)', marginBottom: '10px' }}>🏆 מערכת הניקוד</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            ['שלב בתים', '3נק', '1נק'],
            ['שלב 32 / שמינית גמר', '5נק', '3נק'],
            ['רבע גמר', '6נק', '4נק'],
            ['חצי / מקום שלישי', '10נק', '5נק'],
            ['גמר', '15נק', '8נק'],
          ].map(([s, ex, dir]) => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,.3)' }}>{s}</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#1ede62', fontWeight: 600 }}>מדויק {ex}</span>
                <span style={{ fontSize: '12px', color: '#f5c842', fontWeight: 600 }}>כיוון {dir}</span>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: '7px', marginTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,.3)' }}>זוכה + מלך שערים</span>
            <span style={{ fontSize: '12px', color: '#f0b429', fontWeight: 600 }}>15נק כל אחד</span>
          </div>
        </div>
      </div>
    </div>
  )
}
