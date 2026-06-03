import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { WC_TEAMS, WC_PLAYERS } from '../data/worldcup.js'

const FALLBACK_TOURNAMENT_START = new Date('2026-06-11T19:00:00Z')

const inputSt = {
  width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.14)',
  borderRadius: '10px', padding: '10px 14px', color: '#ecf0ed',
  fontFamily: 'Heebo, sans-serif', fontSize: '14px',
  outline: 'none', transition: 'border-color .15s', boxSizing: 'border-box',
}

const cardSt = (locked) => ({
  background: '#0c1810', border: '1px solid rgba(255,255,255,.07)', borderRadius: '14px', padding: '18px',
  marginBottom: '16px', boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.4)',
  opacity: locked ? 0.75 : 1, transition: 'opacity .2s',
})

function PlayerPhoto({ player, size = 42 }) {
  const [failed, setFailed] = useState(false)
  const src = player.apiId ? `https://media.api-sports.io/football/players/${player.apiId}.png` : null
  if (!src || failed) {
    return (
      <div style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${size * 0.5}px`,
      }}>{player.flag}</div>
    )
  }
  return (
    <img src={src} alt={player.name} onError={() => setFailed(true)}
      style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
               background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
    />
  )
}

export default function SpecialPredictionsPage() {
  const [predictions, setPredictions] = useState({})
  const [winnerInput, setWinnerInput]     = useState('')
  const [topScorerInput, setTopScorerInput] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(null)
  const [tournamentStart, setTournamentStart] = useState(FALLBACK_TOURNAMENT_START)
  const [locked, setLocked]     = useState(() => new Date() >= FALLBACK_TOURNAMENT_START)
  const [teamQuery, setTeamQuery] = useState('')
  const [plQuery, setPlQuery]   = useState('')

  useEffect(() => {
    const check = () => setLocked(new Date() >= tournamentStart)
    check()
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
  }, [tournamentStart])

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

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,.3)', fontSize: '14px' }}>טוען...</div>
  )

  const filteredTeams   = teamQuery.trim() ? WC_TEAMS.filter(t => t.name.includes(teamQuery.trim())) : WC_TEAMS
  const filteredPlayers = plQuery.trim()
    ? WC_PLAYERS.filter(p => p.name === 'אחר' || p.name.includes(plQuery.trim()) || p.team?.includes(plQuery.trim()))
    : WC_PLAYERS

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>ניחושים מיוחדים</h1>
      </div>

      {/* Locked banner */}
      {locked && (
        <div style={{
          background: 'rgba(245,200,66,.08)', border: '1px solid rgba(245,200,66,.2)',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f5c842' }}>הניחושים המיוחדים נעולים</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.4)', marginTop: '2px' }}>הטורניר כבר התחיל — לא ניתן לשנות ניחושים</div>
          </div>
        </div>
      )}

      {/* Points banner */}
      <div style={{
        background: 'rgba(30,222,98,.08)', border: '1px solid rgba(30,222,98,.2)',
        borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '28px',
      }}>
        {[['🏆 זוכה טורניר', '15 נק׳'], ['⚽ מלך שערים', '15 נק׳']].map(([label, pts]) => (
          <div key={label}>
            <div style={{ fontSize: '11px', color: 'rgba(30,222,98,.65)', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1ede62' }}>{pts}</div>
          </div>
        ))}
      </div>

      {/* Winner card */}
      <div style={cardSt(locked)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', color: 'rgba(30,222,98,.7)', fontWeight: 600 }}>15 נק׳</span>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>🏆 זוכה המונדיאל</h2>
        </div>

        {winnerInput && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'rgba(30,222,98,.08)', border: '1px solid rgba(30,222,98,.25)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
          }}>
            <span style={{ fontSize: '28px' }}>{WC_TEAMS.find(t => t.name === winnerInput)?.flag}</span>
            <span style={{ fontWeight: 700, color: '#1ede62', flex: 1 }}>{winnerInput}</span>
            {!locked && (
              <button onClick={() => setWinnerInput('')} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: '18px', lineHeight: 1,
              }}>×</button>
            )}
          </div>
        )}

        {!locked && (
          <>
            <input type="text" placeholder="חפש נבחרת..." value={teamQuery}
              onChange={e => setTeamQuery(e.target.value)} style={{ ...inputSt, marginBottom: '10px' }}
              onFocus={e => e.target.style.borderColor = '#1ede62'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'}
            />
            <div style={{ maxHeight: '220px', overflowY: 'auto', overflowX: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                {filteredTeams.map(t => (
                  <button key={t.name} onClick={() => setWinnerInput(t.name)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px',
                    borderRadius: '8px', cursor: 'pointer',
                    border: winnerInput === t.name ? '1px solid rgba(30,222,98,.5)' : '1px solid rgba(255,255,255,.07)',
                    background: winnerInput === t.name ? 'rgba(30,222,98,.12)' : 'rgba(255,255,255,.03)',
                    fontFamily: 'Heebo, sans-serif', transition: 'all .12s',
                  }}>
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{t.flag}</span>
                    <span style={{
                      fontSize: '11px', fontWeight: winnerInput === t.name ? 600 : 400,
                      color: winnerInput === t.name ? '#1ede62' : 'rgba(255,255,255,.7)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{t.name}</span>
                  </button>
                ))}
                {filteredTeams.length === 0 && (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,.25)', fontSize: '13px' }}>אין תוצאות</div>
                )}
              </div>
            </div>
            <button onClick={() => handleSave('winner', winnerInput)}
              disabled={saving === 'winner' || !winnerInput} style={{
                width: '100%', padding: '11px', borderRadius: '9px', border: 'none', marginTop: '12px',
                cursor: saving === 'winner' || !winnerInput ? 'default' : 'pointer',
                background: '#1ede62', color: '#000', fontFamily: 'Heebo, sans-serif',
                fontSize: '14px', fontWeight: 700, boxShadow: '0 2px 14px rgba(30,222,98,.2)',
                opacity: !winnerInput ? 0.4 : 1, transition: 'all .15s',
              }}>
              {saving === 'winner' ? '...' : predictions.winner ? '✏️ עדכן' : '💾 שמור'}
            </button>
          </>
        )}

        {!winnerInput && locked && (
          <div style={{ textAlign: 'center', padding: '18px', color: 'rgba(255,255,255,.25)', fontSize: '13px' }}>לא הוגש ניחוש</div>
        )}
        {predictions.winner?.points > 0 && (
          <div style={{ marginTop: '8px', color: '#1ede62', fontSize: '13px', fontWeight: 700 }}>✅ +{predictions.winner.points} נקודות!</div>
        )}
      </div>

      {/* Top scorer card */}
      <div style={cardSt(locked)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', color: 'rgba(30,222,98,.7)', fontWeight: 600 }}>15 נק׳</span>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>⚽ מלך השערים</h2>
        </div>

        {topScorerInput && (() => {
          const p = WC_PLAYERS.find(pl => pl.name === topScorerInput)
          return p ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'rgba(30,222,98,.08)', border: '1px solid rgba(30,222,98,.25)',
              borderRadius: '10px', padding: '10px 14px', marginBottom: '12px',
            }}>
              <PlayerPhoto player={p} />
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#1ede62' }}>{p.name}</div>
                {p.team && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.4)', marginTop: '2px' }}>{p.flag} {p.team}</div>}
              </div>
              {!locked && (
                <button onClick={() => setTopScorerInput('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: '18px', lineHeight: 1,
                }}>×</button>
              )}
            </div>
          ) : null
        })()}

        {!locked && (
          <>
            <input type="text" placeholder="חפש שחקן..." value={plQuery}
              onChange={e => setPlQuery(e.target.value)} style={{ ...inputSt, marginBottom: '10px' }}
              onFocus={e => e.target.style.borderColor = '#1ede62'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.14)'}
            />
            <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredPlayers.map(p => (
                <button key={p.name} onClick={() => setTopScorerInput(p.name)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                  borderRadius: '10px', cursor: 'pointer', fontFamily: 'Heebo, sans-serif', transition: 'all .12s',
                  border: topScorerInput === p.name ? '1px solid rgba(30,222,98,.35)' : '1px solid rgba(255,255,255,.06)',
                  background: topScorerInput === p.name ? 'rgba(30,222,98,.08)' : 'rgba(255,255,255,.02)',
                }}>
                  <PlayerPhoto player={p} />
                  <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px', fontWeight: topScorerInput === p.name ? 700 : 400,
                      color: topScorerInput === p.name ? '#1ede62' : '#ecf0ed',
                    }}>{p.name}</div>
                    {p.team && (
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)', marginTop: '2px' }}>{p.flag} {p.team}</div>
                    )}
                  </div>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                    border: topScorerInput === p.name ? '5px solid #1ede62' : '2px solid rgba(255,255,255,.2)',
                    transition: 'all .12s',
                  }} />
                </button>
              ))}
              {filteredPlayers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,.25)', fontSize: '13px' }}>אין תוצאות</div>
              )}
            </div>
            <button onClick={() => handleSave('top_scorer', topScorerInput)}
              disabled={saving === 'top_scorer' || !topScorerInput.trim()} style={{
                width: '100%', padding: '11px', borderRadius: '9px', border: 'none', marginTop: '12px',
                cursor: saving === 'top_scorer' || !topScorerInput.trim() ? 'default' : 'pointer',
                background: '#1ede62', color: '#000', fontFamily: 'Heebo, sans-serif',
                fontSize: '14px', fontWeight: 700, boxShadow: '0 2px 14px rgba(30,222,98,.2)',
                opacity: !topScorerInput.trim() ? 0.4 : 1, transition: 'all .15s',
              }}>
              {saving === 'top_scorer' ? '...' : predictions.top_scorer ? '✏️ עדכן' : '💾 שמור'}
            </button>
          </>
        )}

        {!topScorerInput && locked && (
          <div style={{ textAlign: 'center', padding: '18px', color: 'rgba(255,255,255,.25)', fontSize: '13px' }}>לא הוגש ניחוש</div>
        )}
        {predictions.top_scorer?.points > 0 && (
          <div style={{ marginTop: '8px', color: '#1ede62', fontSize: '13px', fontWeight: 700 }}>✅ +{predictions.top_scorer.points} נקודות!</div>
        )}
      </div>
    </div>
  )
}
