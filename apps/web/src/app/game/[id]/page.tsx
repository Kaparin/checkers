'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckersBoard } from '@/components/board/checkers-board'
import { GameOverModal } from '@/components/ui/game-over-modal'
import { MoveHistory } from '@/components/ui/move-history'
import { InviteLink } from '@/components/ui/invite-link'
import { useWebSocket } from '@/hooks/use-websocket'
import { useToast } from '@/components/ui/toast'
import { getGame, makeMove, resignGame, offerDraw, acceptDraw } from '@/lib/api'
import { useWallet } from '@/contexts/wallet-context'
import { deserializeGameState, playGameOverSound } from './imports'
import { Skeleton, SkeletonBoard } from '@/components/ui/skeleton'
import { GameChat } from '@/components/ui/game-chat'
import type { GameState, PieceColor } from '@checkers/shared'

function PlayerCard({
  address,
  pieceColor,
  isCurrentTurn,
  deadline,
  timePerMove,
  isTop,
}: {
  address: string | null
  pieceColor: PieceColor
  isCurrentTurn: boolean
  deadline: string | null
  timePerMove: number
  isTop: boolean
}) {
  const [secondsLeft, setSecondsLeft] = useState(timePerMove)

  useEffect(() => {
    if (!deadline || !isCurrentTurn) {
      setSecondsLeft(timePerMove)
      return
    }
    const target = new Date(deadline).getTime()
    function tick() {
      const diff = Math.max(0, Math.ceil((target - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deadline, isCurrentTurn, timePerMove])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const isLow = isCurrentTurn && secondsLeft <= 10
  const pct = Math.max(0, (secondsLeft / timePerMove) * 100)

  const short = address
    ? `${address.slice(0, 8)}...${address.slice(-4)}`
    : 'Waiting...'

  return (
    <div className={`flex items-center gap-3 w-full max-w-md ${isTop ? '' : ''}`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
        pieceColor === 'black'
          ? 'bg-piece-black'
          : 'bg-piece-white border border-border'
      }`}>
        <span className={`text-sm font-bold ${
          pieceColor === 'black' ? 'text-white' : 'text-piece-black'
        }`}>
          {address ? address[3].toUpperCase() : '?'}
        </span>
      </div>

      {/* Name + timer */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-text truncate">
            {isTop ? short : `You (${short})`}
          </span>
          <span className={`text-sm font-mono font-semibold tabular-nums ${
            isLow ? 'text-danger animate-pulse' : isCurrentTurn ? 'text-text' : 'text-text-muted'
          }`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
        {/* Timer bar */}
        <div className="h-1 bg-bg-subtle rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isLow ? 'bg-danger' : isCurrentTurn ? 'bg-accent' : 'bg-text-muted/30'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

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
  const [showMoves, setShowMoves] = useState(false)
  const [variant, setVariant] = useState<string>('russian')

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
        setVariant(game.variant || 'russian')

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
      <div className="fixed inset-0 bg-bg flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-card shrink-0">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="w-2 h-2 rounded-full" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <div className="flex items-center gap-3 w-full max-w-md">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-1 w-full rounded-full" />
            </div>
          </div>
          <SkeletonBoard />
          <div className="flex items-center gap-3 w-full max-w-md">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-1 w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center gap-4">
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
  const opponentColor: PieceColor = playerColor === 'white' ? 'black' : 'white'
  const isOpponentTurn = isPlaying && gameState.currentTurn === opponentColor

  return (
    <div className="fixed inset-0 bg-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-card shrink-0">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-text-secondary hover:text-text transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
            variant === 'russian' ? 'bg-accent/10 text-accent' : 'bg-board-dark/10 text-board-dark'
          }`}>
            {variant === 'russian' ? 'RUS' : 'USA'}
          </span>
          <span className="text-xs font-medium text-text-secondary">
            {(Number(wager) / 1_000_000).toFixed(0)} AXM
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Move history toggle */}
          {gameState.moveHistory.length > 0 && (
            <button
              onClick={() => setShowMoves(!showMoves)}
              className="text-text-muted hover:text-text transition-colors"
              title="Moves"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
          )}
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
        </div>
      </div>

      {/* Game content — flex-1 fills remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-3 overflow-hidden relative">

        {/* Spectator badge */}
        {isSpectator && isPlaying && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-bg-subtle border border-border rounded-full text-xs font-medium text-text-secondary z-10">
            Spectating
          </div>
        )}

        {/* Waiting state */}
        {isWaiting && (
          <div className="w-full max-w-md space-y-3 mb-3">
            <div className="px-6 py-4 bg-bg-card border border-border rounded-xl text-center space-y-2">
              <div className="w-6 h-6 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-secondary">Waiting for opponent...</p>
            </div>
            <InviteLink gameId={gameId} />
          </div>
        )}

        {/* Opponent card */}
        {!isWaiting && (
          <PlayerCard
            address={opponent}
            pieceColor={opponentColor}
            isCurrentTurn={isOpponentTurn}
            deadline={turnDeadline}
            timePerMove={timePerMove}
            isTop
          />
        )}

        {/* VS divider */}
        {isPlaying && (
          <div className="flex items-center gap-3 w-full max-w-md">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-bold text-text-muted tracking-widest">VS</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Draw offer banner */}
        {drawPending && (
          <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg w-full max-w-md">
            <span className="text-xs font-medium text-warning flex-1">Draw offer</span>
            <button onClick={handleDrawAccept} className="px-2.5 py-1 bg-success text-white text-xs font-medium rounded-md">Accept</button>
            <button onClick={() => setDrawPending(false)} className="px-2.5 py-1 bg-bg-subtle text-text-secondary text-xs font-medium rounded-md">Decline</button>
          </div>
        )}

        {/* Board */}
        <CheckersBoard
          gameId={gameId}
          playerColor={playerColor}
          externalState={gameState}
          onMove={handleMove}
        />

        {/* Player card */}
        {!isWaiting && (
          <PlayerCard
            address={address}
            pieceColor={playerColor}
            isCurrentTurn={isMyTurn && isPlaying}
            deadline={turnDeadline}
            timePerMove={timePerMove}
            isTop={false}
          />
        )}

        {/* Turn indicator */}
        {isPlaying && isPlayer && (
          <div className={`text-xs font-medium px-3 py-1 rounded-full ${
            isMyTurn
              ? 'bg-success/10 text-success'
              : 'bg-bg-subtle text-text-muted'
          }`}>
            {isMyTurn ? 'Your turn' : "Opponent's turn"}
          </div>
        )}

        {/* Game controls */}
        {isPlaying && isPlayer && (
          <div className="flex gap-2">
            <button
              onClick={handleDrawOffer}
              disabled={drawOffered}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:border-border-hover transition-colors disabled:opacity-50"
            >
              {drawOffered ? 'Offered' : 'Draw'}
            </button>
            {showResignConfirm ? (
              <div className="flex gap-1.5 items-center">
                <span className="text-[10px] text-danger">Sure?</span>
                <button onClick={handleResign} className="px-2.5 py-1.5 text-xs font-medium text-white bg-danger rounded-lg">Yes</button>
                <button onClick={() => setShowResignConfirm(false)} className="px-2.5 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg">No</button>
              </div>
            ) : (
              <button
                onClick={() => setShowResignConfirm(true)}
                className="px-3 py-1.5 text-xs font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger/5 transition-colors"
              >
                Resign
              </button>
            )}
          </div>
        )}

        {/* Move history slide-over */}
        {showMoves && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMoves(false)} />
            <div className="absolute right-2 top-2 z-50 w-52 shadow-xl rounded-xl overflow-hidden">
              <MoveHistory moves={gameState.moveHistory} />
            </div>
          </>
        )}
      </div>

      {/* In-game chat */}
      {!isWaiting && <GameChat gameId={gameId} />}

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
