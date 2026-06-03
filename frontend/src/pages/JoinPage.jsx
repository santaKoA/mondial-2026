import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function JoinPage() {
  const [mode, setMode] = useState(null)
  const [name, setName] = useState('')
  const [groupName, setGroupName] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdGroup, setCreatedGroup] = useState(null)
  const [pendingAuth, setPendingAuth] = useState(null)
  const [lastUser, setLastUser] = useState(null)
  const [quickPassword, setQuickPassword] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  function loginDest() {
    return new Date() >= new Date('2026-06-11') ? '/?tab=today' : '/?tab=all'
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
      const { data } = await api.post('/api/auth/join', {
        name: lastUser.name,
        code: lastUser.groupCode,
        password: quickPassword,
      })
      login(data.token, data.user, data.group?.code, data.group?.name)
      toast.success(`ברוך הבא, ${data.user.name}! ⚽`)
      navigate(loginDest())
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || !groupName.trim() || !password.trim()) return
    if (password !== confirmPassword) { toast.error('הסיסמאות אינן תואמות'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/create-group', {
        user_name: name.trim(),
        group_name: groupName.trim(),
        password,
      })
      setPendingAuth({ token: data.token, user: data.user })
      setCreatedGroup(data.group)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!name.trim() || !code.trim() || !password.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/join', {
        name: name.trim(),
        code: code.trim(),
        password,
      })
      login(data.token, data.user, data.group?.code, data.group?.name)
      toast.success(`ברוך הבא, ${data.user.name}! ⚽`)
      navigate(loginDest())
    } catch (e) {
      toast.error(e.response?.data?.detail || 'קוד שגוי')
    } finally {
      setLoading(false)
    }
  }

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

  // Created group screen
  if (createdGroup) {
    return (
      <div style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '6px' }}>הקבוצה נוצרה!</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,.5)', marginBottom: '24px' }}>שתף את הקוד עם החברים</p>

          <div style={{
            background: '#0c1810', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '20px', marginBottom: '12px',
          }}>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', marginBottom: '6px' }}>שם הקבוצה</p>
            <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>{createdGroup.name}</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', marginBottom: '8px' }}>קוד הצטרפות</p>
            <div onClick={() => { navigator.clipboard?.writeText(createdGroup.code); toast.success('קוד הועתק ללוח!') }}
              style={{
                background: 'rgba(30,222,98,.12)', border: '2px solid rgba(30,222,98,.3)',
                borderRadius: '12px', padding: '16px 24px', cursor: 'pointer', transition: 'background .15s',
              }}>
              <span style={{ fontSize: '32px', fontFamily: 'monospace', fontWeight: 900, color: '#1ede62', letterSpacing: '6px' }}>
                {createdGroup.code}
              </span>
              <p style={{ fontSize: '11px', color: 'rgba(30,222,98,.5)', marginTop: '6px' }}>לחץ להעתקה</p>
            </div>
          </div>

          <button onClick={() => { login(pendingAuth.token, pendingAuth.user, createdGroup.code, createdGroup.name); navigate(loginDest()) }}
            style={btnPrimary}>
            המשך לניחושים ⚽
          </button>
        </div>
      </div>
    )
  }

  const FormCard = ({ title, fields, cta, onSubmit }) => (
    <div style={{ maxWidth: '400px', margin: '0 auto', paddingBottom: '40px' }}>
      <button onClick={() => setMode(null)} style={{
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

  const fieldWrap = (label, input) => (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,.35)', marginBottom: '6px', fontWeight: 500 }}>{label}</label>
      {input}
    </div>
  )

  if (mode === 'create') return (
    <FormCard title="🆕 צור קבוצה חדשה" cta={loading ? '...' : 'צור קבוצה וקבל קוד שיתוף'} onSubmit={handleCreate}
      fields={<>
        {fieldWrap('השם שלך', <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="איך קוראים לך?" style={inputStyle} maxLength={30} autoFocus
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
        {fieldWrap('שם הקבוצה', <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder='"חברים מהעבודה"' style={inputStyle} maxLength={40}
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
        {fieldWrap('סיסמה', <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="בחר סיסמה" style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
        {fieldWrap('אימות סיסמה', <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="הכנס שוב" style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
      </>}
    />
  )

  if (mode === 'join') return (
    <FormCard title="🔗 הצטרף לקבוצה" cta={loading ? '...' : 'הצטרף לתחרות'} onSubmit={handleJoin}
      fields={<>
        {fieldWrap('השם שלך', <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="איך קוראים לך?" style={inputStyle} maxLength={30} autoFocus
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
        {fieldWrap('קוד הקבוצה', <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="הקוד שקיבלת מהחבר" style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#1ede62'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'} />)}
        {fieldWrap('סיסמה', <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="הכנס סיסמה" style={inputStyle}
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
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{lastUser.name}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)' }}>קבוצה: {lastUser.groupName}</div>
            </div>
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
        { key: 'create', emoji: '🆕', title: 'צור קבוצה חדשה',      sub: 'פתח תחרות ושתף חברים' },
        { key: 'join',   emoji: '🔗', title: 'הצטרף לקבוצה קיימת', sub: 'יש לי קוד מחבר' },
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
            ['שמינית / רבע גמר', '5נק', '3נק'],
            ['חצי / גמר', '10נק', '5נק'],
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
