import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function JoinPage() {
  const [mode, setMode] = useState(null) // null | 'create' | 'join'
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
    if (password !== confirmPassword) {
      toast.error('הסיסמאות אינן תואמות')
      return
    }
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

  function copyCode() {
    navigator.clipboard?.writeText(createdGroup.code)
    toast.success('קוד הועתק ללוח!')
  }

  const inputClass = "w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-green-400"

  // Step 3: Group created — show code
  if (createdGroup) {
    return (
      <div className="min-h-[90vh] flex items-center justify-center">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-black mb-1">הקבוצה נוצרה!</h1>
          <p className="text-white/50 mb-6">שתף את הקוד עם החברים</p>

          <div className="card mb-4">
            <p className="text-white/60 text-sm mb-2">שם הקבוצה</p>
            <p className="text-xl font-bold mb-4">{createdGroup.name}</p>

            <p className="text-white/60 text-sm mb-2">קוד הצטרפות</p>
            <div
              onClick={copyCode}
              className="bg-green-500/20 border-2 border-green-500/40 rounded-xl px-6 py-4 cursor-pointer hover:bg-green-500/30 transition-colors"
            >
              <span className="text-3xl font-mono font-black text-green-300 tracking-widest">
                {createdGroup.code}
              </span>
              <p className="text-green-400/60 text-xs mt-1">לחץ להעתקה</p>
            </div>
          </div>

          <div className="card text-sm text-white/50 mb-6 text-right">
            <p className="font-medium text-white/70 mb-1.5">📤 איך לשתף:</p>
            <p>שלח לחברים את הקוד <strong className="text-white">{createdGroup.code}</strong></p>
            <p className="mt-1">הם יכנסו לאפליקציה, יבחרו "הצטרף לקבוצה" ויזינו את הקוד</p>
          </div>

          <button
            onClick={() => {
              login(pendingAuth.token, pendingAuth.user, createdGroup.code, createdGroup.name)
              navigate(loginDest())
            }}
            className="btn-primary w-full py-3"
          >
            המשך לניחושים ⚽
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-4">
      <div className="w-full max-w-sm mx-auto">
        {/* Logo */}
        <div className="text-center mb-3">
          <div className="text-5xl mb-1">⚽</div>
          <h1 className="text-3xl font-black text-white">מונדיאל 2026</h1>
          <p className="text-white/50 mt-0.5 text-sm">ניחושים ותחרות חברים</p>
        </div>

        {/* Quick re-login card */}
        {lastUser && !mode && (
          <div className="card mb-3 border-green-500/30">
            <p className="text-white/50 text-xs mb-3">כניסה מהירה</p>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center text-green-300 font-bold text-sm flex-shrink-0">
                {lastUser.name.charAt(0)}
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{lastUser.name}</p>
                <p className="text-white/40 text-xs">{lastUser.groupName}</p>
              </div>
            </div>
            <form onSubmit={handleQuickLogin} className="flex flex-col gap-2">
              <input
                type="password"
                value={quickPassword}
                onChange={e => setQuickPassword(e.target.value)}
                placeholder="סיסמה"
                className={inputClass}
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !quickPassword.trim()}
                className="btn-primary w-full py-2.5 text-sm"
              >
                {loading ? '...' : 'כניסה'}
              </button>
            </form>
            <button
              onClick={clearLastUser}
              className="text-white/30 hover:text-white/60 text-xs mt-2 w-full text-center transition-colors"
            >
              לא אתה?
            </button>
          </div>
        )}

        {/* Mode picker */}
        {!mode && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode('create')}
              className="card hover:border-green-500/40 transition-all text-right py-5 px-5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl group-hover:scale-110 transition-transform">🆕</span>
                <div className="text-right">
                  <div className="font-bold text-base">צור קבוצה חדשה</div>
                  <div className="text-white/50 text-sm mt-0.5">פתח תחרות ושתף חברים</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="card hover:border-green-500/40 transition-all text-right py-5 px-5 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl group-hover:scale-110 transition-transform">🔗</span>
                <div className="text-right">
                  <div className="font-bold text-base">הצטרף לקבוצה קיימת</div>
                  <div className="text-white/50 text-sm mt-0.5">יש לי קוד מחבר</div>
                </div>
              </div>
            </button>

            <div className="mt-2 card text-xs text-white/40">
              <p className="font-medium text-white/60 mb-1.5">🏆 מערכת הניקוד:</p>
              <ul className="space-y-0.5">
                <li>שלב בתים: מדויק 3נק · כיוון 1נק</li>
                <li>שמינית / רבע גמר: מדויק 5נק · כיוון 3נק</li>
                <li>חצי / גמר: מדויק 10נק · כיוון 5נק</li>
                <li>זוכה טורניר 15נק · מלך שערים 15נק</li>
              </ul>
            </div>
          </div>
        )}

        {/* Create group form */}
        {mode === 'create' && (
          <div className="card">
            <button onClick={() => setMode(null)} className="text-white/40 hover:text-white text-sm mb-4 flex items-center gap-1">
              ← חזור
            </button>
            <h2 className="text-lg font-bold mb-4">🆕 צור קבוצה חדשה</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">השם שלך</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="איך קוראים לך?"
                  className={inputClass}
                  maxLength={30}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">שם הקבוצה</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder='למשל: "חברים מהעבודה"'
                  className={inputClass}
                  maxLength={40}
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">סיסמה</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="בחר סיסמה"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">אימות סיסמה</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="הכנס סיסמה שוב"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !name.trim() || !groupName.trim() || !password.trim() || !confirmPassword.trim()}
                className="btn-primary w-full py-3 text-base"
              >
                {loading ? '...' : 'צור קבוצה וקבל קוד שיתוף'}
              </button>
            </form>
          </div>
        )}

        {/* Join group form */}
        {mode === 'join' && (
          <div className="card">
            <button onClick={() => setMode(null)} className="text-white/40 hover:text-white text-sm mb-4 flex items-center gap-1">
              ← חזור
            </button>
            <h2 className="text-lg font-bold mb-4">🔗 הצטרף לקבוצה</h2>
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">השם שלך</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="איך קוראים לך?"
                  className={inputClass}
                  maxLength={30}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">קוד הקבוצה</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="הקוד שקיבלת מהחבר"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">סיסמה</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="הכנס סיסמה"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !name.trim() || !code.trim() || !password.trim()}
                className="btn-primary w-full py-3 text-base"
              >
                {loading ? '...' : 'הצטרף לתחרות'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
