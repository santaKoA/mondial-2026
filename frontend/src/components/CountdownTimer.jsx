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
      const now = Date.now()
      const remaining = target - now
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
  if (diff <= 0) return <span className="text-red-400 text-xs font-medium">סגור להגשה</span>

  const totalSec = Math.floor(diff / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  if (days > 0) {
    return (
      <span className="text-yellow-400 text-xs">
        {days}י {pad(hours)}:{pad(mins)} לסגירה
      </span>
    )
  }

  return (
    <span className={`text-xs font-mono ${totalSec < 3600 ? 'text-orange-400' : 'text-yellow-400'}`}>
      {pad(hours)}:{pad(mins)}:{pad(secs)} לסגירה
    </span>
  )
}
