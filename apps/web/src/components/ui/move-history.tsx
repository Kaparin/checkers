'use client'

import { useRef, useEffect } from 'react'
import { List } from 'lucide-react'
import type { SerializedMove } from '@checkers/shared'

interface MoveHistoryProps {
  moves: SerializedMove[]
}

// Convert row,col to checkers notation (1-32 square numbering)
function toSquareNumber(row: number, col: number): number {
  // Standard checkers numbering: squares numbered 1-32
  // Row 0 (top) has squares 1-4, row 7 (bottom) has squares 29-32
  return row * 4 + Math.floor(col / 2) + 1
}

function formatMove(move: SerializedMove): string {
  const from = toSquareNumber(move.from[0], move.from[1])
  const to = toSquareNumber(move.to[0], move.to[1])
  const sep = move.captures.length > 0 ? 'x' : '-'
  const suffix = move.promotion ? 'K' : ''
  return `${from}${sep}${to}${suffix}`
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new moves
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [moves.length])

  if (moves.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <List className="w-3.5 h-3.5 text-text-muted" />
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Ходы</h3>
        </div>
        <p className="text-xs text-text-muted text-center py-4">Ходов пока нет</p>
      </div>
    )
  }

  // Pair moves: black (odd index) + white (even index)
  const pairs: { num: number; black: string; white?: string }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      black: formatMove(moves[i]),
      white: moves[i + 1] ? formatMove(moves[i + 1]) : undefined,
    })
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <List className="w-3.5 h-3.5 text-text-muted" />
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Ходы</h3>
      </div>
      <div ref={scrollRef} className="max-h-60 overflow-y-auto space-y-0.5">
        {pairs.map((pair, idx) => (
          <div
            key={pair.num}
            className={`flex text-xs font-mono py-1 px-2 rounded-lg ${
              idx === pairs.length - 1 ? 'bg-bg-subtle' : ''
            }`}
          >
            <span className="w-7 text-text-muted text-right mr-2 select-none">{pair.num}.</span>
            <span className="w-14 font-medium text-text">{pair.black}</span>
            {pair.white && <span className="w-14 font-medium text-text">{pair.white}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
