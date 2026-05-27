import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user: me } = useAuth()

  useEffect(() => {
    api.get('/api/leaderboard/groups')
      .then(r => {
        setGroups(r.data)
        if (r.data.length > 0) setActiveGroupId(r.data[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const url = activeGroupId
      ? `/api/leaderboard?group_id=${activeGroupId}`
      : '/api/leaderboard'
    api.get(url)
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false))
  }, [activeGroupId])

  return (
    <div>
      <h1 className="text-2xl font-black mb-4">🏆 טבלת דירוג</h1>

      {groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setActiveGroupId(g.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeGroupId === g.id
                  ? 'bg-green-500 text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {g.name}
              <span className="mr-1.5 text-xs opacity-60">({g.member_count})</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-white/40">טוען...</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right py-3 px-4 text-white/50 font-medium text-sm">#</th>
                <th className="text-right py-3 px-4 text-white/50 font-medium text-sm">שם</th>
                <th className="text-center py-3 px-4 text-white/50 font-medium text-sm">ניחושים</th>
                <th className="text-center py-3 px-4 text-white/50 font-medium text-sm">נקודות</th>
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
                  <td className="py-3 px-4 text-center text-white/60 text-sm">{user.prediction_count}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`font-black text-lg ${
                      idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-white/80' : idx === 2 ? 'text-orange-400' : 'text-white'
                    }`}>
                      {user.total_points}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-8 text-white/30">אין משתתפים עדיין</div>
          )}
        </div>
      )}
    </div>
  )
}
