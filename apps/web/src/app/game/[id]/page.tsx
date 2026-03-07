'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckersBoard } from '@/components/board/checkers-board'
import { GameOverModal } from '@/components/ui/game-over-modal'
import { MoveTimer } from '@/components/ui/move-timer'
import { useWebSocket } from '@/hooks/use-websocket'
import { getGame, makeMove, getStoredAddress } from '@/lib/api'
import { deserializeGameState, type GameState, type PieceColor } from '@checkers/shared'

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = use(params)
  const router = useRouter()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerColor, setPlayerColor] = useState<PieceColor>('white')
  const [opponent, setOpponent] = useState<string | null>(null)
  const [wager, setWager] = useState<string>('0')
  const [timePerMove, setTimePerMove] = useState(60)
  const [turnDeadline, setTurnDeadline] = useState<string | null>(null)
  const [showGameOver, setShowGameOver] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { subscribe, connected } = useWebSocket(gameId)
  const address = getStoredAddress()

  // Load game
  useEffect(() => {
    async function load() {
      try {
        const { game } = await getGame(gameId)
        setWager(game.wager)
        setTimePerMove(game.timePerMove)
        setTurnDeadline(game.currentTurnDeadline)

        // Determine player color
        if (address === game.blackPlayer) {
          setPlayerColor('black')
          setOpponent(game.whitePlayer)
        } else {
          setPlayerColor('white')
          setOpponent(game.blackPlayer)
        }

        // Parse game state
        const stateStr = typeof game.gameState === 'string'
          ? game.gameState
          : JSON.stringify(game.gameState)
        const parsed = JSON.parse(stateStr)
        const state = parsed.b && typeof parsed.b === 'string'
          ? deserializeGameState(stateStr)
          : parsed as GameState

        setGameState(state)

        if (game.winner) {
          setWinner(game.winner)
          setShowGameOver(true)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [gameId, address])

  // Subscribe to WS updates
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'game:move' || msg.type === 'game:over') {
        const gs = msg.gameState as GameState
        if (gs) setGameState(gs)
        if (msg.type === 'game:over') {
          setWinner(msg.winner as string | null)
          setShowGameOver(true)
        }
      }
      if (msg.type === 'game:joined') {
        // Opponent joined — reload
        getGame(gameId).then(({ game }) => {
          setOpponent(address === game.blackPlayer ? game.whitePlayer : game.blackPlayer)
          setTurnDeadline(game.currentTurnDeadline)
          const stateStr = typeof game.gameState === 'string'
            ? game.gameState
            : JSON.stringify(game.gameState)
          const parsed = JSON.parse(stateStr)
          const state = parsed.b && typeof parsed.b === 'string'
            ? deserializeGameState(stateStr)
            : parsed as GameState
          setGameState(state)
        })
      }
    })
    return unsub
  }, [subscribe, gameId, address])

  // Handle move from board component
  const handleMove = useCallback(async (from: { row: number; col: number }, to: { row: number; col: number }) => {
    try {
      const result = await makeMove(gameId, from, to)
      const gs = result.gameState as GameState
      if (gs) setGameState(gs)
    } catch (err) {
      console.error('Move failed:', err)
    }
  }, [gameId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-danger">{error}</p>
        <button onClick={() => router.push('/')} className="text-sm text-accent hover:underline">
          Back to lobby
        </button>
      </div>
    )
  }

  if (!gameState) return null

  const isMyTurn = gameState.currentTurn === playerColor
  const isPlaying = gameState.status === 'playing'

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-xl">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-text-secondary hover:text-text transition-colors"
        >
          &larr; Lobby
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
          <span className="text-sm font-medium text-text-secondary">
            Wager: {(Number(wager) / 1_000_000).toFixed(0)} COIN
          </span>
        </div>
      </div>

      {/* Opponent info */}
      <div className="flex items-center gap-3 px-4 py-2 bg-bg-card border border-border rounded-xl">
        <div className={`w-6 h-6 rounded-full ${playerColor === 'white' ? 'bg-piece-black' : 'bg-piece-white border border-border'}`} />
        <span className="text-sm font-medium">
          {opponent ? `${opponent.slice(0, 8)}...${opponent.slice(-4)}` : 'Waiting for opponent...'}
        </span>
      </div>

      {/* Timer */}
      {isPlaying && turnDeadline && (
        <MoveTimer
          deadline={turnDeadline}
          isMyTurn={isMyTurn}
          timePerMove={timePerMove}
        />
      )}

      {/* Board */}
      <CheckersBoard
        gameId={gameId}
        playerColor={playerColor}
        externalState={gameState}
        onMove={handleMove}
      />

      {/* My info */}
      <div className="flex items-center gap-3 px-4 py-2 bg-bg-card border border-border rounded-xl">
        <div className={`w-6 h-6 rounded-full ${playerColor === 'white' ? 'bg-piece-white border border-border' : 'bg-piece-black'}`} />
        <span className="text-sm font-medium">
          You {address ? `(${address.slice(0, 8)}...)` : ''}
        </span>
        {isMyTurn && isPlaying && (
          <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full font-medium">
            Your turn
          </span>
        )}
      </div>

      {/* Game over modal */}
      {showGameOver && (
        <GameOverModal
          winner={winner}
          myAddress={address}
          playerColor={playerColor}
          wager={wager}
          gameState={gameState}
          onClose={() => setShowGameOver(false)}
          onBackToLobby={() => router.push('/')}
        />
      )}
    </div>
  )
}
