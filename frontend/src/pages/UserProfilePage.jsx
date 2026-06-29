import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { WC_PLAYERS } from '../data/worldcup.js'

const PLAYER_MAP = Object.fromEntries(WC_PLAYERS.map(p => [p.name, p]))
const MEDALS = ['🥇', '🥈', '🥉']

const STAGE_POINTS = {
  group:         { exact: 3,  dir: 1 },
  round_of_32:   { exact: 6,  dir: 3 },
  round_of_16:   { exact: 6,  dir: 3 },
  quarter_final: { exact: 6,  dir: 3 },
  semi_final:    { exact: 10, dir: 5 },
  third_place:   { exact: 10, dir: 5 },
  final:         { exact: 15, dir: 8 },
}

const sign = x => (x > 0 ? 1 : x < 0 ? -1 : 0)

function outcome(p) {
  if (p.home_score == null || p.away_score == null) return 'pending'
  if (p.pred_home === p.home_score && p.pred_away === p.away_score) return 'exact'
  if (sign(p.pred_home - p.pred_away) === sign(p.home_score - p.away_score)) return 'dir'
  return 'miss'
}

export default function UserProfilePage() {
  const { userId } = useParams()
  const [searchParams] = useSearchParams()
  const groupId = searchParams.get('group')
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const [profile, setProfile] = useState(null)
  const [row, setRow] = useState(null)
  const [rank, setRank] = useState(null)
  const [teamFlags, setTeamFlags] = useState({})
  const [showMisses, setShowMisses] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get(`/api/predictions/user/${userId}`)
      .then(r => setProfile(r.data))
      .catch(e => setError(e.response?.data?.detail || 'שגיאה בטעינת המשתמש'))
    if (groupId) {
      api.get(`/api/leaderboard?group_id=${groupId}`).then(r => {
        const idx = r.data.findIndex(u => u.id === Number(userId))
        if (idx >= 0) { setRow(r.data[idx]); setRank(idx + 1) }
      }).catch(() => {})
    }
    api.get('/api/matches/teams').then(r => {
      const map = {}
      r.data.forEach(t => { map[t.name] = t.flag })
      setTeamFlags(map)
    }).catch(() => {})
  }, [userId, groupId])

  if (error) return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,.4)', fontSize: '14px' }}>{error}</div>
  )
  if (!profile) return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,.3)', fontSize: '14px' }}>טוען...</div>
  )

  const preds = profile.predictions.map(p => ({ ...p, oc: outcome(p) }))
  const live = preds.filter(p => p.status === 'live')
  const hits = preds.filter(p => p.status === 'finished' && (p.oc === 'exact' || p.oc === 'dir'))
  const misses = preds.filter(p => p.status === 'finished' && p.oc !== 'exact' && p.oc !== 'dir')
  const decided = hits.length + misses.length
  const hitPct = decided > 0 ? Math.round((hits.length / decided) * 100) : null

  const exactCount = row ? row.exact_count : preds.filter(p => p.oc === 'exact').length
  const dirCount = row ? row.direction_count : preds.filter(p => p.oc === 'dir').length

  const scorer = row?.top_scorer_pick ? PLAYER_MAP[row.top_scorer_pick] : null

  const statBox = (value, label, color) => (
    <div style={{
      background: '#0c1810', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px',
      padding: '10px 4px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '20px', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)', marginTop: '2px' }}>{label}</div>
    </div>
  )

  const predRow = (p, i) => {
    const isLive = p.status === 'live'
    const oc = p.oc
    const provisional = p.points == null && isLive
    const pts = p.points != null
      ? p.points
      : oc === 'exact' ? (STAGE_POINTS[p.stage]?.exact ?? 3)
      : oc === 'dir' ? (STAGE_POINTS[p.stage]?.dir ?? 1)
      : 0
    const style = oc === 'exact'
      ? { bg: 'rgba(30,222,98,.07)', border: '1px solid rgba(30,222,98,.25)', scoreColor: '#1ede62' }
      : oc === 'dir'
        ? { bg: 'rgba(245,200,66,.06)', border: '1px solid rgba(245,200,66,.22)', scoreColor: '#f5c842' }
        : { bg: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', scoreColor: 'rgba(255,255,255,.45)' }
    return (
      <div key={i} style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: isLive ? 'rgba(240,74,90,.05)' : style.bg,
        border: isLive ? '1px solid rgba(240,74,90,.25)' : style.border,
        borderRadius: '10px', padding: '8px 10px',
      }}>
        <span style={{ fontSize: '12px', flexShrink: 0 }}>
          {isLive ? <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#f04a58', animation: 'livepulse 1.3s infinite' }} />
            : oc === 'exact' ? '🎯' : oc === 'dir' ? '↗' : '✗'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: '#ecf0ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.home_flag} {p.home_team} – {p.away_team} {p.away_flag}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.35)', marginTop: '1px' }}>
            {isLive ? `לייב · כרגע ${p.home_score}–${p.away_score}` : `הסתיים ${p.home_score}–${p.away_score}`}
          </div>
        </div>
        <span style={{
          fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: style.scoreColor, flexShrink: 0,
        }}>{p.pred_home}–{p.pred_away}</span>
        {(oc === 'exact' || oc === 'dir') ? (
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', flexShrink: 0,
            background: oc === 'exact' ? '#1ede62' : 'rgba(245,200,66,.9)',
            color: oc === 'exact' ? '#04342c' : '#412402', whiteSpace: 'nowrap',
          }}>{pts}+ {provisional ? 'זמני' : oc === 'exact' ? 'בול' : 'כיוון'}</span>
        ) : (
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.3)', padding: '2px 6px', flexShrink: 0 }}>0</span>
        )}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '100px', maxWidth: '480px', margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.35)',
        fontSize: '13px', fontFamily: 'Heebo, sans-serif', marginBottom: '16px',
        display: 'flex', alignItems: 'center', gap: '4px', padding: 0,
      }}>← חזרה לטבלה</button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(30,222,98,.14)', border: '2px solid rgba(30,222,98,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', fontWeight: 700, color: '#1ede62',
        }}>{profile.user_name.charAt(0)}</div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>
            {profile.user_name}
            {Number(userId) === me?.id && <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(30,222,98,.6)', marginRight: '6px' }}>(אני)</span>}
          </div>
          {rank != null && (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', marginTop: '2px' }}>
              {MEDALS[rank - 1] || ''} מקום {rank} בטבלה
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        {statBox(row ? row.total_points : '—', 'נקודות', '#f0b429')}
        {statBox(exactCount, '🎯 בולים', '#1ede62')}
        {statBox(dirCount, '↗ כיוונים', '#f5c842')}
        {statBox(hitPct != null ? `${hitPct}%` : '—', 'פגיעה', '#ecf0ed')}
      </div>

      {/* Special picks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
        <div style={{
          background: '#0c1810', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px',
          padding: '12px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '26px' }}>{row?.winner_pick ? (teamFlags[row.winner_pick] || '🏆') : '—'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)' }}>🏆 הזוכה במונדיאל</div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row?.winner_pick || 'לא הוגש'}
            </div>
          </div>
        </div>
        <div style={{
          background: '#0c1810', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px',
          padding: '12px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '26px' }}>{scorer?.flag || (row?.top_scorer_pick ? '⚽' : '—')}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)' }}>⚽ מלך השערים</div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row?.top_scorer_pick || 'לא הוגש'}
            </div>
          </div>
        </div>
      </div>

      {/* Predictions */}
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,.75)', marginBottom: '8px' }}>
        הניחושים של {profile.user_name}
      </div>

      {preds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,.25)', fontSize: '13px' }}>
          אין עדיין ניחושים חשופים — ניחושים נחשפים רק אחרי תחילת המשחק
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {live.map(predRow)}
          {hits.map(predRow)}
          {misses.length > 0 && (
            <button onClick={() => setShowMisses(v => !v)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)',
              fontSize: '11px', fontFamily: 'Heebo, sans-serif', padding: '8px 0 2px', textAlign: 'center',
            }}>
              {showMisses ? `הסתר החטאות ▲` : `הצג גם החטאות (${misses.length}) ▼`}
            </button>
          )}
          {showMisses && misses.map(predRow)}
        </div>
      )}
    </div>
  )
}
