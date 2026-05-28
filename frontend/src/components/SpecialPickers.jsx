import { useState } from 'react'
import { WC_TEAMS, WC_PLAYERS } from '../data/worldcup.js'

const KNOWN_PLAYERS = WC_PLAYERS.filter(p => p.name !== 'אחר')

function PlayerPhoto({ apiId, flag, name }) {
  const [failed, setFailed] = useState(false)
  if (!apiId || failed) {
    return (
      <span className="w-9 h-9 flex items-center justify-center text-xl flex-shrink-0">
        {flag}
      </span>
    )
  }
  return (
    <img
      src={`https://media.api-sports.io/football/players/${apiId}.png`}
      alt={name}
      className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-white/10"
      onError={() => setFailed(true)}
    />
  )
}

export function TeamPicker({ value, onChange, disabled }) {
  return (
    <div className="max-h-60 overflow-y-auto rounded-lg">
      <div className="grid grid-cols-3 gap-1.5">
        {WC_TEAMS.map(t => (
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
      </div>
    </div>
  )
}

export function PlayerPicker({ value, onChange, disabled }) {
  const isCustom = value && !KNOWN_PLAYERS.find(p => p.name === value)
  const [showOther, setShowOther] = useState(isCustom || false)
  const [customText, setCustomText] = useState(isCustom ? value : '')

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
    <div className="max-h-72 overflow-y-auto flex flex-col gap-1 pr-0.5">
      {WC_PLAYERS.map(p => {
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
              <PlayerPhoto apiId={p.apiId} flag={p.flag} name={p.name} />
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
    </div>
  )
}
