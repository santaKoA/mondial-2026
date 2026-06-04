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

function ManualScoreRow({ match, onSave }) {
  const [h, setH] = useState(match.home_score != null ? String(match.home_score) : '')
  const [a, setA] = useState(match.away_score != null ? String(match.away_score) : '')
  const [saving, setSaving] = useState(false)

  async function save() {
    const home = parseInt(h), away = parseInt(a)
    if (isNaN(home) || isNaN(away)) { toast.error('הזן תוצאה'); return }
    setSaving(true)
    await onSave(match.id, home, away)
    setSaving(false)
  }

  const inSt = { width: '40px', height: '32px', textAlign: 'center', fontSize: '14px', fontWeight: 700, background: 'rgba(0,0,0,.4)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '6px', color: '#fff', outline: 'none', fontFamily: 'Heebo, sans-serif' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px', padding: '8px 12px', background: 'rgba(255,255,255,.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,.08)' }}>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)' }}>עדכון ידני:</span>
      <input type="number" min="0" max="20" value={h} onChange={e => setH(e.target.value)} style={inSt} />
      <span style={{ color: 'rgba(255,255,255,.3)' }}>–</span>
      <input type="number" min="0" max="20" value={a} onChange={e => setA(e.target.value)} style={inSt} />
      <button onClick={save} disabled={saving || h === '' || a === ''} style={{
        background: 'rgba(251,146,60,.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,.25)',
        fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '12px',
        padding: '5px 12px', borderRadius: '7px', cursor: saving || h === '' || a === '' ? 'default' : 'pointer',
        opacity: h === '' || a === '' ? 0.4 : 1,
      }}>{saving ? '...' : '✔ שמור'}</button>
    </div>
  )
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

  const cellSt = { padding: '11px 16px', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,.04)' }
  const numSt = { width: '44px', textAlign: 'center', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '6px', padding: '4px', fontSize: '13px', fontWeight: 700, color: '#fff', outline: 'none', fontFamily: 'Heebo, sans-serif' }
  const selSt = { flex: 1, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '6px', padding: '4px 6px', fontSize: '11px', color: '#fff', outline: 'none' }
  return (
    <tr>
      <td style={{ ...cellSt, color: 'rgba(255,255,255,.4)', fontSize: '12px' }}>
        {formatIsrael(match.scheduled_at)}
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.25)', marginTop: '2px' }}>{STAGE_LABELS[match.stage]}{match.group_name && ` · ${match.group_name}`}</div>
      </td>
      <td style={cellSt}>
        {needsTeams ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <select value={homeTeamId} onChange={e => setHomeTeamId(e.target.value)} style={selSt}>
              <option value="">בית</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
            </select>
            <span style={{ color: 'rgba(255,255,255,.3)' }}>-</span>
            <select value={awayTeamId} onChange={e => setAwayTeamId(e.target.value)} style={selSt}>
              <option value="">אורח</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
            </select>
            <button onClick={saveTeams} disabled={saving} style={{
              background: 'rgba(30,222,98,.15)', color: '#1ede62', border: '1px solid rgba(30,222,98,.2)',
              fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
            }}>שמור</button>
          </div>
        ) : (
          <span>{match.home_team?.flag} {match.home_team?.name} <span style={{ color: 'rgba(255,255,255,.3)' }}>–</span> {match.away_team?.flag} {match.away_team?.name}</span>
        )}
      </td>
      <td style={cellSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="number" min="0" max="99" value={home} onChange={e => setHome(e.target.value)} placeholder="0" style={numSt} />
          <span style={{ color: 'rgba(255,255,255,.3)' }}>–</span>
          <input type="number" min="0" max="99" value={away} onChange={e => setAway(e.target.value)} placeholder="0" style={numSt} />
          <button onClick={saveResult} disabled={saving} style={{
            background: match.status === 'finished' ? 'rgba(245,200,66,.15)' : 'rgba(30,222,98,.15)',
            color: match.status === 'finished' ? '#f5c842' : '#1ede62',
            border: `1px solid ${match.status === 'finished' ? 'rgba(245,200,66,.25)' : 'rgba(30,222,98,.2)'}`,
            fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '12px',
            padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', opacity: saving ? 0.5 : 1,
          }}>{saving ? '...' : match.status === 'finished' ? '✏️' : '✓'}</button>
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
  const [testMatches, setTestMatches] = useState([])
  const [testMatchCards, setTestMatchCards] = useState([])
  const [testSearchDate, setTestSearchDate] = useState('')
  const [testSearchStage, setTestSearchStage] = useState('')
  const [testSeason, setTestSeason] = useState(2026)
  const [creatingTest, setCreatingTest] = useState(null) // fixture_id being created
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
    if (!testSearchDate) { toast.error('בחר תאריך קודם'); return }
    setSearchingFixtures(true)
    setFixtureResults(null)
    try {
      const { data } = await api.get('/api/admin/search-fixtures', {
        params: { date: testSearchDate, season: testSeason }
      })
      setFixtureResults(data)
      if (data.length === 0) toast.error('לא נמצאו משחקים בתאריך זה')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה בחיפוש')
    } finally {
      setSearchingFixtures(false)
    }
  }

  async function handleCreateTestMatch(fixtureId, stage) {
    setCreatingTest(fixtureId)
    try {
      const { data } = await api.post('/api/admin/test-match', {
        fixture_id: fixtureId,
        stage,
        api_season: testSeason,
      })
      setTestMatches(prev => [...prev, data])
      const tcRes = await api.get('/api/admin/test-matches/cards')
      setTestMatchCards(tcRes.data)
      setFixtureResults(null)
      toast.success(`✅ ${data.test_home_name} vs ${data.test_away_name} נוצר!`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setCreatingTest(null)
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

  async function handleManualScore(id, homeScore, awayScore) {
    try {
      await api.put(`/api/admin/matches/${id}/result`, { home_score: homeScore, away_score: awayScore })
      const tcRes = await api.get('/api/admin/test-matches/cards')
      setTestMatchCards(tcRes.data)
      toast.success(`תוצאה עודכנה: ${homeScore}–${awayScore}`)
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
      const { data } = await api.post('/api/admin/special-predictions/correct', {
        prediction_type: specialType,
        correct_value: specialValue,
        points_awarded: specialPoints,
      })
      toast.success(`✅ נקודות הוענקו! ${data.correct_count} משתתפים ניחשו נכון`)
      await loadData()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setSaving(false)
    }
  }

  const pendingMatches = matches.filter(m => m.status === 'upcoming')
  const finishedMatches = matches.filter(m => m.status === 'finished')

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,.3)', fontSize: '14px' }}>טוען...</div>

  const inputSt = {
    background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.14)',
    borderRadius: '9px', padding: '9px 13px', color: '#ecf0ed',
    fontFamily: 'Heebo, sans-serif', fontSize: '13px',
    outline: 'none', transition: 'border-color .15s',
  }
  const tableSt = {
    background: '#0c1810', border: '1px solid rgba(255,255,255,.06)', borderRadius: '14px', overflow: 'hidden',
    boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.4)',
  }
  const th = { padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,.3)', borderBottom: '1px solid rgba(255,255,255,.06)', textAlign: 'right' }
  const td = { padding: '11px 16px', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,.04)' }

  const ADMIN_TABS = [
    { key: 'groups',   label: `🏷️ קבוצות (${groups.length})` },
    { key: 'matches',  label: `⏳ ממתינים (${pendingMatches.length})` },
    { key: 'finished', label: `✅ גמורים (${finishedMatches.length})` },
    { key: 'special',  label: '⭐ מיוחדים' },
    { key: 'users',    label: `👥 משתמשים (${users.length})` },
    { key: 'test',     label: `🧪 טסט (${testMatches.length})` },
  ]

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>🛠 פאנל ניהול</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {syncStatus && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {syncStatus.error ? (
                <span style={{ color: '#f04a58' }}>{syncStatus.error}</span>
              ) : syncStatus.last_sync_at ? (
                <span>סונכרן: {formatIsrael(syncStatus.last_sync_at)}</span>
              ) : (
                <span>{syncStatus.api_configured ? 'טרם סונכרן' : 'API לא מוגדר'}</span>
              )}
              {syncStatus.unlinked_count > 0 && (
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ color: '#fb923c' }}>⚠️ {syncStatus.unlinked_count} משחקים ללא fixture_id</summary>
                  <ul style={{ marginTop: '4px', paddingRight: '8px', color: 'rgba(255,255,255,.4)' }}>
                    {syncStatus.unlinked_matches?.map(m => <li key={m}>· {m}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
          {[
            { label: syncing ? 'מסנכרן...' : '🔄 סנכרן תוצאות', bg: 'rgba(96,165,250,.12)', text: '#60a5fa', border: 'rgba(96,165,250,.2)', onClick: handleSync, disabled: syncing },
            { label: '🔗 קשר fixtures', bg: 'rgba(168,85,247,.12)', text: '#c084fc', border: 'rgba(168,85,247,.2)', onClick: async () => {
                try {
                  const { data } = await api.post('/api/admin/link-fixtures')
                  toast.success(`🔗 קושרו ${data.linked}/${data.total_api} משחקים${data.not_found?.length ? ` · לא נמצאו: ${data.not_found.length}` : ''}`)
                  if (data.not_found?.length) console.warn('לא נמצאו:', data.not_found)
                } catch (e) { toast.error(e.response?.data?.detail || 'שגיאה') }
              }
            },
          ].map(b => (
            <button key={b.label} onClick={b.onClick} disabled={b.disabled} style={{
              background: b.bg, color: b.text, border: `1px solid ${b.border}`,
              fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '12px',
              padding: '7px 13px', borderRadius: '9px', cursor: 'pointer', transition: 'all .15s',
              opacity: b.disabled ? 0.5 : 1,
            }}>{b.label}</button>
          ))}
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '18px', scrollbarWidth: 'none' }}>
        {ADMIN_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            whiteSpace: 'nowrap', padding: '7px 15px', borderRadius: '100px', border: 'none',
            cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: '13px', fontWeight: 500, flexShrink: 0,
            background: activeTab === t.key ? (t.key === 'test' ? '#f0b429' : '#1ede62') : 'rgba(255,255,255,.07)',
            color:      activeTab === t.key ? '#000' : 'rgba(255,255,255,.6)',
            transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── GROUPS */}
      {activeTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGroup()}
              placeholder="שם הקבוצה החדשה" style={{ ...inputSt, flex: 1 }}
              onFocus={e => e.target.style.borderColor = '#1ede62'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'}
            />
            <button onClick={createGroup} disabled={creatingGroup || !newGroupName.trim()} style={{
              background: '#1ede62', color: '#000', fontFamily: 'Heebo, sans-serif',
              fontWeight: 700, fontSize: '13px', padding: '9px 18px', borderRadius: '9px', border: 'none',
              cursor: creatingGroup || !newGroupName.trim() ? 'default' : 'pointer',
              opacity: !newGroupName.trim() ? 0.4 : 1,
            }}>{creatingGroup ? '...' : '+ צור קבוצה'}</button>
          </div>

          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,.3)' }}>אין קבוצות עדיין</div>
          ) : (
            <div style={{ ...tableSt, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '380px' }}>
                <thead><tr>
                  <th style={th}>שם הקבוצה</th>
                  <th style={th}>קוד הצטרפות</th>
                  <th style={{ ...th, textAlign: 'center' }}>חברים</th>
                  <th style={{ ...th, width: '60px' }}></th>
                </tr></thead>
                <tbody>
                  {groups.map((g, i) => (
                    <tr key={g.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)' }}>
                      <td style={td}>{g.name}</td>
                      <td style={td}>
                        <code onClick={() => { navigator.clipboard?.writeText(g.code); toast.success('קוד הועתק!') }}
                          style={{ background: 'rgba(30,222,98,.12)', color: '#1ede62', padding: '3px 10px', borderRadius: '8px', fontSize: '13px', letterSpacing: '1px', cursor: 'pointer' }}>
                          {g.code}
                        </code>
                      </td>
                      <td style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,.5)' }}>{g.member_count}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <button onClick={() => deleteGroup(g.id, g.name)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,74,90,.45)',
                          fontSize: '12px', fontFamily: 'Heebo, sans-serif', transition: 'color .15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.color = '#f04a58'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,74,90,.45)'}
                        >מחק</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ background: 'rgba(96,165,250,.06)', border: '1px solid rgba(96,165,250,.15)', borderRadius: '12px', padding: '14px 16px', fontSize: '12px', color: 'rgba(255,255,255,.45)', lineHeight: 1.7 }}>
            💡 צור קבוצה לכל חוג — עבודה, משפחה, חברים. שתף את הקוד, כל אחד מצטרף עצמאית. הניחושים משותפים לכולם.
          </div>
        </div>
      )}

      {/* ── MATCHES / FINISHED */}
      {(activeTab === 'matches' || activeTab === 'finished') && (
        <div style={{ ...tableSt, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
            <thead><tr>
              <th style={th}>תאריך</th>
              <th style={th}>משחק</th>
              <th style={{ ...th, textAlign: 'center' }}>תוצאה</th>
            </tr></thead>
            <tbody>
              {(activeTab === 'matches' ? pendingMatches : finishedMatches).map(m => (
                <MatchResultRow key={m.id} match={m} teams={teams} onSaved={loadData} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SPECIAL */}
      {activeTab === 'special' && (
        <div style={{ maxWidth: '420px' }}>
          <div style={{ ...tableSt, padding: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>הגדרת תוצאה לניחושים מיוחדים</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>סוג הניחוש</label>
                <select value={specialType} onChange={e => { setSpecialType(e.target.value); setSpecialPoints(15); setSpecialValue('') }}
                  style={{ ...inputSt, width: '100%', cursor: 'pointer' }}>
                  <option value="winner">🏆 זוכה המונדיאל (15 נק׳)</option>
                  <option value="top_scorer">⚽ מלך השערים (15 נק׳)</option>
                </select>
              </div>
              {specialType === 'winner' ? (
                <TeamPicker value={specialValue} onChange={setSpecialValue} />
              ) : (
                <PlayerPicker value={specialValue} onChange={setSpecialValue} />
              )}
              {specialValue && (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.5)', padding: '8px 12px', background: 'rgba(255,255,255,.04)', borderRadius: '8px' }}>
                  נבחר: <span style={{ color: '#fff', fontWeight: 600 }}>{specialValue}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,.5)' }}>נקודות:</label>
                <input type="number" value={specialPoints} onChange={e => setSpecialPoints(parseInt(e.target.value) || 0)}
                  style={{ ...inputSt, width: '70px', textAlign: 'center' }} />
              </div>
              <button onClick={handleSpecialResult} disabled={saving || !specialValue.trim()} style={{
                background: specialValue ? '#1ede62' : 'rgba(255,255,255,.07)',
                color: specialValue ? '#000' : 'rgba(255,255,255,.3)',
                fontFamily: 'Heebo, sans-serif', fontWeight: 700, fontSize: '14px',
                padding: '11px', borderRadius: '9px', border: 'none',
                cursor: saving || !specialValue.trim() ? 'default' : 'pointer', transition: 'all .15s',
              }}>הענק נקודות</button>
            </div>
          </div>
        </div>
      )}

      {/* ── USERS */}
      {activeTab === 'users' && (
        <div style={{ ...tableSt, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '580px' }}>
            <thead><tr>
              <th style={th}>שם</th>
              <th style={th}>קבוצות</th>
              <th style={{ ...th, textAlign: 'center' }}>נוצר</th>
              <th style={{ ...th, textAlign: 'center' }}>ניחושים</th>
              <th style={{ ...th, textAlign: 'center' }}>נקודות</th>
              <th style={{ ...th, width: '80px' }}></th>
            </tr></thead>
            <tbody>
              {[...users].sort((a, b) => b.total_points - a.total_points).map((u, i) => (
                <Fragment key={u.id}>
                  <tr style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {u.name}
                        {u.is_admin && <span style={{ fontSize: '10px', color: '#1ede62', background: 'rgba(30,222,98,.12)', padding: '1px 6px', borderRadius: '4px' }}>admin</span>}
                      </div>
                    </td>
                    <td style={{ ...td, color: 'rgba(255,255,255,.45)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {u.group_names?.length > 0
                          ? u.group_names.map((gn, j) => (
                              <span key={j} style={{ fontSize: '11px', background: 'rgba(255,255,255,.08)', padding: '2px 8px', borderRadius: '6px', color: 'rgba(255,255,255,.6)' }}>{gn}</span>
                            ))
                          : <span style={{ color: 'rgba(255,255,255,.2)' }}>—</span>
                        }
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,.4)', fontSize: '11px' }}>{formatDate(u.created_at)}</td>
                    <td style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,.5)' }}>{u.prediction_count}</td>
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{u.total_points}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button onClick={() => setResetPw(resetPw?.id === u.id ? null : { id: u.id, value: '' })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: .5, transition: 'opacity .15s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '.5'}
                        >🔑</button>
                        {!u.is_admin && (
                          <button onClick={() => handleDeleteUser(u.id, u.name)} disabled={deletingUser === u.id} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(240,74,90,.4)', fontSize: '12px', fontFamily: 'Heebo, sans-serif', transition: 'color .15s',
                            opacity: deletingUser === u.id ? 0.3 : 1,
                          }}
                            onMouseEnter={e => e.currentTarget.style.color = '#f04a58'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,74,90,.4)'}
                          >{deletingUser === u.id ? '...' : 'מחק'}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {resetPw?.id === u.id && (
                    <tr key={`${u.id}-pw`} style={{ background: 'rgba(245,200,66,.04)' }}>
                      <td colSpan={6} style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap' }}>סיסמה חדשה עבור {u.name}:</span>
                          <input type="password" value={resetPw.value} onChange={e => setResetPw(r => ({ ...r, value: e.target.value }))}
                            placeholder="לפחות 4 תווים" autoFocus
                            style={{ ...inputSt, flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
                            onKeyDown={e => e.key === 'Enter' && handleResetPassword(u.id)}
                            onFocus={e => e.target.style.borderColor = '#f5c842'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'}
                          />
                          <button onClick={() => { const pw = Math.random().toString(36).slice(2,6)+Math.random().toString(36).slice(2,6); setResetPw(r => ({...r,value:pw})) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', opacity: .5 }}>🎲</button>
                          {resetPw.value && (
                            <button onClick={() => { navigator.clipboard.writeText(resetPw.value); toast.success('הועתק!') }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: .5 }}>📋</button>
                          )}
                          <button onClick={() => handleResetPassword(u.id)} style={{
                            background: resetPw.value.length >= 4 ? 'rgba(245,200,66,.2)' : 'rgba(255,255,255,.07)',
                            color: resetPw.value.length >= 4 ? '#f5c842' : 'rgba(255,255,255,.3)',
                            fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '12px',
                            padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>אפס</button>
                          <button onClick={() => setResetPw(null)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: '14px',
                          }}>✕</button>
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

      {/* ── TEST */}
      {activeTab === 'test' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(240,180,40,.06)', border: '1px solid rgba(240,180,40,.2)', borderRadius: '14px', padding: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f0b429', marginBottom: '16px' }}>🧪 הוסף משחק טסט</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>תאריך</label>
                  <input type="date" value={testSearchDate} onChange={e => { setTestSearchDate(e.target.value); setFixtureResults(null) }}
                    style={{ ...inputSt, width: '100%' }}
                    onFocus={e => e.target.style.borderColor = '#f0b429'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>עונה</label>
                  <input type="number" value={testSeason} onChange={e => setTestSeason(Number(e.target.value))}
                    style={{ ...inputSt, width: '100%' }}
                    onFocus={e => e.target.style.borderColor = '#f0b429'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>סנן לפי שלב</label>
                  <select value={testSearchStage} onChange={e => setTestSearchStage(e.target.value)}
                    style={{ ...inputSt, width: '100%', cursor: 'pointer' }}>
                    <option value="">כל השלבים</option>
                    <option value="group">שלב הבתים</option>
                    <option value="round_of_32">שלב ה-32</option>
                    <option value="round_of_16">שמינית גמר</option>
                    <option value="quarter_final">רבע גמר</option>
                    <option value="semi_final">חצי גמר</option>
                    <option value="final">גמר</option>
                  </select>
                </div>
              </div>
              <button onClick={handleSearchFixtures} disabled={searchingFixtures || !testSearchDate} style={{
                background: 'rgba(240,180,40,.15)', color: '#f0b429', border: '1px solid rgba(240,180,40,.25)',
                fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '13px',
                padding: '10px', borderRadius: '9px', cursor: searchingFixtures || !testSearchDate ? 'default' : 'pointer',
                opacity: !testSearchDate ? 0.5 : 1,
              }}>{searchingFixtures ? '⏳ מחפש...' : '🔍 חפש משחקים'}</button>

              {fixtureResults && (
                <div style={{ background: 'rgba(0,0,0,.3)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {fixtureResults.length === 0 ? (
                    <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,.3)' }}>לא נמצאו משחקים</p>
                  ) : (() => {
                    const STAGE_MAP = {
                      'GROUP_STAGE': 'group', 'ROUND_OF_32': 'round_of_32',
                      'ROUND_OF_16': 'round_of_16', 'QUARTER_FINALS': 'quarter_final',
                      'SEMI_FINALS': 'semi_final', 'FINAL': 'final', 'THIRD_PLACE': 'third_place',
                    }
                    const filtered = testSearchStage ? fixtureResults.filter(f => STAGE_MAP[f.stage] === testSearchStage) : fixtureResults
                    return filtered.length === 0 ? (
                      <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,.3)' }}>אין משחקים בשלב זה</p>
                    ) : filtered.map(f => {
                      const stage = STAGE_MAP[f.stage] || 'group'
                      const alreadyExists = testMatches.some(t => t.api_fixture_id === f.fixture_id)
                      return (
                        <div key={f.fixture_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '9px', padding: '10px 12px' }}>
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.home} vs {f.away}</div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)', marginTop: '2px' }}>{f.israel_time} 🇮🇱 · {STAGE_LABELS[stage] || stage}</div>
                          </div>
                          {alreadyExists ? (
                            <span style={{ fontSize: '12px', color: '#1ede62', whiteSpace: 'nowrap' }}>✅ קיים</span>
                          ) : (
                            <button onClick={() => handleCreateTestMatch(f.fixture_id, stage)} disabled={creatingTest === f.fixture_id} style={{
                              background: 'rgba(240,180,40,.15)', color: '#f0b429', border: '1px solid rgba(240,180,40,.25)',
                              fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '12px',
                              padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', whiteSpace: 'nowrap',
                              opacity: creatingTest === f.fixture_id ? 0.4 : 1,
                            }}>{creatingTest === f.fixture_id ? '⏳' : '+ הוסף'}</button>
                          )}
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
          </div>

          {testMatchCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,.2)', fontSize: '13px' }}>אין משחקי טסט — צור אחד למעלה</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {testMatchCards.map(m => {
                const meta = testMatches.find(t => t.id === m.id)
                return (
                  <div key={m.id}>
                    <MatchCard match={m} onPredictionSaved={async () => {
                      const tcRes = await api.get('/api/admin/test-matches/cards')
                      setTestMatchCards(tcRes.data)
                    }} />
                    <ManualScoreRow match={m} onSave={handleManualScore} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', justifyContent: 'center', alignItems: 'center' }}>
                      {meta && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.2)', width: '100%', textAlign: 'center' }}>fixture_id: <code style={{ color: '#fb923c' }}>{meta.api_fixture_id || '—'}</code></span>}
                      <button onClick={() => handleSyncTestMatch(m.id)} disabled={syncingTest === m.id || !meta?.api_fixture_id} style={{
                        background: 'rgba(96,165,250,.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,.2)',
                        fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '12px',
                        padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', opacity: syncingTest === m.id || !meta?.api_fixture_id ? 0.4 : 1,
                      }}>{syncingTest === m.id ? '⏳' : '🔄'} סנכרן API</button>
                      <button onClick={() => handleDeleteTestMatch(m.id)} style={{
                        background: 'rgba(240,74,90,.15)', color: '#f04a58', border: '1px solid rgba(240,74,90,.2)',
                        fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '12px',
                        padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
                      }}>🗑️ מחק</button>
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
