'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface MoveTimerProps {
  deadline: string
  isMyTurn: boolean
  timePerMove: number
}

export function MoveTimer({ deadline, isMyTurn, timePerMove }: MoveTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(timePerMove)

  useEffect(() => {
    const target = new Date(deadline).getTime()

    function tick() {
      const now = Date.now()
      const diff = Math.max(0, Math.ceil((target - now) / 1000))
      setSecondsLeft(diff)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deadline])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const isLow = secondsLeft <= 10
  const percentage = Math.max(0, (secondsLeft / timePerMove) * 100)

  return (
    <div className="w-full max-w-xs">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Clock className={`w-3.5 h-3.5 ${isLow ? 'text-danger' : 'text-text-muted'}`} />
          <span className="text-xs text-text-secondary">
            {isMyTurn ? 'Ваше время' : 'Время соперника'}
          </span>
        </div>
        <span className={`text-sm font-mono font-semibold tabular-nums ${isLow ? 'text-danger' : 'text-text'}`}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isLow ? 'bg-danger' : isMyTurn ? 'bg-accent' : 'bg-text-muted'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
