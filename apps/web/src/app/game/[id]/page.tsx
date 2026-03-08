'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckersBoard } from '@/components/board/checkers-board'
import { GameOverModal } from '@/components/ui/game-over-modal'
import { MoveTimer } from '@/components/ui/move-timer'
import { MoveHistory } from '@/components/ui/move-history'
import { InviteLink } from '@/components/ui/invite-link'
import { useWebSocket } from '@/hooks/use-websocket'
import { useToast } from '@/components/ui/toast'
import { getGame, makeMove, resignGame, offerDraw, acceptDraw, getStoredAddress } from '@/lib/api'
import { useWallet } from '@/contexts/wallet-context'
import { deserializeGameState, playGameOverSound } from './imports'
import type { GameState, PieceColor } from '@checkers/shared'

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = use(params)
  const router = useRouter()
  const { toast } = useToast()
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
  const [drawOffered, setDrawOffered] = useState(false)
  const [drawPending, setDrawPending] = useState(false)
  const [showResignConfirm, setShowResignConfirm] = useState(false)

  const { subscribe, connected } = useWebSocket(gameId)
  const { address } = useWallet()

  // Load game
  useEffect(() => {
    async function load() {
      try {
        const { game } = await getGame(gameId)
        setWager(game.wager)
        setTimePerMove(game.timePerMove)
        setTurnDeadline(game.currentTurnDeadline)

        if (address === game.blackPlayer) {
          setPlayerColor('black')
          setOpponent(game.whitePlayer)
        } else {
          setPlayerColor('white')
          setOpponent(game.blackPlayer)
        }

        const stateStr = typeof game.gameState === 'string'
          ? game.gameState : JSON.stringify(game.gameState)
        const parsed = JSON.parse(stateStr)
        const state = parsed.b && typeof parsed.b === 'string'
          ? deserializeGameState(stateStr) : { ...parsed, variant: parsed.variant || game.variant || 'russian' } as GameState

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

  // WS events
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'game:move' || msg.type === 'game:over') {
        const gs = msg.gameState as GameState
        if (gs) setGameState(prev => ({ ...gs, variant: gs.variant || prev?.variant || 'russian' }))
        if (msg.type === 'game:over') {
          setWinner(msg.winner as string | null)
          setShowGameOver(true)
          const iWon = msg.winner === address
          try { playGameOverSound(iWon) } catch {}
        }
      }
      if (msg.type === 'game:joined') {
        getGame(gameId).then(({ game }) => {
          setOpponent(address === game.blackPlayer ? game.whitePlayer : game.blackPlayer)
          setTurnDeadline(game.currentTurnDeadline)
          const stateStr = typeof game.gameState === 'string'
            ? game.gameState : JSON.stringify(game.gameState)
          const parsed = JSON.parse(stateStr)
          const state = parsed.b && typeof parsed.b === 'string'
            ? deserializeGameState(stateStr) : { ...parsed, variant: parsed.variant || game.variant || 'russian' } as GameState
          setGameState(state)
          toast('Opponent joined!')
        })
      }
      if (msg.type === 'game:timeout') {
        setWinner(msg.winner as string | null)
        setShowGameOver(true)
        toast(msg.winner === address ? 'Opponent timed out — you win!' : 'You ran out of time', msg.winner === address ? 'success' : 'error')
      }
      if (msg.type === 'draw:offer') {
        if (msg.from !== address) {
          setDrawPending(true)
          toast('Opponent offers a draw')
        }
      }
    })
    return unsub
  }, [subscribe, gameId, address, toast])

  const handleMove = useCallback(async (from: { row: number; col: number }, to: { row: number; col: number }) => {
    try {
      const result = await makeMove(gameId, from, to)
      const gs = result.gameState as GameState
      if (gs) {
        setGameState(gs)
        setTurnDeadline(new Date(Date.now() + timePerMove * 1000).toISOString())
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Move failed', 'error')
    }
  }, [gameId, timePerMove, toast])

  const handleResign = async () => {
    try {
      await resignGame(gameId)
      setShowResignConfirm(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to resign', 'error')
    }
  }

  const handleDrawOffer = async () => {
    try {
      await offerDraw(gameId)
      setDrawOffered(true)
      toast('Draw offer sent')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  const handleDrawAccept = async () => {
    try {
      await acceptDraw(gameId)
      setDrawPending(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

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

  const isSpectator = !address || (address !== opponent && gameState.status !== 'waiting')
  const isPlayer = !isSpectator
  const isMyTurn = isPlayer && gameState.currentTurn === playerColor
  const isPlaying = gameState.status === 'playing'
  const isWaiting = gameState.status === 'waiting'

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-xl">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-text-secondary hover:text-text transition-colors"
        >
          &larr; Lobby
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            gameState.variant === 'russian' ? 'bg-accent/10 text-accent' : 'bg-board-dark/10 text-board-dark'
          }`}>
            {gameState.variant === 'russian' ? 'RUS' : 'USA'}
          </span>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
          <span className="text-sm font-medium text-text-secondary">
            {(Number(wager) / 1_000_000).toFixed(0)} COIN
          </span>
        </div>
      </div>

      {/* Spectator badge */}
      {isSpectator && isPlaying && (
        <div className="px-3 py-1.5 bg-bg-subtle border border-border rounded-full text-xs font-medium text-text-secondary">
          Spectating
        </div>
      )}

      {/* Waiting state */}
      {isWaiting && (
        <div className="w-full max-w-md space-y-3">
          <div className="px-6 py-4 bg-bg-card border border-border rounded-xl text-center space-y-2">
            <div className="w-6 h-6 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">Waiting for opponent to join...</p>
          </div>
          <InviteLink gameId={gameId} />
        </div>
      )}

      {/* Opponent info */}
      {opponent && (
        <div className="flex items-center gap-3 px-4 py-2 bg-bg-card border border-border rounded-xl">
          <div className={`w-6 h-6 rounded-full ${playerColor === 'white' ? 'bg-piece-black' : 'bg-piece-white border border-border'}`} />
          <span className="text-sm font-medium">
            {opponent.slice(0, 8)}...{opponent.slice(-4)}
          </span>
        </div>
      )}

      {/* Timer */}
      {isPlaying && turnDeadline && (
        <MoveTimer deadline={turnDeadline} isMyTurn={isMyTurn} timePerMove={timePerMove} />
      )}

      {/* Draw offer banner */}
      {drawPending && (
        <div className="flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-xl">
          <span className="text-sm font-medium text-warning">Opponent offers a draw</span>
          <button onClick={handleDrawAccept} className="px-3 py-1 bg-success text-white text-xs font-medium rounded-lg">Accept</button>
          <button onClick={() => setDrawPending(false)} className="px-3 py-1 bg-bg-subtle text-text-secondary text-xs font-medium rounded-lg">Decline</button>
        </div>
      )}

      {/* Board + Move History */}
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <CheckersBoard
          gameId={gameId}
          playerColor={playerColor}
          externalState={gameState}
          onMove={handleMove}
        />
        <div className="w-full md:w-48 shrink-0">
          <MoveHistory moves={gameState.moveHistory} />
        </div>
      </div>

      {/* My info */}
      <div className="flex items-center gap-3 px-4 py-2 bg-bg-card border border-border rounded-xl">
        <div className={`w-6 h-6 rounded-full ${playerColor === 'white' ? 'bg-piece-white border border-border' : 'bg-piece-black'}`} />
        <span className="text-sm font-medium">
          You {address ? `(${address.slice(0, 8)}...)` : ''}
        </span>
        {isMyTurn && isPlaying && (
          <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full font-medium">Your turn</span>
        )}
      </div>

      {/* Game controls (players only) */}
      {isPlaying && isPlayer && (
        <div className="flex gap-3">
          <button
            onClick={handleDrawOffer}
            disabled={drawOffered}
            className="px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-xl hover:border-border-hover transition-colors disabled:opacity-50"
          >
            {drawOffered ? 'Draw offered' : 'Offer Draw'}
          </button>
          {showResignConfirm ? (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-danger">Sure?</span>
              <button onClick={handleResign} className="px-3 py-2 text-sm font-medium text-white bg-danger rounded-xl">Yes, resign</button>
              <button onClick={() => setShowResignConfirm(false)} className="px-3 py-2 text-sm font-medium text-text-secondary border border-border rounded-xl">No</button>
            </div>
          ) : (
            <button
              onClick={() => setShowResignConfirm(true)}
              className="px-4 py-2 text-sm font-medium text-danger border border-danger/30 rounded-xl hover:bg-danger/5 transition-colors"
            >
              Resign
            </button>
          )}
        </div>
      )}

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
