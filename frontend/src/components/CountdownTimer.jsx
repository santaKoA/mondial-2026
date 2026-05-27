import { useState, useEffect } from 'react'

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function CountdownTimer({ scheduledAt, onExpired }) {
  const [diff, setDiff] = useState(null)

  useEffect(() => {
    function tick() {
      const raw = scheduledAt && !scheduledAt.endsWith('Z') && !scheduledAt.includes('+') ? scheduledAt + 'Z' : scheduledAt
      const target = new Date(raw).getTime() - 5 * 60 * 1000
      const remaining = target - Date.now()
      if (remaining <= 0) {
        setDiff(0)
        onExpired?.()
        return
      }
      setDiff(remaining)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [scheduledAt, onExpired])

  if (diff === null) return null

  if (diff <= 0) {
    return (
      <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-xs font-medium px-2 py-0.5 rounded-full">
        🔒 סגור
      </span>
    )
  }

  const totalSec = Math.floor(diff / 1000)
  const days  = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins  = Math.floor((totalSec % 3600) / 60)
  const secs  = totalSec % 60

  // > 3 days — show days only, low urgency
  if (days >= 3) {
    return (
      <span className="inline-flex items-center gap-1 bg-white/8 text-white/50 text-xs px-2 py-0.5 rounded-full">
        ⏳ {days} ימים
      </span>
    )
  }

  // 1–3 days — show days + hours, mild urgency
  if (days >= 1) {
    return (
      <span className="inline-flex items-center gap-1 bg-yellow-500/15 text-yellow-400 text-xs font-medium px-2 py-0.5 rounded-full">
        ⏳ {days}י {pad(hours)}:{pad(mins)}
      </span>
    )
  }

  // < 24h, > 1h — show H:MM שעות
  if (totalSec >= 3600) {
    return (
      <span className="inline-flex items-center gap-1 bg-orange-500/15 text-orange-400 text-xs font-medium px-2 py-0.5 rounded-full">
        ⏰ {hours}:{pad(mins)} שעות
      </span>
    )
  }

  // < 1h — show MM:SS, high urgency
  return (
    <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full font-mono animate-pulse">
      🔴 {pad(mins)}:{pad(secs)}
    </span>
  )
}
