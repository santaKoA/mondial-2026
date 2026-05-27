import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import toast from 'react-hot-toast'
import api from '../api'
import CountdownTimer from './CountdownTimer'

const STAGE_LABELS = {
  group: 'שלב הבתים',
  round_of_32: 'שלב ה-32',
  round_of_16: 'שמינית גמר',
  quarter_final: 'רבע גמר',
  semi_final: 'חצי גמר',
  third_place: 'משחק שלישי',
  final: 'גמר',
}

const STAGE_COLORS = {
  group: 'bg-blue-500/20 text-blue-300',
  round_of_32: 'bg-purple-500/20 text-purple-300',
  round_of_16: 'bg-orange-500/20 text-orange-300',
  quarter_final: 'bg-orange-500/20 text-orange-300',
  semi_final: 'bg-yellow-500/20 text-yellow-300',
  third_place: 'bg-yellow-500/20 text-yellow-300',
  final: 'bg-green-500/20 text-green-300',
}

function PointsBadge({ points, stage }) {
  const pts = {
    group: { exact: 3, dir: 1 },
    round_of_32: { exact: 5, dir: 3 },
    round_of_16: { exact: 5, dir: 3 },
    quarter_final: { exact: 5, dir: 3 },
    semi_final: { exact: 10, dir: 5 },
    third_place: { exact: 10, dir: 5 },
    final: { exact: 10, dir: 5 },
  }[stage] || { exact: 3, dir: 1 }

  return (
    <span className="text-xs text-white/40">
      ✓ {pts.exact}נק | כיוון {pts.dir}נק
    </span>
  )
}

export default function MatchCard({ match, onPredictionSaved }) {
  const [homeInput, setHomeInput] = useState(
    match.my_prediction != null ? String(match.my_prediction.home_score) : ''
  )
  const [awayInput, setAwayInput] = useState(
    match.my_prediction != null ? String(match.my_prediction.away_score) : ''
  )
  const [saving, setSaving] = useState(false)
  const [closed, setClosed] = useState(false)

  const isClosed = closed || match.status === 'finished' || (() => {
    const cutoff = new Date(match.scheduled_at).getTime() - 5 * 60 * 1000
    return Date.now() >= cutoff
  })()

  const handleExpired = useCallback(() => setClosed(true), [])

  async function handleSave() {
    const h = parseInt(homeInput)
    const a = parseInt(awayInput)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast.error('הזן תוצאה תקינה')
      return
    }
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

  const hasPrediction = match.my_prediction != null
  const isFinished = match.status === 'finished'

  function getResultColor(pred, actual) {
    if (pred === null || actual === null) return ''
    if (pred.home_score === actual.home && pred.away_score === actual.away) return 'text-green-400'
    const predDir = Math.sign(pred.home_score - pred.away_score)
    const actualDir = Math.sign(actual.home - actual.away)
    if (predDir === actualDir) return 'text-yellow-400'
    return 'text-red-400'
  }

  const resultColor = isFinished && hasPrediction
    ? getResultColor(match.my_prediction, { home: match.home_score, away: match.away_score })
    : ''

  return (
    <div className={`card transition-all ${isFinished ? 'opacity-80' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[match.stage] || 'bg-white/10 text-white/60'}`}>
            {STAGE_LABELS[match.stage] || match.stage}
            {match.group_name && ` · בית ${match.group_name}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isClosed && !isFinished && (
            <CountdownTimer scheduledAt={match.scheduled_at} onExpired={handleExpired} />
          )}
          {isFinished && (
            <span className="text-xs text-white/40">
              {format(new Date(match.scheduled_at), 'dd/MM HH:mm', { locale: he })}
            </span>
          )}
          {!isFinished && !isClosed && (
            <span className="text-xs text-white/40">
              {format(new Date(match.scheduled_at), 'dd/MM HH:mm', { locale: he })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Home team */}
        <div className="flex-1 text-center">
          <div className="text-3xl mb-1">{match.home_team?.flag || '🏳'}</div>
          <div className="text-sm font-medium leading-tight">{match.home_team?.name || 'טרם נקבע'}</div>
        </div>

        {/* Score area */}
        <div className="flex flex-col items-center gap-2 min-w-[120px]">
          {isFinished ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-white">{match.home_score}</span>
              <span className="text-white/40">-</span>
              <span className="text-3xl font-black text-white">{match.away_score}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="99"
                value={homeInput}
                onChange={e => setHomeInput(e.target.value)}
                disabled={isClosed}
                className="score-input"
                placeholder="0"
              />
              <span className="text-white/40 font-bold">-</span>
              <input
                type="number"
                min="0"
                max="99"
                value={awayInput}
                onChange={e => setAwayInput(e.target.value)}
                disabled={isClosed}
                className="score-input"
                placeholder="0"
              />
            </div>
          )}

          {isFinished && hasPrediction && (
            <div className={`text-sm font-medium ${resultColor}`}>
              ניחוש: {match.my_prediction.home_score}-{match.my_prediction.away_score}
              {match.my_prediction.points != null && (
                <span className="mr-1 font-bold">({match.my_prediction.points}נק)</span>
              )}
            </div>
          )}

          {!isFinished && !isClosed && (
            <button
              onClick={handleSave}
              disabled={saving || homeInput === '' || awayInput === ''}
              className="btn-primary text-sm py-1.5 px-4 w-full"
            >
              {saving ? '...' : hasPrediction ? '✏️ עדכן' : '💾 שמור'}
            </button>
          )}

          {isClosed && !isFinished && hasPrediction && (
            <div className="text-xs text-white/50 text-center">
              ניחושך: {match.my_prediction.home_score}-{match.my_prediction.away_score}
            </div>
          )}

          {isClosed && !isFinished && !hasPrediction && (
            <div className="text-xs text-red-400/70 text-center">לא הוגש ניחוש</div>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 text-center">
          <div className="text-3xl mb-1">{match.away_team?.flag || '🏳'}</div>
          <div className="text-sm font-medium leading-tight">{match.away_team?.name || 'טרם נקבע'}</div>
        </div>
      </div>

      {!isFinished && (
        <div className="mt-3 text-center">
          <PointsBadge stage={match.stage} />
        </div>
      )}
    </div>
  )
}
