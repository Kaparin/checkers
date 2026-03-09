'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckersBoard } from '@/components/board/checkers-board'
import { getGame } from '@/lib/api'
import { Skeleton, SkeletonBoard } from '@/components/ui/skeleton'
import { createInitialGameState } from '@checkers/shared'
import type { GameState, SerializedMove, GameVariant } from '@checkers/shared'

/**
 * Replay a completed game move-by-move.
 * We reconstruct the board by taking the initial state and replaying
 * moves from the moveHistory array.
 */
function reconstructState(variant: GameVariant, moves: SerializedMove[], upToMove: number): GameState {
  // Start with initial state
  const state = createInitialGameState(variant)
  state.status = 'playing'
  state.currentTurn = 'black'

  // Apply moves by manipulating the board directly from serialized moves
  for (let i = 0; i < upToMove && i < moves.length; i++) {
    const m = moves[i]
    const [fr, fc] = m.from
    const [tr, tc] = m.to
    const piece = state.board[fr][fc]

    // Move piece
    state.board[tr][tc] = piece
    state.board[fr][fc] = null

    // Apply captures
    for (const [cr, cc] of m.captures) {
      state.board[cr][cc] = null
    }

    // Promotion
    if (piece && m.promotion) {
      state.board[tr][tc] = { ...piece, type: 'king' }
    }

    // Toggle turn
    state.currentTurn = state.currentTurn === 'black' ? 'white' : 'black'
  }

  state.moveHistory = moves.slice(0, upToMove)
  state.moveCount = upToMove
  return state
}

// Square notation
function toSquareNumber(row: number, col: number): number {
  return row * 4 + Math.floor(col / 2) + 1
}

function formatMove(move: SerializedMove): string {
  const from = toSquareNumber(move.from[0], move.from[1])
  const to = toSquareNumber(move.to[0], move.to[1])
  const sep = move.captures.length > 0 ? 'x' : '-'
  return `${from}${sep}${to}${move.promotion ? 'K' : ''}`
}

export default function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = use(params)
  const router = useRouter()
  const [moves, setMoves] = useState<SerializedMove[]>([])
  const [variant, setVariant] = useState<GameVariant>('russian')
  const [currentMove, setCurrentMove] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blackPlayer, setBlackPlayer] = useState<string | null>(null)
  const [whitePlayer, setWhitePlayer] = useState<string | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [wager, setWager] = useState('0')
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { game } = await getGame(gameId)
        setBlackPlayer(game.blackPlayer)
        setWhitePlayer(game.whitePlayer)
        setWinner(game.winner)
        setWager(game.wager)
        setVariant((game.variant || 'russian') as GameVariant)

        const stateStr = typeof game.gameState === 'string'
          ? game.gameState : JSON.stringify(game.gameState)
        const parsed = JSON.parse(stateStr)

        // Extract move history from game state
        const moveHistory = parsed.moveHistory || parsed.mh || []
        setMoves(moveHistory)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [gameId])

  // Auto-play
  useEffect(() => {
    if (!playing || currentMove >= moves.length) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => {
      setCurrentMove(prev => prev + 1)
    }, 800)
    return () => clearTimeout(timer)
  }, [playing, currentMove, moves.length])

  const state = moves.length > 0 ? reconstructState(variant, moves, currentMove) : null

  const shortAddr = (addr: string | null) => addr ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : '?'

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <SkeletonBoard />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-danger mb-4">{error}</p>
        <button onClick={() => router.push('/history')} className="text-sm text-accent hover:underline">Back to history</button>
      </div>
    )
  }

  if (!state || moves.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-text-muted mb-4">No moves to replay</p>
        <button onClick={() => router.push('/history')} className="text-sm text-accent hover:underline">Back to history</button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/history')} className="text-sm text-text-secondary hover:text-text">
          &larr; Back
        </button>
        <div className="text-sm font-medium text-text-secondary">
          {(Number(wager) / 1_000_000).toFixed(0)} AXM &middot; {variant === 'russian' ? 'Russian' : 'American'}
        </div>
      </div>

      {/* Players */}
      <div className="flex items-center justify-between bg-bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-piece-black rounded-full" />
          <span className="text-xs font-medium">{shortAddr(blackPlayer)}</span>
          {winner === blackPlayer && <span className="text-[10px] text-success font-semibold">W</span>}
        </div>
        <span className="text-xs text-text-muted">vs</span>
        <div className="flex items-center gap-2">
          {winner === whitePlayer && <span className="text-[10px] text-success font-semibold">W</span>}
          <span className="text-xs font-medium">{shortAddr(whitePlayer)}</span>
          <div className="w-6 h-6 bg-piece-white rounded-full border border-border" />
        </div>
      </div>

      {/* Board */}
      <CheckersBoard
        gameId={`replay-${gameId}`}
        playerColor="white"
        externalState={state}
        localMode
      />

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => { setCurrentMove(0); setPlaying(false) }}
          disabled={currentMove === 0}
          className="px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm disabled:opacity-30"
          title="Start"
        >
          &#x23EE;
        </button>
        <button
          onClick={() => { setCurrentMove(Math.max(0, currentMove - 1)); setPlaying(false) }}
          disabled={currentMove === 0}
          className="px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm disabled:opacity-30"
          title="Previous"
        >
          &#x23F4;
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => { setCurrentMove(Math.min(moves.length, currentMove + 1)); setPlaying(false) }}
          disabled={currentMove >= moves.length}
          className="px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm disabled:opacity-30"
          title="Next"
        >
          &#x23F5;
        </button>
        <button
          onClick={() => { setCurrentMove(moves.length); setPlaying(false) }}
          disabled={currentMove >= moves.length}
          className="px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm disabled:opacity-30"
          title="End"
        >
          &#x23ED;
        </button>
      </div>

      {/* Progress */}
      <div className="text-center text-xs text-text-muted">
        Move {currentMove} / {moves.length}
      </div>

      {/* Move list */}
      <div className="bg-bg-card border border-border rounded-xl p-4 max-h-48 overflow-y-auto">
        <div className="flex flex-wrap gap-1 text-xs font-mono">
          {moves.map((m, i) => {
            const isBlack = i % 2 === 0
            const moveNum = Math.floor(i / 2) + 1
            return (
              <span key={i}>
                {isBlack && <span className="text-text-muted mr-0.5">{moveNum}.</span>}
                <button
                  onClick={() => { setCurrentMove(i + 1); setPlaying(false) }}
                  className={`px-1 py-0.5 rounded ${
                    i + 1 === currentMove
                      ? 'bg-accent text-white'
                      : i + 1 < currentMove
                        ? 'text-text hover:bg-bg-subtle'
                        : 'text-text-muted hover:bg-bg-subtle'
                  }`}
                >
                  {formatMove(m)}
                </button>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
