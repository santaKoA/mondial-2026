import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function JoinPage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/join', { name: name.trim(), code: code.trim() })
      login(data.token, data.user)
      toast.success(`ברוך הבא, ${data.user.name}! ⚽`)
      navigate('/')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'קוד שגוי')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[90vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">⚽</div>
          <h1 className="text-3xl font-black text-white">מונדיאל 2026</h1>
          <p className="text-white/50 mt-1">ניחושים ותחרות חברים</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold mb-4 text-center">הצטרפות לקבוצה</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">שם המשתתף</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="הזן את שמך"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-green-400"
                maxLength={30}
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">קוד הצטרפות</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="הזן את קוד הקבוצה"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-green-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !name.trim() || !code.trim()}
              className="btn-primary w-full py-3 text-base mt-1"
            >
              {loading ? '...' : 'הצטרף לתחרות'}
            </button>
          </form>
        </div>

        <div className="mt-6 card text-sm text-white/50">
          <p className="font-medium text-white/70 mb-2">🏆 מערכת הניקוד:</p>
          <ul className="space-y-1">
            <li>שלב בתים: ניחוש מדויק 3נק · כיוון 1נק</li>
            <li>שמינית / רבע גמר: ניחוש מדויק 5נק · כיוון 3נק</li>
            <li>חצי גמר / גמר: ניחוש מדויק 10נק · כיוון 5נק</li>
            <li>🥇 זוכה טורניר: 15נק · ⚽ מלך שערים: 10נק</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
