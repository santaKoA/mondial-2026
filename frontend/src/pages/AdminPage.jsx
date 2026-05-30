import { useState, useEffect, Fragment } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { TeamPicker, PlayerPicker } from '../components/SpecialPickers'
import MatchCard from '../components/MatchCard'

function formatDate(str) {
  if (!str) return '—'
  const d = str && !str.endsWith('Z') && !str.includes('+') ? new Date(str + 'Z') : new Date(str)
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit', month: '2-digit', year: '2-digit',
  }).format(d)
}

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
  const [resetPw, setResetPw] = useState(null) // { id, value }
  // Test match state
  const [testMatches, setTestMatches] = useState([])       // metadata (for sync/delete)
  const [testMatchCards, setTestMatchCards] = useState([]) // MatchOut format (for prediction cards)
  const [testForm, setTestForm] = useState({
    home_name: 'ארסנל', home_flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    away_name: 'פריז סן ז\'רמן', away_flag: '🇫🇷',
    scheduled_at: '', stage: 'final',
    api_league_id: 2, api_season: 2025, api_fixture_id: '',
  })
  const [creatingTest, setCreatingTest] = useState(false)
  const [syncingTest, setSyncingTest] = useState(null)
  const [searchingFixtures, setSearchingFixtures] = useState(false)
  const [fixtureResults, setFixtureResults] = useState(null)

  async function loadData() {
    try {
      const [mRes, tRes, uRes, gRes, sRes, tmRes, tcRes] = await Promise.all([
        api.get('/api/matches'),
        api.get('/api/admin/teams'),
        api.get('/api/admin/users'),
        api.get('/api/admin/groups'),
        api.get('/api/admin/sync/status'),
        api.get('/api/admin/test-matches'),
        api.get('/api/admin/test-matches/cards'),
      ])
      setMatches(mRes.data)
      setTeams(tRes.data)
      setUsers(uRes.data)
      setGroups(gRes.data)
      setSyncStatus(sRes.data)
      setTestMatches(tmRes.data)
      setTestMatchCards(tcRes.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה בטעינת נתוני הניהול')
    } finally {
      setLoading(false)
    }
  }

  async function handleSearchFixtures() {
    if (!testForm.scheduled_at) { toast.error('בחר תאריך קודם'); return }
    setSearchingFixtures(true)
    setFixtureResults(null)
    try {
      const date = testForm.scheduled_at.slice(0, 10) // YYYY-MM-DD
      const { data } = await api.get('/api/admin/search-fixtures', {
        params: { league_id: testForm.api_league_id, season: testForm.api_season, date }
      })
      setFixtureResults(data)
      if (data.length === 0) toast.error('לא נמצאו משחקים בתאריך זה')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה בחיפוש')
    } finally {
      setSearchingFixtures(false)
    }
  }

  async function handleCreateTestMatch(e) {
    e.preventDefault()
    setCreatingTest(true)
    try {
      const payload = {
        ...testForm,
        api_league_id: Number(testForm.api_league_id),
        api_season: Number(testForm.api_season),
        api_fixture_id: testForm.api_fixture_id ? Number(testForm.api_fixture_id) : null,
      }
      const { data } = await api.post('/api/admin/test-match', payload)
      setTestMatches(prev => [...prev, data])
      const tcRes = await api.get('/api/admin/test-matches/cards')
      setTestMatchCards(tcRes.data)
      toast.success(`✅ משחק טסט נוצר! fixture_id: ${data.api_fixture_id || 'לא נמצא'}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setCreatingTest(false)
    }
  }

  async function handleDeleteTestMatch(id) {
    if (!window.confirm('למחוק את משחק הטסט?')) return
    try {
      await api.delete(`/api/admin/test-matches/${id}`)
      setTestMatches(prev => prev.filter(m => m.id !== id))
      setTestMatchCards(prev => prev.filter(m => m.id !== id))
      toast.success('נמחק')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    }
  }

  async function handleSyncTestMatch(id) {
    setSyncingTest(id)
    try {
      const { data } = await api.post(`/api/admin/test-matches/${id}/sync`)
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(`${data.home} ${data.score} ${data.away} · ${data.status}${data.updated ? ' · עודכן!' : ''}`)
        const tmRes = await api.get('/api/admin/test-matches')
        setTestMatches(tmRes.data)
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setSyncingTest(null)
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

  async function handleResetPassword(id) {
    if (!resetPw?.value?.trim()) { toast.error('הזן סיסמה חדשה'); return }
    if (resetPw.value.length < 4) { toast.error('הסיסמה חייבת להכיל לפחות 4 תווים'); return }
    try {
      await api.put(`/api/admin/users/${id}/password`, { new_password: resetPw.value })
      toast.success('הסיסמה אופסה בהצלחה ✅')
      setResetPw(null)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
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

  async function deleteGroup(id, name) {
    if (!window.confirm(`למחוק את הקבוצה "${name}"? פעולה זו תסיר את כל החברים ממנה ולא ניתנת לביטול.`)) return
    try {
      await api.delete(`/api/admin/groups/${id}`)
      setGroups(prev => prev.filter(g => g.id !== id))
      toast.success('קבוצה נמחקה')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
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
        {['groups', 'matches', 'finished', 'special', 'users', 'test'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${activeTab === tab ? (tab === 'test' ? 'bg-orange-500 text-black' : 'bg-green-500 text-black') : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            {tab === 'groups' ? `🏷️ קבוצות (${groups.length})`
              : tab === 'matches' ? `⏳ ממתינים (${pendingMatches.length})`
              : tab === 'finished' ? `✅ גמורים (${finishedMatches.length})`
              : tab === 'special' ? '⭐ מיוחדים'
              : tab === 'test' ? `🧪 טסט (${testMatches.length})`
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
                      <td className="py-3 px-4 text-center text-white/60 relative group/members cursor-default select-none">
                        <span className={g.member_count > 0 ? 'underline decoration-dotted decoration-white/30' : ''}>
                          {g.member_count}
                        </span>
                        {g.member_names?.length > 0 && (
                          <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 bg-pitch-800 border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl opacity-0 group-hover/members:opacity-100 pointer-events-none transition-opacity whitespace-nowrap text-right">
                            {g.member_names.map((n, i) => <div key={i}>{n}</div>)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => deleteGroup(g.id, g.name)}
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
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">שם</th>
                <th className="text-right py-3 px-4 text-white/50 text-sm font-medium">קבוצות</th>
                <th className="text-center py-3 px-4 text-white/50 text-sm font-medium">נוצר</th>
                <th className="text-center py-3 px-4 text-white/50 text-sm font-medium">ניחושים</th>
                <th className="text-center py-3 px-4 text-white/50 text-sm font-medium">נקודות</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {[...users].sort((a, b) => b.total_points - a.total_points).map((u) => (
                <Fragment key={u.id}>
                  <tr className="border-b border-white/5">
                    <td className="py-3 px-4">
                      {u.name}
                      {u.is_admin && <span className="mr-2 text-xs text-green-400">(admin)</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-white/50">
                      {u.group_names?.length > 0
                        ? u.group_names.map((gn, i) => (
                            <span key={i} className="inline-block bg-white/10 rounded px-1.5 py-0.5 text-xs ml-1 mb-0.5">{gn}</span>
                          ))
                        : <span className="text-white/20">—</span>
                      }
                    </td>
                    <td className="py-3 px-4 text-center text-white/50 text-xs">{formatDate(u.created_at)}</td>
                    <td className="py-3 px-4 text-center text-white/60 text-sm">{u.prediction_count}</td>
                    <td className="py-3 px-4 text-center font-bold">{u.total_points}</td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setResetPw(resetPw?.id === u.id ? null : { id: u.id, value: '' })}
                          className="text-yellow-400/50 hover:text-yellow-400 text-xs transition-colors"
                          title="אפס סיסמה"
                        >
                          🔑
                        </button>
                        {!u.is_admin && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            disabled={deletingUser === u.id}
                            className="text-red-400/50 hover:text-red-400 text-xs transition-colors disabled:opacity-30"
                          >
                            {deletingUser === u.id ? '...' : 'מחק'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {resetPw?.id === u.id && (
                    <tr key={`${u.id}-pw`} className="border-b border-white/5 bg-yellow-500/5">
                      <td colSpan={6} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/50 whitespace-nowrap">סיסמה חדשה עבור {u.name}:</span>
                          <input
                            type="text"
                            value={resetPw.value}
                            onChange={e => setResetPw(r => ({ ...r, value: e.target.value }))}
                            placeholder="לפחות 4 תווים"
                            className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-1.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400 font-mono"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleResetPassword(u.id)}
                          />
                          <button
                            onClick={() => {
                              const pw = Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6)
                              setResetPw(r => ({ ...r, value: pw }))
                            }}
                            className="text-white/40 hover:text-white/80 text-xs px-2 py-1.5 rounded transition-colors whitespace-nowrap"
                            title="צור סיסמה אקראית"
                          >
                            🎲
                          </button>
                          {resetPw.value && (
                            <button
                              onClick={() => { navigator.clipboard.writeText(resetPw.value); toast.success('הועתק!') }}
                              className="text-white/40 hover:text-white/80 text-xs px-2 py-1.5 rounded transition-colors"
                              title="העתק"
                            >
                              📋
                            </button>
                          )}
                          <button
                            onClick={() => handleResetPassword(u.id)}
                            className="bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                          >
                            אפס
                          </button>
                          <button
                            onClick={() => setResetPw(null)}
                            className="text-white/30 hover:text-white/60 text-xs transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {activeTab === 'test' && (
        <div className="flex flex-col gap-5">
          <div className="card border-orange-500/30 bg-orange-500/5">
            <h2 className="font-bold text-orange-300 mb-4">🧪 צור משחק טסט</h2>
            <form onSubmit={handleCreateTestMatch} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">קבוצת בית</label>
                  <div className="flex gap-2">
                    <input value={testForm.home_flag} onChange={e => setTestForm(f => ({ ...f, home_flag: e.target.value }))}
                      className="w-12 bg-white/10 border border-white/20 rounded px-2 py-2 text-center text-lg focus:outline-none focus:border-orange-400" />
                    <input value={testForm.home_name} onChange={e => setTestForm(f => ({ ...f, home_name: e.target.value }))}
                      placeholder="שם קבוצת בית"
                      className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">קבוצת חוץ</label>
                  <div className="flex gap-2">
                    <input value={testForm.away_flag} onChange={e => setTestForm(f => ({ ...f, away_flag: e.target.value }))}
                      className="w-12 bg-white/10 border border-white/20 rounded px-2 py-2 text-center text-lg focus:outline-none focus:border-orange-400" />
                    <input value={testForm.away_name} onChange={e => setTestForm(f => ({ ...f, away_name: e.target.value }))}
                      placeholder="שם קבוצת חוץ"
                      className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400" required />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">שעת קיקאוף (שעון ישראל)</label>
                  <input type="datetime-local" value={testForm.scheduled_at}
                    onChange={e => setTestForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400" required />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">שלב</label>
                  <select value={testForm.stage} onChange={e => setTestForm(f => ({ ...f, stage: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400">
                    <option value="final">גמר</option>
                    <option value="semi_final">חצי גמר</option>
                    <option value="quarter_final">רבע גמר</option>
                    <option value="group">שלב בתים</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">League ID (API)</label>
                  <input type="number" value={testForm.api_league_id}
                    onChange={e => setTestForm(f => ({ ...f, api_league_id: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Season</label>
                  <input type="number" value={testForm.api_season}
                    onChange={e => setTestForm(f => ({ ...f, api_season: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Fixture ID (אופציונלי)</label>
                  <input type="number" value={testForm.api_fixture_id}
                    onChange={e => setTestForm(f => ({ ...f, api_fixture_id: e.target.value }))}
                    placeholder="אוטומטי אם ריק"
                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-400 placeholder-white/20" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleSearchFixtures} disabled={searchingFixtures}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {searchingFixtures ? '⏳ מחפש...' : '🔍 חפש fixture לפי תאריך'}
                </button>
                <button type="submit" disabled={creatingTest}
                  className="flex-1 bg-orange-500 hover:bg-orange-400 text-black font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {creatingTest ? '⏳ יוצר...' : '🧪 צור משחק טסט'}
                </button>
              </div>

              {fixtureResults && fixtureResults.length > 0 && (
                <div className="bg-black/30 rounded-lg p-3 flex flex-col gap-2">
                  <p className="text-xs text-white/40 mb-1">בחר משחק להעתקת fixture_id:</p>
                  {fixtureResults.map(f => (
                    <button
                      key={f.fixture_id}
                      type="button"
                      onClick={() => {
                        setTestForm(prev => ({ ...prev, api_fixture_id: String(f.fixture_id) }))
                        toast.success(`fixture_id ${f.fixture_id} הוגדר`)
                      }}
                      className="flex items-center justify-between text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-right transition-colors"
                    >
                      <code className="text-orange-300 font-mono">{f.fixture_id}</code>
                      <span className="text-white/70">{f.home} vs {f.away}</span>
                      <span className="text-white/30">{f.date?.slice(11,16)}</span>
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>

          {testMatchCards.length === 0 ? (
            <div className="text-center py-8 text-white/30">אין משחקי טסט — צור אחד למעלה</div>
          ) : (
            <div className="flex flex-col gap-4">
              {testMatchCards.map(m => {
                const meta = testMatches.find(t => t.id === m.id)
                return (
                  <div key={m.id}>
                    <MatchCard match={m} onPredictionSaved={async () => {
                      const tcRes = await api.get('/api/admin/test-matches/cards')
                      setTestMatchCards(tcRes.data)
                    }} />

                    {/* Management buttons */}
                    <div className="flex gap-2 mt-2 px-1 justify-center">
                      {meta && <span className="text-xs text-white/25">fixture_id: <code className="text-orange-300">{meta.api_fixture_id || '—'}</code></span>}
                      <button
                        onClick={() => handleSyncTestMatch(m.id)}
                        disabled={syncingTest === m.id || !meta?.api_fixture_id}
                        className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {syncingTest === m.id ? '⏳' : '🔄'} סנכרן
                      </button>
                      <button
                        onClick={() => handleDeleteTestMatch(m.id)}
                        className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded-lg transition-colors"
                      >
                        🗑️ מחק
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
