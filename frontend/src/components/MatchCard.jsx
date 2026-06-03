import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../api'

function parseUtc(str) {
  if (str && !str.endsWith('Z') && !str.includes('+')) return new Date(str + 'Z')
  return new Date(str)
}

function fmtDate(str) {
  const d = parseUtc(str)
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d).replace(',', '')
}

const STAGE_LABELS = {
  group: 'שלב הבתים', round_of_32: 'שלב ה-32',
  round_of_16: 'שמינית גמר', quarter_final: 'רבע גמר',
  semi_final: 'חצי גמר', third_place: 'משחק שלישי', final: 'גמר',
}

const STAGE_PILL = {
  group:         { bg: 'rgba(96,165,250,.12)',  text: '#60a5fa', border: 'rgba(96,165,250,.22)' },
  round_of_32:   { bg: 'rgba(168,85,247,.12)',  text: '#c084fc', border: 'rgba(168,85,247,.22)' },
  round_of_16:   { bg: 'rgba(251,146,60,.12)',  text: '#fb923c', border: 'rgba(251,146,60,.22)' },
  quarter_final: { bg: 'rgba(251,146,60,.12)',  text: '#fb923c', border: 'rgba(251,146,60,.22)' },
  semi_final:    { bg: 'rgba(245,200,66,.12)',  text: '#f5c842', border: 'rgba(245,200,66,.22)' },
  third_place:   { bg: 'rgba(245,200,66,.12)',  text: '#f5c842', border: 'rgba(245,200,66,.22)' },
  final:         { bg: 'rgba(30,222,98,.12)',   text: '#1ede62', border: 'rgba(30,222,98,.25)'  },
}

const CUTOFF_MINUTES = 5

const STAGE_POINTS = {
  group:         { exact: 3,  dir: 1 },
  round_of_32:   { exact: 5,  dir: 3 },
  round_of_16:   { exact: 5,  dir: 3 },
  quarter_final: { exact: 5,  dir: 3 },
  semi_final:    { exact: 10, dir: 5 },
  third_place:   { exact: 10, dir: 5 },
  final:         { exact: 10, dir: 5 },
}

function ScoreBox({ value, onChange, side }) {
  const inc = () => { const n = parseInt(value) || 0; onChange(String(Math.min(99, n + 1))) }
  const dec = () => { const n = parseInt(value) || 0; onChange(String(Math.max(0, n - 1))) }

  const spinners = (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      borderRight: side === 'r' ? '1px solid rgba(255,255,255,.1)' : 'none',
      borderLeft:  side === 'l' ? '1px solid rgba(255,255,255,.1)' : 'none',
    }}>
      {[['▲', inc], ['▼', dec]].map(([sym, fn], i) => (
        <button key={sym} type="button" onMouseDown={e => { e.preventDefault(); fn() }}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 9px', background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,.28)', fontSize: '9px', transition: 'color .1s',
            borderTop: i === 1 ? '1px solid rgba(255,255,255,.07)' : 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.8)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.28)'}
        >{sym}</button>
      ))}
    </div>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', width: '66px', height: '60px',
      background: 'rgba(0,0,0,.45)', border: '1.5px solid rgba(255,255,255,.14)',
      borderRadius: '10px', overflow: 'hidden',
    }}>
      {side === 'r' && spinners}
      <input type="number" min="0" max="99" value={value} onChange={e => onChange(e.target.value)}
        placeholder="0"
        style={{
          flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
          textAlign: 'center', fontSize: '36px', fontWeight: 800, color: '#fff',
          fontFamily: 'Heebo, sans-serif', direction: 'ltr', fontVariantNumeric: 'tabular-nums',
        }}
      />
      {side === 'l' && spinners}
    </div>
  )
}

