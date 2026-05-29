import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'

export default function ChangePasswordModal({ onClose }) {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!oldPw || !newPw || !confirmPw) { toast.error('יש למלא את כל השדות'); return }
    if (newPw !== confirmPw) { toast.error('הסיסמאות החדשות אינן תואמות'); return }
    if (newPw.length < 4) { toast.error('הסיסמה החדשה חייבת להכיל לפחות 4 תווים'); return }
    setSaving(true)
    try {
      await api.put('/api/auth/change-password', { old_password: oldPw, new_password: newPw })
      toast.success('הסיסמה שונתה בהצלחה ✅')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-green-400 text-sm"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-pitch-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <h2 className="text-lg font-bold mb-4">🔑 שינוי סיסמה</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1">סיסמה ישנה</label>
            <input
              type="password"
              value={oldPw}
              onChange={e => setOldPw(e.target.value)}
              placeholder="הסיסמה הנוכחית"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">סיסמה חדשה</label>
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="לפחות 4 תווים"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">אימות סיסמה חדשה</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="הכנס שוב את הסיסמה החדשה"
              className={inputClass}
            />
          </div>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary py-2.5 text-sm"
            >
              {saving ? '...' : 'שנה סיסמה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
