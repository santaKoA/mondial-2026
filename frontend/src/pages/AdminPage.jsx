import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { TeamPicker, PlayerPicker } from '../components/SpecialPickers'

function formatIsrael(str) {
  const d = str && !str.endsWith('Z') && !str.includes('+') ? new Date(str + 'Z') : new Date(str)
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).format(d).replace(',', '')
}

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
        {formatIsrael(match.scheduled_at)}
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
  const [activeTab, setActiveTab] = useState('groups')
  const [specialType, setSpecialType] = useState('winner')
  const [specialValue, setSpecialValue] = useState('')
  const [specialPoints, setSpecialPoints] = useState(15)
  const [saving, setSaving] = useState(false)
  const [groups, setGroups] = useState([])
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [deletingUser, setDeletingUser] = useState(null)

  async function loadData() {
    try {
      const [mRes, tRes, uRes, gRes, sRes] = await Promise.all([
        api.get('/api/matches'),
        api.get('/api/admin/teams'),
        api.get('/api/admin/users'),
        api.get('/api/admin/groups'),
        api.get('/api/admin/sync/status'),
      ])
      setMatches(mRes.data)
      setTeams(tRes.data)
      setUsers(uRes.data)
      setGroups(gRes.data)
      setSyncStatus(sRes.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה בטעינת נתוני הניהול')
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const { data } = await api.post('/api/admin/sync')
      if (data.error) {
        toast.error(`שגיאת סנכרון: ${data.error}`)
      } else {
        const changed = (data.scores_updated || 0) + (data.teams_assigned || 0)
        toast.success(
          changed > 0
            ? `סונכרן ✅ ${data.scores_updated} תוצאות · ${data.teams_assigned} שיבוצי קבוצות (${data.total_fixtures} משחקים)`
            : `סונכרן ✅ אין שינויים חדשים (${data.total_fixtures} משחקים מ-API)`
        )
        await loadData()
      }
      const sRes = await api.get('/api/admin/sync/status')
      setSyncStatus(sRes.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאת סנכרון')
    } finally {
      setSyncing(false)
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    try {
      const { data } = await api.post('/api/admin/groups', { name: newGroupName.trim() })
      setGroups(prev => [...prev, data])
      setNewGroupName('')
      toast.success(`קבוצה "${data.name}" נוצרה — קוד: ${data.code}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setCreatingGroup(false)
    }
  }

  async function handleDeleteUser(id, name) {
    if (!window.confirm(`למחוק את "${name}"? פעולה זו תמחק את כל הניחושים שלו ולא ניתנת לביטול.`)) return
    setDeletingUser(id)
    try {
      await api.delete(`/api/admin/users/${id}`)
      setUsers(prev => prev.filter(u => u.id !== id))
      toast.success('משתמש נמחק')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setDeletingUser(null)
    }
  }

  async function deleteGroup(id) {
    try {
      await api.delete(`/api/admin/groups/${id}`)
      setGroups(prev => prev.filter(g => g.id !== id))
      toast.success('קבוצה נמחקה')
    } catch (e) {
      toast.error('שגיאה')
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
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <h1 className="text-2xl font-black">🛠 פאנל ניהול</h1>
        <div className="flex items-center gap-3">
          {syncStatus && (
            <div className="text-xs text-white/40 text-left">
              {syncStatus.error ? (
                <span className="text-red-400">{syncStatus.error}</span>
              ) : syncStatus.last_sync_at ? (
                <span>סונכרן: {formatIsrael(syncStatus.last_sync_at)}</span>
              ) : (
                <span>{syncStatus.api_configured ? 'טרם סונכרן' : 'API לא מוגדר'}</span>
              )}
            </div>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <span className={syncing ? 'animate-spin' : ''}>🔄</span>
            {syncing ? 'מסנכרן...' : 'סנכרן תוצאות'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {['groups', 'matches', 'finished', 'special', 'users'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${activeTab === tab ? 'bg-green-500 text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            {tab === 'groups' ? `🏷️ קבוצות (${groups.length})`
              : tab === 'matches' ? `⏳ ממתינים (${pendingMatches.length})`
              : tab === 'finished' ? `✅ גמורים (${finishedMatches.length})`
              : tab === 'special' ? '⭐ מיוחדים'
              : `👥 משתמשים (${users.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'groups' && (
        <div className="flex flex-col gap-4">
          <div className="card flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGroup()}
              placeholder="שם הקבוצה החדשה (למשל: חברים מהעבודה)"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-green-400"
            />
            <button
              onClick={createGroup}
              disabled={creatingGroup || !newGroupName.trim()}
              className="btn-primary"
            >
              {creatingGroup ? '...' : '+ צור קבוצה'}
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-8 text-white/30">אין קבוצות עדיין</div>
          ) : (
            <div className="card overflow-hidden p-0 overflow-x-auto">
              <table className="w-full min-w-[380px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">שם הקבוצה</th>
                    <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">קוד הצטרפות</th>
                    <th className="text-center py-3 px-4 text-white/50 text-sm font-medium">חברים</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.id} className="border-b border-white/5 last:border-0">
                      <td className="py-3 px-4 font-medium">{g.name}</td>
                      <td className="py-3 px-4">
                        <code
                          className="bg-green-500/20 text-green-300 px-3 py-1 rounded-lg text-sm font-mono cursor-pointer hover:bg-green-500/30"
                          onClick={() => {
                            navigator.clipboard?.writeText(g.code)
                            toast.success('קוד הועתק!')
                          }}
                          title="לחץ להעתקה"
                        >
                          {g.code}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-center text-white/60">{g.member_count}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => deleteGroup(g.id)}
                          className="text-red-400/50 hover:text-red-400 text-xs transition-colors"
                        >
                          מחק
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card text-sm text-white/50 bg-blue-500/5 border-blue-500/20">
            <p className="font-medium text-white/70 mb-1">💡 איך זה עובד:</p>
            <ul className="space-y-1">
              <li>צור קבוצה לכל חוג חברים — עבודה, משפחה, חברים מהצבא...</li>
              <li>שתף את קוד ההצטרפות עם החברים ← הם יצטרפו עם הקוד הזה</li>
              <li>כל קבוצה רואה טבלת דירוג נפרדת משלה בדף הטבלה</li>
              <li>הניחושים עצמם משותפים — כל משתמש מנחש פעם אחת</li>
            </ul>
          </div>
        </div>
      )}

      {(activeTab === 'matches' || activeTab === 'finished') && (
        <div className="card overflow-hidden p-0 overflow-x-auto">
          <table className="w-full min-w-[520px]">
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
                setSpecialPoints(15)
                setSpecialValue('')
              }}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
            >
              <option value="winner">🏆 זוכה המונדיאל (15 נק׳)</option>
              <option value="top_scorer">⚽ מלך השערים (15 נק׳)</option>
            </select>

            {specialType === 'winner' ? (
              <TeamPicker value={specialValue} onChange={setSpecialValue} />
            ) : (
              <PlayerPicker value={specialValue} onChange={setSpecialValue} />
            )}

            {specialValue && (
              <div className="text-sm text-white/60">
                נבחר: <span className="text-white font-medium">{specialValue}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-sm text-white/60">נקודות:</label>
              <input
                type="number"
                value={specialPoints}
                onChange={e => setSpecialPoints(parseInt(e.target.value) || 0)}
                className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
              />
            </div>
            <button onClick={handleSpecialResult} disabled={saving || !specialValue.trim()} className="btn-primary">
              {saving ? '...' : 'הענק נקודות'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card overflow-hidden p-0 overflow-x-auto">
          <table className="w-full min-w-[280px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">שם</th>
                <th className="text-center py-3 px-4 text-white/50 text-sm font-medium">ניחושים</th>
                <th className="text-center py-3 px-4 text-white/50 text-sm font-medium">נקודות</th>
                <th className="py-3 px-2"></th>
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
                  <td className="py-3 px-2 text-center">
                    {!u.is_admin && (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        disabled={deletingUser === u.id}
                        className="text-red-400/50 hover:text-red-400 text-xs transition-colors disabled:opacity-30"
                      >
                        {deletingUser === u.id ? '...' : 'מחק'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
