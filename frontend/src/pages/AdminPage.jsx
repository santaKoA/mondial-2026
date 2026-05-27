import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import toast from 'react-hot-toast'
import api from '../api'

const STAGE_LABELS = {
  group: 'שלב הבתים',
  round_of_32: 'שלב ה-32',
  round_of_16: 'שמינית גמר',
  quarter_final: 'רבע גמר',
  semi_final: 'חצי גמר',
  third_place: 'משחק שלישי',
  final: 'גמר',
}

function MatchResultRow({ match, teams, onSaved }) {
  const [home, setHome] = useState(match.home_score != null ? String(match.home_score) : '')
  const [away, setAway] = useState(match.away_score != null ? String(match.away_score) : '')
  const [homeTeamId, setHomeTeamId] = useState(match.home_team?.id || '')
  const [awayTeamId, setAwayTeamId] = useState(match.away_team?.id || '')
  const [saving, setSaving] = useState(false)

  const needsTeams = !match.home_team || !match.away_team

  async function saveResult() {
    const h = parseInt(home), a = parseInt(away)
    if (isNaN(h) || isNaN(a)) { toast.error('הזן תוצאה'); return }
    setSaving(true)
    try {
      await api.put(`/api/admin/matches/${match.id}/result`, { home_score: h, away_score: a })
      toast.success('תוצאה נשמרה!')
      onSaved?.()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  async function saveTeams() {
    if (!homeTeamId || !awayTeamId) { toast.error('בחר קבוצות'); return }
    setSaving(true)
    try {
      await api.put(`/api/admin/matches/${match.id}/teams?home_team_id=${homeTeamId}&away_team_id=${awayTeamId}`)
      toast.success('קבוצות עודכנו!')
      onSaved?.()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-3 px-4 text-sm text-white/50">
        {format(new Date(match.scheduled_at), 'dd/MM HH:mm', { locale: he })}
        <div className="text-xs">{STAGE_LABELS[match.stage]}{match.group_name && ` · ${match.group_name}`}</div>
      </td>
      <td className="py-3 px-4 text-sm">
        {needsTeams ? (
          <div className="flex gap-1">
            <select
              value={homeTeamId}
              onChange={e => setHomeTeamId(e.target.value)}
              className="flex-1 bg-white/10 border border-white/10 rounded px-2 py-1 text-xs text-white"
            >
              <option value="">בית</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
            </select>
            <span className="text-white/30 self-center">-</span>
            <select
              value={awayTeamId}
              onChange={e => setAwayTeamId(e.target.value)}
              className="flex-1 bg-white/10 border border-white/10 rounded px-2 py-1 text-xs text-white"
            >
              <option value="">אורח</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
            </select>
            <button onClick={saveTeams} disabled={saving} className="btn-secondary text-xs py-1 px-2">שמור</button>
          </div>
        ) : (
          <span>
            {match.home_team?.flag} {match.home_team?.name} <span className="text-white/30">-</span> {match.away_team?.flag} {match.away_team?.name}
          </span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <input
            type="number" min="0" max="99"
            value={home}
            onChange={e => setHome(e.target.value)}
            className="w-12 text-center bg-white/10 border border-white/10 rounded px-1 py-1 text-sm text-white"
            placeholder="0"
          />
          <span className="text-white/30">-</span>
          <input
            type="number" min="0" max="99"
            value={away}
            onChange={e => setAway(e.target.value)}
            className="w-12 text-center bg-white/10 border border-white/10 rounded px-1 py-1 text-sm text-white"
            placeholder="0"
          />
          <button
            onClick={saveResult}
            disabled={saving}
            className={`text-xs px-2 py-1 rounded font-medium transition-colors ${match.status === 'finished' ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30' : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'}`}
          >
            {saving ? '...' : match.status === 'finished' ? '✏️' : '✓'}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function AdminPage() {
  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('matches')
  const [specialType, setSpecialType] = useState('winner')
  const [specialValue, setSpecialValue] = useState('')
  const [specialPoints, setSpecialPoints] = useState(15)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    try {
      const [mRes, tRes, uRes] = await Promise.all([
        api.get('/api/matches'),
        api.get('/api/admin/teams'),
        api.get('/api/admin/users'),
      ])
      setMatches(mRes.data)
      setTeams(tRes.data)
      setUsers(uRes.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function handleSpecialResult() {
    if (!specialValue.trim()) { toast.error('הזן ערך'); return }
    setSaving(true)
    try {
      await api.post('/api/admin/special-predictions/correct', {
        prediction_type: specialType,
        correct_value: specialValue,
        points_awarded: specialPoints,
      })
      toast.success('נקודות הוענקו!')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  const pendingMatches = matches.filter(m => m.status === 'upcoming')
  const finishedMatches = matches.filter(m => m.status === 'finished')

  if (loading) return <div className="text-center py-20 text-white/40">טוען...</div>

  return (
    <div>
      <h1 className="text-2xl font-black mb-5">🛠 פאנל ניהול</h1>

      <div className="flex gap-2 mb-5">
        {['matches', 'finished', 'special', 'users'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-green-500 text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            {tab === 'matches' ? `⏳ ממתינים (${pendingMatches.length})`
              : tab === 'finished' ? `✅ גמורים (${finishedMatches.length})`
              : tab === 'special' ? '⭐ מיוחדים'
              : `👥 משתמשים (${users.length})`}
          </button>
        ))}
      </div>

      {(activeTab === 'matches' || activeTab === 'finished') && (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">תאריך</th>
                <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">משחק</th>
                <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">תוצאה</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'matches' ? pendingMatches : finishedMatches).map(m => (
                <MatchResultRow key={m.id} match={m} teams={teams} onSaved={loadData} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'special' && (
        <div className="card max-w-md">
          <h2 className="font-bold mb-4">הגדרת תוצאה לניחושים מיוחדים</h2>
          <div className="flex flex-col gap-3">
            <select
              value={specialType}
              onChange={e => {
                setSpecialType(e.target.value)
                setSpecialPoints(e.target.value === 'winner' ? 15 : 10)
              }}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
            >
              <option value="winner">🏆 זוכה המונדיאל (15 נק׳)</option>
              <option value="top_scorer">⚽ מלך השערים (10 נק׳)</option>
            </select>
            <input
              type="text"
              value={specialValue}
              onChange={e => setSpecialValue(e.target.value)}
              placeholder={specialType === 'winner' ? 'שם הנבחרת הזוכה' : 'שם מלך השערים'}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-white/60">נקודות:</label>
              <input
                type="number"
                value={specialPoints}
                onChange={e => setSpecialPoints(parseInt(e.target.value) || 0)}
                className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
              />
            </div>
            <button onClick={handleSpecialResult} disabled={saving} className="btn-primary">
              {saving ? '...' : 'הענק נקודות'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">שם</th>
                <th className="text-center py-3 px-4 text-white/50 text-sm font-medium">ניחושים</th>
                <th className="text-center py-3 px-4 text-white/50 text-sm font-medium">נקודות</th>
              </tr>
            </thead>
            <tbody>
              {[...users].sort((a, b) => b.total_points - a.total_points).map((u, i) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0">
                  <td className="py-3 px-4">
                    {u.name}
                    {u.is_admin && <span className="mr-2 text-xs text-green-400">(admin)</span>}
                  </td>
                  <td className="py-3 px-4 text-center text-white/60 text-sm">{u.prediction_count}</td>
                  <td className="py-3 px-4 text-center font-bold">{u.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
