'use client'

import { useState, useEffect } from 'react'
import type { PieceColor } from '@checkers/shared'

interface PlayerInfo {
  address: string | null
  color: PieceColor
  isCurrentTurn: boolean
  isReady?: boolean
}

interface AvatarVsBarProps {
  player: PlayerInfo
  opponent: PlayerInfo
  deadline: string | null
  timePerMove: number
  isReadyCheck: boolean
}

function Timer({ deadline, timePerMove, isActive }: { deadline: string | null; timePerMove: number; isActive: boolean }) {
  const [secondsLeft, setSecondsLeft] = useState(timePerMove)

  useEffect(() => {
    if (!deadline || !isActive) {
      setSecondsLeft(timePerMove)
      return
    }
    const target = new Date(deadline).getTime()
    function tick() {
      setSecondsLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deadline, isActive, timePerMove])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const isLow = isActive && secondsLeft <= 10
  const pct = Math.max(0, (secondsLeft / timePerMove) * 100)

  return (
    <div className="w-full">
      <div className="flex items-center justify-end mb-0.5">
        <span className={`text-xs font-mono font-semibold tabular-nums ${
          isLow ? 'text-danger animate-pulse' : isActive ? 'text-text' : 'text-text-muted'
        }`}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="h-1 bg-bg-subtle rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isLow ? 'bg-danger' : isActive ? 'bg-accent' : 'bg-text-muted/30'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Avatar({ address, color, isReadyCheck, isReady }: {
  address: string | null
  color: PieceColor
  isReadyCheck: boolean
  isReady?: boolean
}) {
  const letter = address ? address[3].toUpperCase() : '?'

  return (
    <div className="relative">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
        address
          ? color === 'black' ? 'bg-piece-black' : 'bg-piece-white border border-border'
          : 'bg-bg-subtle border border-border'
      }`}>
        <span className={`text-sm font-bold ${
          address
            ? color === 'black' ? 'text-white' : 'text-piece-black'
            : 'text-text-muted'
        }`}>
          {letter}
        </span>
      </div>
      {isReadyCheck && (
        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
          isReady ? 'bg-success' : 'bg-bg-subtle border border-border'
        }`}>
          {isReady ? (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="w-2 h-2 border border-text-muted border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}
    </div>
  )
}

function PlayerSide({ info, deadline, timePerMove, isReadyCheck, align }: {
  info: PlayerInfo
  deadline: string | null
  timePerMove: number
  isReadyCheck: boolean
  align: 'left' | 'right'
}) {
  const short = info.address
    ? `${info.address.slice(0, 6)}...${info.address.slice(-3)}`
    : 'Ожидание...'

  return (
    <div className={`flex-1 flex flex-col gap-1 min-w-0 ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <Avatar
          address={info.address}
          color={info.color}
          isReadyCheck={isReadyCheck}
          isReady={info.isReady}
        />
        <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
          <p className="text-xs font-medium text-text truncate">{short}</p>
          {isReadyCheck && (
            <p className="text-[10px] text-text-muted">
              {info.isReady ? 'Готов' : 'Подключается...'}
            </p>
          )}
        </div>
      </div>
      {!isReadyCheck && (
        <Timer deadline={deadline} timePerMove={timePerMove} isActive={info.isCurrentTurn} />
      )}
    </div>
  )
}

export function AvatarVsBar({ player, opponent, deadline, timePerMove, isReadyCheck }: AvatarVsBarProps) {
  return (
    <div className="flex items-center gap-3 w-full max-w-md">
      <PlayerSide info={opponent} deadline={deadline} timePerMove={timePerMove} isReadyCheck={isReadyCheck} align="left" />
      <div className="shrink-0 px-2">
        <span className="text-[10px] font-bold text-text-muted tracking-widest">VS</span>
      </div>
      <PlayerSide info={player} deadline={deadline} timePerMove={timePerMove} isReadyCheck={isReadyCheck} align="right" />
    </div>
  )
}
