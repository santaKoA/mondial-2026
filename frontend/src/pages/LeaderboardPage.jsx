import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const MEDALS = ['🥇', '🥈', '🥉']

function GroupTable({ group, isOwner, me, teamFlags, onRemoveMember }) {
  const [users, setUsers] = useState(null)
  const [removing, setRemoving] = useState(null)

  useEffect(() => {
    api.get(`/api/leaderboard?group_id=${group.id}`)
      .then(r => setUsers(r.data))
      .catch(() => setUsers([]))
  }, [group.id])

  async function handleRemove(userId) {
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

  return (
    <div className="mb-6">
      {/* Group header */}
      <div className="flex items-center justify-between mb-2">
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => { navigator.clipboard?.writeText(group.code); toast.success('קוד הועתק!') }}
          title="לחץ להעתקת קוד הצטרפות"
        >
          <span className="text-white/40 text-xs">קוד:</span>
          <code className="text-green-300 font-mono font-bold tracking-wider text-sm">{group.code}</code>
          <span className="text-white/20 text-xs group-hover:text-white/50 transition-colors">📋</span>
        </div>
        <h2 className="text-lg font-bold text-white">{group.name}
          <span className="text-white/30 text-sm font-normal mr-1.5">({group.member_count} משתתפים)</span>
        </h2>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0 overflow-x-auto">
        {users === null ? (
          <div className="text-center py-6 text-white/30 text-sm">טוען...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm">אין משתתפים עדיין</div>
        ) : (
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right py-3 px-4 text-white/50 font-medium text-sm">#</th>
                <th className="text-right py-3 px-4 text-white/50 font-medium text-sm">שם</th>
                <th className="text-center py-3 px-2 text-white/50 font-medium text-sm">🎯 בול</th>
                <th className="text-center py-3 px-2 text-white/50 font-medium text-sm">↗ כיוון</th>
                <th className="text-center py-3 px-2 text-white/50 font-medium text-sm">🏆 זוכה</th>
                <th className="text-center py-3 px-2 text-white/50 font-medium text-sm">⚽ מלך שערים</th>
                <th className="text-center py-3 px-4 text-white/50 font-medium text-sm">נקודות</th>
                {isOwner && <th className="py-3 px-2"></th>}
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr
                  key={user.id}
                  className={`border-b border-white/5 last:border-0 transition-colors ${
                    user.id === me?.id ? 'bg-green-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="py-3 px-4 text-center">
                    {MEDALS[idx] || <span className="text-white/40 text-sm">{idx + 1}</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-medium ${user.id === me?.id ? 'text-green-400' : ''}`}>
                      {user.name}
                    </span>
                    {user.id === me?.id && <span className="text-xs text-green-400/60 mr-1">(אני)</span>}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      user.exact_count > 0 ? 'bg-green-500/25 text-green-400' : 'text-white/20'
                    }`}>{user.exact_count}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      user.direction_count > 0 ? 'bg-yellow-500/25 text-yellow-400' : 'text-white/20'
                    }`}>{user.direction_count}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {user.winner_pick
                      ? <span className="text-xl" title={user.winner_pick}>{teamFlags[user.winner_pick] || user.winner_pick}</span>
                      : <span className="text-white/20">—</span>}
                  </td>
                  <td className="py-3 px-2 text-center text-xs text-white/70 max-w-[80px]">
                    {user.top_scorer_pick || <span className="text-white/20">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`font-black text-2xl ${
                      idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-white/80' : idx === 2 ? 'text-orange-400' : 'text-white'
                    }`}>
                      {user.total_points}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="py-3 px-2 text-center">
                      {user.id !== me?.id && (
                        <button
                          onClick={() => handleRemove(user.id)}
                          disabled={removing === user.id}
                          className="text-red-400/60 hover:text-red-400 text-xs px-1.5 py-0.5 rounded transition-colors disabled:opacity-30"
                          title="הסר מהקבוצה"
                        >
                          {removing === user.id ? '...' : '✕'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const [groups, setGroups] = useState([])
  const [teamFlags, setTeamFlags] = useState({})
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [newGroup, setNewGroup] = useState(null)
  const { user: me } = useAuth()

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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black">🏆 טבלת דירוג</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowJoin(v => !v); setShowCreate(false) }}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            🔗 הצטרף
          </button>
          <button
            onClick={() => { setShowCreate(v => !v); setShowJoin(false); setNewGroup(null) }}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            + קבוצה חדשה
          </button>
        </div>
      </div>

      {/* Join existing group form */}
      {showJoin && (
        <form onSubmit={handleJoinGroup} className="card mb-4 flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="הזן קוד קבוצה"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-green-400 text-sm font-mono"
            autoFocus
          />
          <button type="submit" disabled={joining || !joinCode.trim()} className="btn-primary text-sm py-2 px-4">
            {joining ? '...' : 'הצטרף'}
          </button>
        </form>
      )}

      {/* Create new group form */}
      {showCreate && (
        <form onSubmit={handleCreateGroup} className="card mb-4 flex gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder='שם הקבוצה (למשל: "משפחה")'
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-green-400 text-sm"
            autoFocus
          />
          <button type="submit" disabled={creating || !newGroupName.trim()} className="btn-primary text-sm py-2 px-4">
            {creating ? '...' : 'צור'}
          </button>
        </form>
      )}

      {/* New group created banner */}
      {newGroup && (
        <div
          className="card mb-4 bg-green-500/10 border-green-500/30 cursor-pointer"
          onClick={() => { navigator.clipboard?.writeText(newGroup.code); toast.success('קוד הועתק!') }}
        >
          <p className="text-sm text-green-400/80 mb-1">✅ הקבוצה "<strong>{newGroup.name}</strong>" נוצרה!</p>
          <p className="text-sm text-white/60">קוד הצטרפות:
            <code className="mr-2 text-green-300 font-mono font-bold tracking-wider">{newGroup.code}</code>
            <span className="text-xs text-white/30">(לחץ להעתקה)</span>
          </p>
        </div>
      )}

      {/* No groups */}
      {groups.length === 0 && (
        <div className="text-center py-12 text-white/30">
          <p className="text-4xl mb-3">🏆</p>
          <p>עדיין לא שייך לקבוצה</p>
          <p className="text-sm mt-1">צור קבוצה חדשה או הצטרף לקיימת</p>
        </div>
      )}

      {/* One table per group */}
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
