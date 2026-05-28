import { useState, useEffect } from 'react'
import { WC_TEAMS, WC_PLAYERS } from '../data/worldcup.js'

const KNOWN_PLAYERS = WC_PLAYERS.filter(p => p.name !== 'אחר')

function PlayerPhoto({ apiId, localImg, flag, name }) {
  const [failed, setFailed] = useState(false)
  const src = localImg || (apiId ? `https://media.api-sports.io/football/players/${apiId}.png` : null)
  if (!src || failed) {
    return (
      <span className="w-9 h-9 flex items-center justify-center text-xl flex-shrink-0">
        {flag}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-white/10"
      onError={() => setFailed(true)}
    />
  )
}

export function TeamPicker({ value, onChange, disabled }) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? WC_TEAMS.filter(t => t.name.includes(query.trim()))
    : WC_TEAMS

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="חפש נבחרת..."
        disabled={disabled}
        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-green-400"
      />
      <div className="max-h-56 overflow-y-auto rounded-lg">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {filtered.map(t => (
            <button
              key={t.name}
              type="button"
              disabled={disabled}
              onClick={() => onChange(t.name)}
              className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-right transition-colors ${
                value === t.name
                  ? 'bg-green-500/30 border border-green-500/60 text-white'
                  : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              <span className="text-base leading-none flex-shrink-0">{t.flag}</span>
              <span className="text-xs leading-tight">{t.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 sm:col-span-3 text-center py-4 text-white/30 text-sm">אין תוצאות</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function PlayerPicker({ value, onChange, disabled }) {
  const isCustom = value && !KNOWN_PLAYERS.find(p => p.name === value)
  const [showOther, setShowOther] = useState(isCustom || false)
  const [customText, setCustomText] = useState(isCustom ? value : '')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!value) {
      setShowOther(false)
      setCustomText('')
    }
  }, [value])

  const filteredPlayers = query.trim()
    ? WC_PLAYERS.filter(p => p.name === 'אחר' || p.name.includes(query.trim()) || p.team?.includes(query.trim()))
    : WC_PLAYERS

  function handleSelect(player) {
    if (player.name === 'אחר') {
      setShowOther(true)
      onChange(customText)
    } else {
      setShowOther(false)
      onChange(player.name)
    }
  }

  function handleCustomChange(text) {
    setCustomText(text)
    onChange(text)
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="חפש שחקן..."
        disabled={disabled}
        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-green-400"
      />
      <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-0.5">
        {filteredPlayers.map(p => {
          const isSelected = p.name === 'אחר' ? showOther : value === p.name
          return (
            <div key={p.name}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(p)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-green-500/30 border border-green-500/60'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                <PlayerPhoto apiId={p.apiId} localImg={p.localImg} flag={p.flag} name={p.name} />
                <div className="flex-1 min-w-0 text-right">
                  <div className="font-medium text-sm">{p.name}</div>
                  {p.team && (
                    <div className="text-xs text-white/40">{p.flag} {p.team}</div>
                  )}
                </div>
              </button>
              {p.name === 'אחר' && showOther && (
                <input
                  type="text"
                  value={customText}
                  onChange={e => handleCustomChange(e.target.value)}
                  placeholder="הזן שם שחקן..."
                  disabled={disabled}
                  autoFocus
                  className="mt-1 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-green-400"
                />
              )}
            </div>
          )
        })}
        {filteredPlayers.length === 0 && (
          <div className="text-center py-4 text-white/30 text-sm">אין תוצאות</div>
        )}
      </div>
    </div>
  )
}
