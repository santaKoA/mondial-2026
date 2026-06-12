import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { getTeamMeta } from '../data/teamMeta'

function TeamFlag({ team }) {
  const meta = team ? getTeamMeta(team.name) : null
  if (!meta) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: '58px', height: '58px', borderRadius: '50%', marginBottom: '12px',
          background: 'rgba(255,255,255,.05)', border: '2px solid rgba(255,255,255,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
        }}>{team?.flag || '🏳'}</div>
        <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.25 }}>{team?.name || 'טרם נקבע'}</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <span className={`fi fi-${meta.code}`} style={{
          display: 'block', width: '58px', height: '58px', borderRadius: '50%',
          backgroundSize: 'cover', backgroundPosition: 'center',
          border: '2px solid rgba(255,255,255,.25)',
        }} />
        <span style={{
          position: 'absolute', bottom: '-7px', right: '50%', transform: 'translateX(50%)',
          background: '#fff', color: '#1a1a1a', fontSize: '9px', fontWeight: 700,
          padding: '1px 7px', borderRadius: '100px', whiteSpace: 'nowrap',
        }}>{meta.fifa}</span>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.25 }}>{team.name}</div>
    </div>
  )
}

const H24 = 24 * 3600 * 1000
const H1  =      3600 * 1000

function StopwatchCountdown({ diffMs }) {
  let color, percent, top, label

  if (diffMs > H24) {
    const d = Math.floor(diffMs / 86400000)
    color = '#1ede62'; percent = 1
    top = `${d}`; label = d === 1 ? 'יום' : 'ימים'
  } else if (diffMs > H1) {
    const h = Math.floor(diffMs / 3600000)
    const m = Math.floor((diffMs % 3600000) / 60000)
    color = '#f5c842'; percent = diffMs / H24
    top = `${h}:${String(m).padStart(2, '0')}`; label = 'שע׳:דק׳'
  } else {
    const m = Math.floor(diffMs / 60000)
    const s = Math.floor((diffMs % 60000) / 1000)
    color = '#f04a58'; percent = diffMs / H1
    top = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; label = 'דק׳:שנ׳'
  }

  const W = 56, H = 66
  const CX = W / 2, CY = H / 2 + 3
  const R_BEZEL = 22, R_FACE = 18

  function pt(deg, r) {
    const rad = (deg - 90) * Math.PI / 180
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
  }

  function wedge(pct) {
    if (pct <= 0) return ''
    if (pct >= 1) return `M ${CX} ${CY - R_FACE} A ${R_FACE} ${R_FACE} 0 1 1 ${CX - 0.001} ${CY - R_FACE} Z`
    const deg = pct * 360
    const [x1, y1] = pt(0, R_FACE)
    const [x2, y2] = pt(deg, R_FACE)
    return `M ${CX} ${CY} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R_FACE} ${R_FACE} 0 ${deg > 180 ? 1 : 0} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`
  }

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const [x1, y1] = pt(i * 30, R_FACE - 3)
    const [x2, y2] = pt(i * 30, R_FACE)
    return <line key={i} x1={x1.toFixed(2)} y1={y1.toFixed(2)} x2={x2.toFixed(2)} y2={y2.toFixed(2)}
      stroke="rgba(255,255,255,.22)" strokeWidth="1.2" strokeLinecap="round" />
  })

  const fontSize = diffMs > H24 ? 17 : 11
  const textTop = CY - Math.round((fontSize + 7) / 2)

  return (
    <div style={{ position: 'relative', width: W, height: H, flexShrink: 0 }}>
      <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Crown stem */}
        <rect x={CX - 4} y={CY - R_BEZEL - 8} width={8} height={7} rx={2}
          fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.2)" strokeWidth={0.6} />
        {/* Crown top button */}
        <rect x={CX - 5.5} y={CY - R_BEZEL - 12} width={11} height={5} rx={2.5}
          fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.15)" strokeWidth={0.6} />

        {/* Outer bezel */}
        <circle cx={CX} cy={CY} r={R_BEZEL}
          fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.15)" strokeWidth={1.2} />
        {/* Inner bezel highlight */}
        <circle cx={CX} cy={CY} r={R_BEZEL - 2}
          fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={1} />

        {/* Face background */}
        <circle cx={CX} cy={CY} r={R_FACE + 1}
          fill="rgba(0,0,0,.6)" />

        {/* Colored wedge — remaining time sweep */}
        <path d={wedge(percent)} fill={color} opacity={0.18}
          style={{ transition: 'fill 0.5s' }} />

        {/* Tick marks */}
        {ticks}

        {/* Face border ring */}
        <circle cx={CX} cy={CY} r={R_FACE}
          fill="none" stroke={color} strokeWidth={1.8} opacity={0.5}
          style={{ transition: 'stroke 0.5s' }} />

        {/* Center pin */}
        <circle cx={CX} cy={CY} r={2.2} fill={color} opacity={0.75}
          style={{ transition: 'fill 0.5s' }} />
      </svg>

      {/* Number + label overlay */}
      <div style={{
        position: 'absolute', top: textTop, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: diffMs > H24 ? '17px' : '11px',
          fontWeight: 900, color, fontVariantNumeric: 'tabular-nums',
          lineHeight: 1, letterSpacing: diffMs > H24 ? '0' : '-0.8px',
          fontFamily: 'Heebo, sans-serif',
          transition: 'color 0.5s',
        }}>{top}</span>
        <span style={{
          fontSize: '6.5px', fontWeight: 700, color, opacity: 0.65,
          fontFamily: 'Heebo, sans-serif',
          transition: 'color 0.5s',
        }}>{label}</span>
      </div>
    </div>
  )
}

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
  const [diffMs, setDiffMs] = useState(-1)
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
      if (diff <= 0) { setTimeLocked(true); setDiffMs(0); return }
      setDiffMs(diff)
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [up, match.scheduled_at])

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
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0 || h > 99 || a > 99) { toast.error('הזן תוצאה תקינה (0–99)'); return }
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)' }}>
                {fmtDate(match.scheduled_at)}
              </span>
              {diffMs > 0 && <StopwatchCountdown diffMs={diffMs} />}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <TeamFlag team={match.home_team} />
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

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <TeamFlag team={match.away_team} />
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
            {groupPreds && (() => {
              // Outcome vs the current (live or final) score
              const sign = x => (x > 0 ? 1 : x < 0 ? -1 : 0)
              const outcome = p => {
                if (p.home_score == null) return 'none'
                if (match.home_score == null || match.away_score == null) return 'pending'
                if (p.home_score === match.home_score && p.away_score === match.away_score) return 'exact'
                if (sign(p.home_score - p.away_score) === sign(match.home_score - match.away_score)) return 'dir'
                return 'miss'
              }
              const ORDER = { exact: 0, dir: 1, pending: 2, miss: 3, none: 4 }
              const rows = [...groupPreds].map(p => ({ ...p, oc: outcome(p) }))
                .sort((a, b) => ORDER[a.oc] - ORDER[b.oc] || a.user_name.localeCompare(b.user_name, 'he'))
              const counts = {
                exact: rows.filter(r => r.oc === 'exact').length,
                dir:   rows.filter(r => r.oc === 'dir').length,
                miss:  rows.filter(r => r.oc === 'miss' || r.oc === 'pending').length,
              }
              const ROW_STYLE = {
                exact:   { bg: 'rgba(30,222,98,.07)',  border: '1px solid rgba(30,222,98,.25)' },
                dir:     { bg: 'rgba(245,200,66,.06)', border: '1px solid rgba(245,200,66,.22)' },
                miss:    { bg: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' },
                pending: { bg: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' },
                none:    { bg: 'rgba(240,74,90,.04)',  border: '1px dashed rgba(240,74,90,.25)' },
              }
              const AVATAR = {
                exact: { bg: 'rgba(30,222,98,.15)',  color: '#1ede62' },
                dir:   { bg: 'rgba(245,200,66,.15)', color: '#f5c842' },
                miss:  { bg: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)' },
                pending: { bg: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)' },
                none:  { bg: 'rgba(240,74,90,.1)',   color: 'rgba(240,74,90,.7)' },
              }
              const ptsLabel = r => {
                const v = r.points != null ? r.points : (r.oc === 'exact' ? pts.exact : r.oc === 'dir' ? pts.dir : 0)
                if (r.oc === 'exact') return { text: `${v}+ בול`,  bg: '#1ede62',              color: '#04342c' }
                if (r.oc === 'dir')   return { text: `${v}+ כיוון`, bg: 'rgba(245,200,66,.9)', color: '#412402' }
                return { text: '0', bg: 'transparent', color: 'rgba(255,255,255,.3)' }
              }
              return (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '100px', background: 'rgba(30,222,98,.12)', color: '#1ede62' }}>{counts.exact} בול</span>
                    <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '100px', background: 'rgba(245,200,66,.12)', color: '#f5c842' }}>{counts.dir} כיוון</span>
                    <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '100px', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.45)' }}>{counts.miss} החטיאו</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rows.map((r, i) => {
                      const rs = ROW_STYLE[r.oc], av = AVATAR[r.oc]
                      const pl = ptsLabel(r)
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: rs.bg, border: rs.border, borderRadius: '10px', padding: '7px 10px',
                        }}>
                          <div style={{
                            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                            background: av.bg, color: av.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 600,
                          }}>{r.user_name.charAt(0)}</div>
                          <span style={{
                            flex: 1, fontSize: '13px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            color: r.oc === 'exact' ? '#ecf0ed' : r.oc === 'none' ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.7)',
                            fontWeight: r.oc === 'exact' ? 600 : 400,
                          }}>{r.user_name}</span>
                          {r.oc === 'none' ? (
                            <span style={{ fontSize: '11px', color: 'rgba(240,74,90,.6)' }}>לא הוגש</span>
                          ) : (
                            <>
                              <span style={{
                                fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                                color: r.oc === 'exact' ? '#1ede62' : r.oc === 'dir' ? '#f5c842' : 'rgba(255,255,255,.45)',
                              }}>{r.home_score}–{r.away_score}</span>
                              <span style={{
                                fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px',
                                background: pl.bg, color: pl.color, whiteSpace: 'nowrap',
                              }}>{pl.text}</span>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
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
