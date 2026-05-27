import { useState, useEffect, useCallback } from 'react'
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
  I: 'ט', J: 'י', K: 'כ', L: 'ל',
}

export default function MatchesPage() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeStage, setActiveStage] = useState('group')
  const [activeGroup, setActiveGroup] = useState(null)

  const loadMatches = useCallback(async () => {
    try {
      const { data } = await api.get('/api/matches')
      setMatches(data)
      const firstUpcoming = data.find(m => m.status === 'upcoming')
      if (firstUpcoming) {
        setActiveStage(firstUpcoming.stage)
        if (firstUpcoming.stage === 'group') setActiveGroup(firstUpcoming.group_name)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMatches() }, [loadMatches])

  const stages = [...new Set(matches.map(m => m.stage))].sort(
    (a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b)
  )

  const filteredByStage = matches.filter(m => m.stage === activeStage)
  const groups = [...new Set(filteredByStage.map(m => m.group_name).filter(Boolean))].sort()

  const displayed = activeStage === 'group' && activeGroup
    ? filteredByStage.filter(m => m.group_name === activeGroup)
    : filteredByStage

  useEffect(() => {
    if (activeStage === 'group' && groups.length > 0 && !groups.includes(activeGroup)) {
      setActiveGroup(groups[0])
    }
  }, [activeStage, groups, activeGroup])

  if (loading) {
    return <div className="text-center py-20 text-white/40">טוען משחקים...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-black mb-5">⚽ משחקים</h1>

      {/* Stage tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {stages.map(stage => (
          <button
            key={stage}
            onClick={() => { setActiveStage(stage); setActiveGroup(null) }}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeStage === stage
                ? 'bg-green-500 text-black'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {STAGE_LABELS[stage] || stage}
          </button>
        ))}
      </div>

      {/* Group tabs (only for group stage) */}
      {activeStage === 'group' && groups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`w-10 h-10 rounded-full text-sm font-bold transition-colors flex-shrink-0 ${
                activeGroup === g
                  ? 'bg-green-500 text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {GROUP_LABELS[g] || g}
            </button>
          ))}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="text-center py-12 text-white/30">אין משחקים בשלב זה</div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayed.map(match => (
            <MatchCard key={match.id} match={match} onPredictionSaved={loadMatches} />
          ))}
        </div>
      )}
    </div>
  )
}