export default function MatchCard({ match, onPredictionSaved }) {
  const [home, setHome]           = useState(match.my_prediction != null ? String(match.my_prediction.home_score) : '')
  const [away, setAway]           = useState(match.my_prediction != null ? String(match.my_prediction.away_score) : '')
  const [saving, setSaving]       = useState(false)
  const [groupPreds, setGroupPreds] = useState(null)
  const [loadingGroup, setLoadingGroup] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [timeLocked, setTimeLocked] = useState(() => {
    const cutoff = parseUtc(match.scheduled_at).getTime() - CUTOFF_MINUTES * 60 * 1000
    return Date.now() >= cutoff
  })

  const fin    = match.status === 'finished'
  const live   = match.status === 'live'
  const locked = !fin && !live && timeLocked
  const up     = !fin && !live && !locked
  const pred   = match.my_prediction
  const pts    = STAGE_POINTS[match.stage] || { exact: 3, dir: 1 }

  // Reveal group predictions after kickoff
  const isKickedOff = fin || live || Date.now() >= parseUtc(match.scheduled_at).getTime()

  useEffect(() => {
    if (!up) return
    function calc() {
      const diff = parseUtc(match.scheduled_at) - Date.now() - CUTOFF_MINUTES * 60 * 1000
      if (diff <= 0) { setTimeLocked(true); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(d > 0
        ? `${d}י ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [up, match.scheduled_at])

  const handleExpired = useCallback(() => setTimeLocked(true), [])

  async function toggleGroupPreds() {
    if (groupPreds) { setGroupPreds(null); return }
    setLoadingGroup(true)
    try {
      const { data } = await api.get(`/api/predictions/match/${match.id}`)
      setGroupPreds(data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה')
    } finally {
      setLoadingGroup(false)
    }
  }

  async function handleSave() {
    const h = parseInt(home)
    const a = parseInt(away)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) { toast.error('הזן תוצאה תקינה'); return }
    setSaving(true)
    try {
      await api.post(`/api/predictions/${match.id}`, { home_score: h, away_score: a })
      toast.success('הניחוש נשמר!')
      onPredictionSaved?.()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  const topColor = live ? '#f04a58' : fin ? '#1ede62' : locked ? '#f5c842' : '#60a5fa'
  const sp = STAGE_PILL[match.stage] || { bg: 'rgba(255,255,255,.08)', text: 'rgba(255,255,255,.5)', border: 'rgba(255,255,255,.12)' }

  function resultColor() {
    if (!fin || !pred) return null
    if (pred.home_score === match.home_score && pred.away_score === match.away_score) return 'green'
    if (Math.sign(pred.home_score - pred.away_score) === Math.sign(match.home_score - match.away_score)) return 'yellow'
    return 'red'
  }
  const rc = resultColor()
  const rcP = {
    green:  { bg: 'rgba(30,222,98,.12)',  text: '#1ede62', border: 'rgba(30,222,98,.25)'  },
    yellow: { bg: 'rgba(245,200,66,.12)', text: '#f5c842', border: 'rgba(245,200,66,.25)' },
    red:    { bg: 'rgba(240,74,90,.12)',  text: '#f04a58', border: 'rgba(240,74,90,.22)'  },
  }

  return (
    <div style={{
      background: '#0c1810', border: '1px solid rgba(255,255,255,.06)', borderRadius: '14px',
      boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 4px 24px rgba(0,0,0,.45)',
      overflow: 'hidden', opacity: locked ? 0.88 : 1,
    }}>
      <div style={{ height: '2px', background: `linear-gradient(90deg,${topColor} 0%,transparent 80%)` }} />

      <div style={{ padding: '11px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '100px',
          background: sp.bg, color: sp.text, border: `1px solid ${sp.border}`, whiteSpace: 'nowrap',
        }}>
          {STAGE_LABELS[match.stage] || match.stage}
          {match.group_name && ` · בית ${match.group_name}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
          {live && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600,
              background: 'rgba(240,74,90,.12)', color: '#f04a58', border: '1px solid rgba(240,74,90,.22)',
              borderRadius: '100px', padding: '3px 9px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f04a58', animation: 'livepulse 1.3s infinite' }} />
              לייב
            </span>
          )}
          {fin && (
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '100px',
              background: 'rgba(30,222,98,.10)', color: '#1ede62', border: '1px solid rgba(30,222,98,.2)',
            }}>✓ הסתיים</span>
          )}
          {locked && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600,
              background: 'rgba(245,200,66,.1)', color: '#f5c842', border: '1px solid rgba(245,200,66,.2)',
              borderRadius: '100px', padding: '3px 9px',
            }}>🔒 נעול · {fmtDate(match.scheduled_at)}</span>
          )}
          {up && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)' }}>
                {fmtDate(match.scheduled_at)}
              </span>
              {countdown && (
                <span style={{
                  fontSize: '11px', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  background: 'rgba(96,165,250,.1)', color: '#60a5fa',
                  border: '1px solid rgba(96,165,250,.2)', borderRadius: '100px',
                  padding: '2px 8px',
                }}>⏱ {countdown}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '46px', lineHeight: 1, marginBottom: '7px' }}>{match.home_team?.flag || '🏳'}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.25 }}>{match.home_team?.name || 'טרם נקבע'}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', minWidth: '152px' }}>
          {(fin || live) ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(0,0,0,.5)', borderRadius: '12px', padding: '8px 18px',
                border: live ? '1px solid rgba(240,74,90,.2)' : 'none',
              }}>
                <span style={{ fontSize: '44px', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{match.home_score}</span>
                <span style={{ fontSize: '22px', color: live ? '#f04a58' : 'rgba(255,255,255,.2)', fontWeight: 300 }}>–</span>
                <span style={{ fontSize: '44px', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{match.away_score}</span>
              </div>
              {pred && fin && rc && (
                <span style={{
                  fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '100px',
                  background: rcP[rc].bg, color: rcP[rc].text, border: `1px solid ${rcP[rc].border}`,
                }}>
                  {rc === 'green' ? '🎯 בול! ' : rc === 'yellow' ? '↗ כיוון ' : '✗ '}
                  {pred.home_score}–{pred.away_score}
                  {pred.points != null ? ` · +${pred.points}נק` : ''}
                </span>
              )}
              {pred && live && (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>
                  ניחושך: {pred.home_score}–{pred.away_score}
                </div>
              )}
            </>
          ) : locked ? (
            pred ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'rgba(245,200,66,.07)', borderRadius: '12px', padding: '8px 18px',
                  border: '1px solid rgba(245,200,66,.18)',
                }}>
                  <span style={{ fontSize: '40px', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#f5c842' }}>{pred.home_score}</span>
                  <span style={{ fontSize: '20px', color: 'rgba(245,200,66,.4)', fontWeight: 300 }}>–</span>
                  <span style={{ fontSize: '40px', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#f5c842' }}>{pred.away_score}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(245,200,66,.6)', marginTop: '7px' }}>🔒 הניחוש נעול</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  background: 'rgba(240,74,90,.07)', border: '1px solid rgba(240,74,90,.18)',
                  borderRadius: '12px', padding: '12px 20px',
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '4px' }}>😬</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#f04a58' }}>לא הוגש ניחוש</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.3)', marginTop: '3px' }}>הזמן עבר</div>
                </div>
              </div>
            )
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ScoreBox value={home} onChange={setHome} side="r" />
                <span style={{ fontSize: '20px', color: 'rgba(255,255,255,.18)', fontWeight: 300 }}>–</span>
                <ScoreBox value={away} onChange={setAway} side="l" />
              </div>
              <button onClick={handleSave} disabled={saving || home === '' || away === ''} style={{
                background: '#1ede62', color: '#000', fontFamily: 'Heebo, sans-serif',
                fontWeight: 700, fontSize: '13px', padding: '8px 0', width: '100%',
                borderRadius: '9px', border: 'none', cursor: saving || home === '' || away === '' ? 'default' : 'pointer',
                boxShadow: '0 2px 14px rgba(30,222,98,.22)',
                opacity: home === '' || away === '' ? 0.4 : 1, transition: 'opacity .15s',
              }}>
                {saving ? '...' : pred ? '✏️ עדכן ניחוש' : '💾 שמור ניחוש'}
              </button>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.28)' }}>
                מדויק {pts.exact}נק · כיוון {pts.dir}נק
              </span>
            </>
          )}
        </div>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '46px', lineHeight: 1, marginBottom: '7px' }}>{match.away_team?.flag || '🏳'}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.25 }}>{match.away_team?.name || 'טרם נקבע'}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '9px 16px' }}>
        {isKickedOff ? (
          <>
            <button onClick={toggleGroupPreds} disabled={loadingGroup} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)',
              fontSize: '12px', fontFamily: 'Heebo, sans-serif', width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'color .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.6)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.3)'}
            >
              <span>👥</span>
              <span>{loadingGroup ? '...' : groupPreds ? 'הסתר ניחושי הקבוצה' : 'ניחושי הקבוצה'}</span>
              <span style={{ fontSize: '10px' }}>{groupPreds ? '▲' : '▼'}</span>
            </button>
            {groupPreds && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {groupPreds.map(p => (
                  <div key={p.user_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 2px' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,.55)' }}>{p.user_name}</span>
                    {p.home_score != null ? (
                      <span style={{
                        fontSize: '12px', fontWeight: 600,
                        color: p.points != null
                          ? p.points >= (STAGE_POINTS[match.stage]?.exact || 3) ? '#1ede62'
                          : p.points > 0 ? '#f5c842' : 'rgba(255,255,255,.5)'
                          : 'rgba(255,255,255,.6)',
                      }}>
                        {p.home_score}–{p.away_score}
                        {p.points != null && <span style={{ color: 'rgba(255,255,255,.3)', marginRight: '4px' }}> ({p.points}נק)</span>}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'rgba(240,74,90,.5)' }}>לא הוגש</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,.18)' }}>
            👥 ניחושי הקבוצה ייחשפו בתחילת המשחק
          </div>
        )}
      </div>
    </div>
  )
}
