import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../api'

const TEAMS = [
  'ארגנטינה', 'צרפת', 'ברזיל', 'ספרד', 'אנגליה', 'גרמניה', 'פורטוגל', 'הולנד',
  'בלגיה', 'מרוקו', 'ארה"ב', 'מקסיקו', 'קולומביה', 'אורוגוואי', 'יפן', 'קרואטיה',
  'שווייץ', 'דנמרק', 'סנגל', 'קנדה', 'קוריאה הדרומית', 'אוסטרליה', 'פולין', 'סרביה',
  'טורקיה', 'אוסטריה', 'מצרים', 'ניגריה', 'חוף השנהב', 'אקוודור', 'נורווגיה', 'קמרון',
  'גאנה', 'אירן', 'ערב הסעודית', 'פנמה', 'אוזבקיסטן', 'סקוטלנד', 'ירדן', 'קטאר',
  'דרום אפריקה', 'אלג\'יריה', 'קונגו', 'עיראק', 'ג\'מייקה', 'צ\'כיה', 'קוסטה ריקה', 'בוליביה',
]

const TOURNAMENT_START = new Date('2026-06-11T17:00:00Z')

function isTournamentStarted() {
  return new Date() >= TOURNAMENT_START
}

export default function SpecialPredictionsPage() {
  const [predictions, setPredictions] = useState({})
  const [winnerInput, setWinnerInput] = useState('')
  const [topScorerInput, setTopScorerInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const locked = isTournamentStarted()

  useEffect(() => {
    api.get('/api/special-predictions/my')
      .then(r => {
        const map = {}
        r.data.forEach(p => { map[p.prediction_type] = p })
        setPredictions(map)
        if (map.winner) setWinnerInput(map.winner.value)
        if (map.top_scorer) setTopScorerInput(map.top_scorer.value)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(type, value) {
    if (!value.trim()) { toast.error('הזן ערך'); return }
    setSaving(type)
    try {
      const { data } = await api.post('/api/special-predictions', { prediction_type: type, value: value.trim() })
      setPredictions(prev => ({ ...prev, [type]: data }))
      toast.success('נשמר!')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="text-center py-20 text-white/40">טוען...</div>

  return (
    <div>
      <h1 className="text-2xl font-black mb-2">⭐ ניחושים מיוחדים</h1>
      <p className="text-white/50 mb-6 text-sm">
        {locked
          ? '🔒 הניחושים המיוחדים נסגרו עם תחילת הטורניר'
          : 'חייב להגיש לפני תחילת הטורניר (11.6.2026)'}
      </p>

      <div className="flex flex-col gap-5">
        {/* Winner */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🏆</span>
            <h2 className="text-lg font-bold">זוכה המונדיאל</h2>
            <span className="mr-auto text-xs text-green-400 font-bold">15 נק׳</span>
          </div>
          <p className="text-white/40 text-sm mb-4">איזו נבחרת תזכה באליפות העולם?</p>

          {locked ? (
            <div className="bg-white/5 rounded-lg px-4 py-3 text-white font-medium">
              {predictions.winner?.value || <span className="text-white/30">לא הוגש ניחוש</span>}
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={winnerInput}
                onChange={e => setWinnerInput(e.target.value)}
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-green-400"
              >
                <option value="">-- בחר נבחרת --</option>
                {TEAMS.sort().map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={() => handleSave('winner', winnerInput)}
                disabled={saving === 'winner' || !winnerInput}
                className="btn-primary"
              >
                {saving === 'winner' ? '...' : predictions.winner ? '✏️' : '💾'}
              </button>
            </div>
          )}

          {predictions.winner?.points > 0 && (
            <div className="mt-2 text-green-400 text-sm font-bold">✅ +{predictions.winner.points} נקודות!</div>
          )}
        </div>

        {/* Top scorer */}
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">⚽</span>
            <h2 className="text-lg font-bold">מלך השערים</h2>
            <span className="mr-auto text-xs text-green-400 font-bold">15 נק׳</span>
          </div>
          <p className="text-white/40 text-sm mb-4">מי ישיג את שערים הכי הרבה בטורניר?</p>

          {locked ? (
            <div className="bg-white/5 rounded-lg px-4 py-3 text-white font-medium">
              {predictions.top_scorer?.value || <span className="text-white/30">לא הוגש ניחוש</span>}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={topScorerInput}
                onChange={e => setTopScorerInput(e.target.value)}
                placeholder="שם השחקן (למשל: ליאונל מסי)"
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-green-400"
              />
              <button
                onClick={() => handleSave('top_scorer', topScorerInput)}
                disabled={saving === 'top_scorer' || !topScorerInput.trim()}
                className="btn-primary"
              >
                {saving === 'top_scorer' ? '...' : predictions.top_scorer ? '✏️' : '💾'}
              </button>
            </div>
          )}

          {predictions.top_scorer?.points > 0 && (
            <div className="mt-2 text-green-400 text-sm font-bold">✅ +{predictions.top_scorer.points} נקודות!</div>
          )}
        </div>
      </div>
    </div>
  )
}
