import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'
import MatchCard from '../components/MatchCard'

const STAGE_ORDER = ['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']
const STAGE_LABELS = {
  group: 'שלב הבתים',
  round_of_32: 'שלב ה-32',
  round_of_16: 'שמינית גמר',
  quarter_final: 'רבע גמר',
  semi_final: 'חצי גמר',
  third_place: 'משחק שלישי',
  final: 'גמר',
}

const GROUP_LABELS = {
  A: 'א', B: 'ב', C: 'ג', D: 'ד', E: 'ה', F: 'ו', G: 'ז', H: 'ח',
  I: 'ט', J: 'י', K: 'יא', L: 'יב',
}

function toUtcDate(str) {
  if (str && !str.endsWith('Z') && !str.includes('+')) return new Date(str + 'Z')
  return new Date(str)
}

function israelDateStr(date) {
  return new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function todayIsrael() {
  return israelDateStr(new Date())
}

function isTournamentDay() {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
  return d >= '2026-06-11'
}

export default function MatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTabRef = useRef(searchParams.get('tab'))
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeStage, setActiveStage] = useState(initialTabRef.current || (isTournamentDay() ? 'soon' : 'all'))
  const [activeGroup, setActiveGroup] = useState(null)
  const initializedRef = useRef(false)

  const loadMatches = useCallback(async () => {
    try {
      const { data } = await api.get('/api/matches')
      const sorted = [...data].sort((a, b) => toUtcDate(a.scheduled_at) - toUtcDate(b.scheduled_at))
      setMatches(sorted)
      if (!initializedRef.current) {
        initializedRef.current = true
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, []) // empty deps — loadMatches never changes, no re-run on URL cleanup

  useEffect(() => { loadMatches() }, [loadMatches])

  // React to ?tab param changes — handles both initial mount cleanup and
  // clicking the nav while already on the matches page (no remount in that case)
  const tabParam = searchParams.get('tab')
  useEffect(() => {
    if (tabParam) {
      setActiveStage(tabParam)
      setSearchParams({}, { replace: true })
    }
  }, [tabParam, setSearchParams])

  const stages = [...new Set(matches.map(m => m.stage))].sort(
    (a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b)
  )

  const todayMatches = matches.filter(m => israelDateStr(toUtcDate(m.scheduled_at)) === todayIsrael())

  const soonMatches = matches.filter(m => {
    const t = toUtcDate(m.scheduled_at)
    const now = new Date()
    return t > now && t <= new Date(now.getTime() + 24 * 60 * 60 * 1000)
  })

  const filteredByStage = matches.filter(m => m.stage === activeStage)
  const groups = [...new Set(filteredByStage.map(m => m.group_name).filter(Boolean))].sort()

  const displayed = activeStage === 'soon'
    ? soonMatches
    : activeStage === 'today'
      ? todayMatches
      : activeStage === 'all'
        ? matches
        : activeStage === 'group' && activeGroup
          ? filteredByStage.filter(m => m.group_name === activeGroup)
          : filteredByStage

  useEffect(() => {
    if (activeStage === 'group' && groups.length > 0 && !groups.includes(activeGroup)) {
      setActiveGroup(groups[0])
    }
  }, [activeStage, groups, activeGroup])

  const tabBtn = (key, label, onClick) => (
    <button key={key} onClick={onClick} style={{
      whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: '100px', border: 'none',
      cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: '13px', fontWeight: 500, flexShrink: 0,
      background: activeStage === key ? '#1ede62' : 'rgba(255,255,255,.07)',
      color:      activeStage === key ? '#000'    : 'rgba(255,255,255,.6)',
      transition: 'all .15s',
    }}>{label}</button>
  )

  if (loading) {
    return (
      <div style={{ paddingBottom: '80px' }}>
        <div style={{ height: '28px', width: '140px', background: 'rgba(255,255,255,.08)', borderRadius: '100px', marginBottom: '20px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: '36px', width: '96px', background: 'rgba(255,255,255,.08)', borderRadius: '100px', animation: 'pulse 1.5s infinite' }} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background: '#0c1810', border: '1px solid rgba(255,255,255,.06)', borderRadius: '14px', padding: '20px', height: '140px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '80px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '16px' }}>משחקים</h1>

      {/* Stage tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px', scrollbarWidth: 'none' }}>
        {tabBtn('soon', `⏰ הקרובים${soonMatches.length > 0 ? ` (${soonMatches.length})` : ''}`, () => setActiveStage('soon'))}
        {tabBtn('today', '📅 היום', () => setActiveStage('today'))}
        {tabBtn('all', '🗓 הכל', () => setActiveStage('all'))}
        {stages.map(stage => tabBtn(stage, STAGE_LABELS[stage] || stage, () => { setActiveStage(stage); setActiveGroup(null) }))}
      </div>

      {/* Group A–L selector */}
      {activeStage === 'group' && groups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {groups.map(g => (
            <button key={g} onClick={() => setActiveGroup(g)} style={{
              width: '38px', height: '38px', borderRadius: '50%', border: 'none',
              cursor: 'pointer', fontFamily: 'Heebo, sans-serif', fontSize: '13px', fontWeight: 700,
              background: activeGroup === g ? '#1ede62' : 'rgba(255,255,255,.07)',
              color:      activeGroup === g ? '#000'    : 'rgba(255,255,255,.55)',
              transition: 'all .15s',
            }}>{g}</button>
          ))}
        </div>
      )}

      {displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'rgba(255,255,255,.25)', fontSize: '14px' }}>
          {activeStage === 'soon' ? 'אין משחקים ב-24 השעות הקרובות' : activeStage === 'today' ? 'אין משחקים היום' : activeStage === 'all' ? 'אין משחקים' : 'אין משחקים בשלב זה'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayed.map(match => (
            <MatchCard key={match.id} match={match} onPredictionSaved={loadMatches} />
          ))}
        </div>
      )}
    </div>
  )
}
