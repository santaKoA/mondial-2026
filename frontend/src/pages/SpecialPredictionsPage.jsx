import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { TeamPicker, PlayerPicker } from '../components/SpecialPickers'
import { WC_TEAMS, WC_PLAYERS } from '../data/worldcup.js'

const FALLBACK_TOURNAMENT_START = new Date('2026-06-11T17:00:00Z')

function getTeamFlag(name) {
  return WC_TEAMS.find(t => t.name === name)?.flag || ''
}

function getPlayerFlag(name) {
  return WC_PLAYERS.find(p => p.name === name)?.flag || ''
}

export default function SpecialPredictionsPage() {
  const [predictions, setPredictions] = useState({})
  const [winnerInput, setWinnerInput] = useState('')
  const [topScorerInput, setTopScorerInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [tournamentStart, setTournamentStart] = useState(FALLBACK_TOURNAMENT_START)
  const locked = new Date() >= tournamentStart

  useEffect(() => {
    Promise.all([
      api.get('/api/special-predictions/my'),
      api.get('/api/config').catch(() => null),
    ]).then(([predRes, cfgRes]) => {
      const map = {}
      predRes.data.forEach(p => { map[p.prediction_type] = p })
      setPredictions(map)
      if (map.winner) setWinnerInput(map.winner.value)
      if (map.top_scorer) setTopScorerInput(map.top_scorer.value)
      if (cfgRes?.data?.tournament_start) {
        const ts = cfgRes.data.tournament_start
        setTournamentStart(new Date(ts.endsWith('Z') ? ts : ts + 'Z'))
      }
    }).finally(() => setLoading(false))
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
              {predictions.winner?.value
                ? <span>{getTeamFlag(predictions.winner.value)} {predictions.winner.value}</span>
                : <span className="text-white/30">לא הוגש ניחוש</span>}
            </div>
          ) : (
            <>
              <TeamPicker value={winnerInput} onChange={setWinnerInput} />
              <button
                onClick={() => handleSave('winner', winnerInput)}
                disabled={saving === 'winner' || !winnerInput}
                className="btn-primary w-full mt-3"
              >
                {saving === 'winner' ? '...' : predictions.winner ? '✏️ עדכן' : '💾 שמור'}
              </button>
            </>
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
              {predictions.top_scorer?.value
                ? <span>{getPlayerFlag(predictions.top_scorer.value)} {predictions.top_scorer.value}</span>
                : <span className="text-white/30">לא הוגש ניחוש</span>}
            </div>
          ) : (
            <>
              <PlayerPicker value={topScorerInput} onChange={setTopScorerInput} />
              <button
                onClick={() => handleSave('top_scorer', topScorerInput)}
                disabled={saving === 'top_scorer' || !topScorerInput.trim()}
                className="btn-primary w-full mt-3"
              >
                {saving === 'top_scorer' ? '...' : predictions.top_scorer ? '✏️ עדכן' : '💾 שמור'}
              </button>
            </>
          )}

          {predictions.top_scorer?.points > 0 && (
            <div className="mt-2 text-green-400 text-sm font-bold">✅ +{predictions.top_scorer.points} נקודות!</div>
          )}
        </div>
      </div>
    </div>
  )
}
