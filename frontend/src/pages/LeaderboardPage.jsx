import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { WC_PLAYERS } from '../data/worldcup.js'

const PLAYER_MAP = Object.fromEntries(WC_PLAYERS.map(p => [p.name, p]))

function PlayerAvatar({ name }) {
  const [failed, setFailed] = useState(false)
  if (!name) return <span style={{ fontSize: '16px' }}>—</span>
  const p = PLAYER_MAP[name]
  const src = p?.localImg || (p?.apiId ? `https://media.api-sports.io/football/players/${p.apiId}.png` : null)
  if (!src || failed) {
    return <span style={{ fontSize: '13px', color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>{p?.flag || '⚽'}</span>
  }
  return (
    <img src={src} alt={name} title={name}
      onError={() => setFailed(true)}
      style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
    />
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

function GroupTable({ group, isOwner, me, teamFlags, onRemoveMember }) {
  const [users, setUsers] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.get(`/api/leaderboard?group_id=${group.id}`)
      .then(r => setUsers(r.data))
      .catch(() => { setUsers([]); toast.error('שגיאה בטעינת לוח הדירוג') })
  }, [group.id])

  async function handleRemove(userId, userName) {
    if (!window.confirm(`להסיר את ${userName} מהקבוצה?`)) return
    setRemoving(userId)
    try {
      await api.delete(`/api/leaderboard/groups/${group.id}/members/${userId}`)
      toast.success('החבר הוסר מהקבוצה')
      setUsers(prev => prev.filter(u => u.id !== userId))
      onRemoveMember()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'שגיאה')
    } finally {
      setRemoving(null)
    }
  }

  function copyCode() {
    navigator.clipboard?.writeText(group.code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const maxPts = users ? Math.max(...users.map(u => u.total_points), 1) : 1

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700 }}>
          {group.name}
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,.3)', marginRight: '6px' }}>
            ({group.member_count} משתתפים)
          </span>
        </h2>
        <button onClick={copyCode} style={{
          display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
          background: 'none', border: 'none', fontFamily: 'Heebo, sans-serif',
        }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.3)' }}>קוד:</span>
          <code style={{
            fontSize: '13px', fontWeight: 700, letterSpacing: '2px',
            color: '#1ede62', background: 'rgba(30,222,98,.1)', padding: '2px 8px', borderRadius: '6px',
          }}>{copied ? '✓ הועתק' : group.code}</code>
        </button>
      </div>

      {/* Column legend */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', marginBottom: '5px' }}>
        <div style={{ width: '28px', flexShrink: 0 }} />
        <div style={{ flex: 1, margin: '0 10px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div style={{ width: '24px', textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,.22)' }}>🎯</div>
          <div style={{ width: '24px', textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,.22)' }}>↗</div>
          <div style={{ width: '22px', textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,.22)' }}>🏆</div>
          <div style={{ width: '36px', textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,.22)' }}>⚽</div>
          <div style={{ width: '40px', textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,.22)' }}>נק׳</div>
          {isOwner && <div style={{ width: '24px' }} />}
        </div>
      </div>

      <div style={{
        background: '#0c1810', border: '1px solid rgba(255,255,255,.06)', borderRadius: '14px', overflow: 'hidden',
        boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.45)',
      }}>
        {users === null ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,.3)', fontSize: '14px' }}>טוען...</div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,.3)', fontSize: '14px' }}>אין משתתפים עדיין</div>
        ) : users.map((user, i) => (
          <div key={user.id} style={{
            display: 'flex', alignItems: 'center', padding: '11px 14px',
            borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
            background: user.id === me?.id ? 'rgba(30,222,98,.05)' : 'transparent', transition: 'background .15s',
          }}
            onMouseEnter={e => { if (user.id !== me?.id) e.currentTarget.style.background = 'rgba(255,255,255,.025)' }}
            onMouseLeave={e => { if (user.id !== me?.id) e.currentTarget.style.background = 'transparent' }}
          >
            {/* Rank */}
            <div style={{
              width: '28px', textAlign: 'center', flexShrink: 0,
              fontSize: i < 3 ? '18px' : '13px',
              color: i >= 3 ? 'rgba(255,255,255,.28)' : undefined,
              fontWeight: i >= 3 ? 600 : undefined,
            }}>{MEDALS[i] || i + 1}</div>

            {/* Name + progress bar */}
            <div style={{ flex: 1, margin: '0 10px', minWidth: 0 }}>
              <div onClick={() => navigate(`/user/${user.id}?group=${group.id}`)} style={{
                fontSize: '14px', fontWeight: user.id === me?.id ? 700 : 500,
                color: user.id === me?.id ? '#1ede62' : '#ecf0ed',
                display: 'flex', alignItems: 'center', gap: '4px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                cursor: 'pointer',
              }}>
                {user.name}
                {user.id === me?.id && <span style={{ fontSize: '10px', opacity: .5, fontWeight: 400 }}>(אני)</span>}
              </div>
              <div style={{ marginTop: '4px', height: '3px', width: '100%', maxWidth: '80px', background: 'rgba(255,255,255,.07)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${(user.total_points / maxPts) * 100}%`,
                  background: i === 0 ? 'linear-gradient(90deg,#f0b429,#1ede62)' : i < 3 ? '#1ede62' : 'rgba(255,255,255,.3)',
                  borderRadius: '4px',
                }} />
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* Exact */}
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                background: user.exact_count > 0 ? 'rgba(30,222,98,.15)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                color: user.exact_count > 0 ? '#1ede62' : 'rgba(255,255,255,.2)',
              }}>{user.exact_count}</div>
              {/* Direction */}
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                background: user.direction_count > 0 ? 'rgba(245,200,66,.15)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                color: user.direction_count > 0 ? '#f5c842' : 'rgba(255,255,255,.2)',
              }}>{user.direction_count}</div>
              {/* Winner flag */}
              <div style={{ width: '22px', textAlign: 'center', fontSize: '18px', flexShrink: 0 }}>
                {user.winner_pick ? (teamFlags[user.winner_pick] || user.winner_pick) : '—'}
              </div>
              {/* Top scorer - avatar */}
              <div style={{ width: '36px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <PlayerAvatar name={user.top_scorer_pick} />
              </div>
              {/* Points */}
              <div style={{
                fontSize: '20px', fontWeight: 900, width: '40px', textAlign: 'center',
                fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                color: i === 0 ? '#f0b429' : i === 1 ? 'rgba(255,255,255,.85)' : i === 2 ? '#cd7f32' : '#ecf0ed',
              }}>{user.total_points}</div>
              {/* Remove button */}
              {isOwner && (
                <button
                  onClick={() => handleRemove(user.id, user.name)}
                  disabled={removing === user.id || user.id === me?.id}
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: user.id === me?.id ? 'transparent' : 'rgba(240,74,90,.12)',
                    border: user.id === me?.id ? 'none' : '1px solid rgba(240,74,90,.2)',
                    cursor: user.id === me?.id ? 'default' : 'pointer',
                    color: user.id === me?.id ? 'transparent' : '#f04a58',
                    fontSize: '12px', transition: 'all .15s',
                    opacity: removing === user.id ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (user.id !== me?.id) { e.currentTarget.style.background = 'rgba(240,74,90,.3)'; e.currentTarget.style.borderColor = 'rgba(240,74,90,.5)' } }}
                  onMouseLeave={e => { if (user.id !== me?.id) { e.currentTarget.style.background = 'rgba(240,74,90,.12)'; e.currentTarget.style.borderColor = 'rgba(240,74,90,.2)' } }}
                >{removing === user.id ? '...' : '✕'}</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const [groups, setGroups]         = useState([])
  const [teamFlags, setTeamFlags]   = useState({})
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin]     = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [joinCode, setJoinCode]     = useState('')
  const [creating, setCreating]     = useState(false)
  const [joining, setJoining]       = useState(false)
  const [newGroup, setNewGroup]     = useState(null)
  const { user: me } = useAuth()

  const inputSt = {
    flex: 1, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.14)',
    borderRadius: '9px', padding: '9px 13px', color: '#ecf0ed',
    fontFamily: 'Heebo, sans-serif', fontSize: '13px',
    outline: 'none', transition: 'border-color .15s',
  }

  useEffect(() => {
    api.get('/api/matches/teams')
      .then(r => {
        const map = {}
        r.data.forEach(t => { map[t.name] = t.flag })
        setTeamFlags(map)
      })
      .catch(() => {})
  }, [])

  const loadGroups = useCallback(() => {
    api.get('/api/leaderboard/groups')
      .then(r => setGroups(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  async function handleCreateGroup(e) {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setCreating(true)
    try {
      const { data } = await api.post('/api/auth/groups', { name: newGroupName.trim() })
      setGroups(prev => [...prev, data])
      setNewGroup(data)
      setNewGroupName('')
      setShowCreate(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'שגיאה')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoinGroup(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    try {
      const { data } = await api.post('/api/auth/join-group', { code: joinCode.trim() })
      setGroups(prev => [...prev, data])
      setJoinCode('')
      setShowJoin(false)
      toast.success(`הצטרפת לקבוצה "${data.name}"! 🎉`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'קוד שגוי')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>טבלת דירוג</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setShowJoin(v => !v); setShowCreate(false) }} style={{
            background: showJoin ? '#1ede62' : 'rgba(255,255,255,.07)',
            color:      showJoin ? '#000'    : 'rgba(255,255,255,.6)',
            fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '13px',
            padding: '7px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer', transition: 'all .15s',
          }}>🔗 הצטרף לקבוצה</button>
          <button onClick={() => { setShowCreate(v => !v); setShowJoin(false); setNewGroup(null) }} style={{
            background: showCreate ? '#1ede62' : 'rgba(255,255,255,.07)',
            color:      showCreate ? '#000'    : 'rgba(255,255,255,.6)',
            fontFamily: 'Heebo, sans-serif', fontWeight: 600, fontSize: '13px',
            padding: '7px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer', transition: 'all .15s',
          }}>+ קבוצה חדשה</button>
        </div>
      </div>

      {/* Join form */}
      {showJoin && (
        <form onSubmit={handleJoinGroup} style={{
          background: 'rgba(30,222,98,.06)', border: '1px solid rgba(30,222,98,.2)',
          borderRadius: '12px', padding: '14px 16px', marginBottom: '18px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,.5)', margin: 0 }}>הכנס את קוד הקבוצה שקיבלת:</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)}
              placeholder="הקוד שקיבלת" style={{ ...inputSt, letterSpacing: '3px', fontWeight: 700 }}
              onFocus={e => e.target.style.borderColor = '#1ede62'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'}
              autoFocus
            />
            <button type="submit" disabled={joining || joinCode.length < 4} style={{
              background: '#1ede62', color: '#000', fontFamily: 'Heebo, sans-serif', fontWeight: 700,
              fontSize: '13px', padding: '9px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              opacity: joinCode.length < 4 ? 0.4 : 1, transition: 'opacity .15s',
            }}>{joining ? '...' : 'הצטרף'}</button>
          </div>
        </form>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreateGroup} style={{
          background: 'rgba(96,165,250,.06)', border: '1px solid rgba(96,165,250,.2)',
          borderRadius: '12px', padding: '14px 16px', marginBottom: '18px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,.5)', margin: 0 }}>שם הקבוצה החדשה:</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              placeholder='"חברים מהעבודה"' style={inputSt}
              onFocus={e => e.target.style.borderColor = '#60a5fa'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'}
              autoFocus
            />
            <button type="submit" disabled={creating || !newGroupName.trim()} style={{
              background: '#60a5fa', color: '#000', fontFamily: 'Heebo, sans-serif', fontWeight: 700,
              fontSize: '13px', padding: '9px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              opacity: !newGroupName.trim() ? 0.4 : 1, transition: 'opacity .15s',
            }}>{creating ? '...' : 'צור וקבל קוד'}</button>
          </div>
        </form>
      )}

      {/* New group created banner */}
      {newGroup && (
        <div style={{
          background: 'rgba(30,222,98,.08)', border: '1px solid rgba(30,222,98,.25)',
          borderRadius: '12px', padding: '14px 16px', marginBottom: '18px', cursor: 'pointer',
        }} onClick={() => { navigator.clipboard?.writeText(newGroup.code); toast.success('קוד הועתק!') }}>
          <p style={{ fontSize: '13px', color: 'rgba(30,222,98,.8)', margin: '0 0 4px' }}>✅ הקבוצה "<strong>{newGroup.name}</strong>" נוצרה!</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,.6)', margin: 0 }}>
            קוד הצטרפות: <code style={{ color: '#1ede62', fontWeight: 700, letterSpacing: '2px', marginRight: '6px' }}>{newGroup.code}</code>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.3)' }}>(לחץ להעתקה)</span>
          </p>
        </div>
      )}

      {groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'rgba(255,255,255,.25)' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>🏆</p>
          <p>עדיין לא שייך לקבוצה</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>צור קבוצה חדשה או הצטרף לקיימת</p>
        </div>
      )}

      {groups.map(group => (
        <GroupTable
          key={group.id}
          group={group}
          isOwner={group.owner_id === me?.id}
          me={me}
          teamFlags={teamFlags}
          onRemoveMember={loadGroups}
        />
      ))}
    </div>
  )
}
