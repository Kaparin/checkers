'use client'

import { use, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckersBoard } from '@/components/board/checkers-board'
import { GameOverModal } from '@/components/ui/game-over-modal'
import { MoveHistory } from '@/components/ui/move-history'
import { InviteLink } from '@/components/ui/invite-link'
import { AvatarVsBar } from '@/components/ui/avatar-vs-bar'
import { GameStartSplash } from '@/components/ui/game-start-splash'
import { LeaveGameModal } from '@/components/ui/leave-game-modal'
import { useWebSocket } from '@/hooks/use-websocket'
import { useNavigationBlock } from '@/hooks/use-navigation-block'
import { useToast } from '@/components/ui/toast'
import { getGame, makeMove, resignGame, offerDraw, acceptDraw, cancelGame, joinGame, confirmReady, offerRematch, acceptRematch, declineRematch } from '@/lib/api'
import { useWallet } from '@/contexts/wallet-context'
import { deserializeGameState, playGameOverSound } from './imports'
import { Skeleton, SkeletonBoard } from '@/components/ui/skeleton'
import { GameChat } from '@/components/ui/game-chat'
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
  const [showMoves, setShowMoves] = useState(false)
  const [variant, setVariant] = useState<string>('russian')
  const [joiningGame, setJoiningGame] = useState(false)

  // Track actual player addresses
  const [blackPlayer, setBlackPlayer] = useState<string | null>(null)
  const [whitePlayer, setWhitePlayer] = useState<string | null>(null)

  // Ready check
  const [isReadyCheck, setIsReadyCheck] = useState(false)
  const [myReady, setMyReady] = useState(false)
  const [opponentReady, setOpponentReady] = useState(false)
  const [readyLoading, setReadyLoading] = useState(false)

  // Game start splash
  const [showSplash, setShowSplash] = useState(false)

  // Rematch
  const [rematchOffered, setRematchOffered] = useState(false)
  const [rematchPending, setRematchPending] = useState(false)
  const [rematchLoading, setRematchLoading] = useState(false)

  const { subscribe, connected } = useWebSocket(gameId)
  const { address, isConnected, openConnectModal } = useWallet()

  // Helper: parse game state from API response
  function parseGameState(game: any): GameState {
    const stateStr = typeof game.gameState === 'string'
      ? game.gameState : JSON.stringify(game.gameState)
    const parsed = JSON.parse(stateStr)
    return parsed.b && typeof parsed.b === 'string'
      ? deserializeGameState(stateStr)
      : { ...parsed, variant: parsed.variant || game.variant || 'russian' } as GameState
  }

  // Helper: sync all state from game object
  function syncGameData(game: any) {
    setWager(game.wager)
    setTimePerMove(game.timePerMove)
    setTurnDeadline(game.currentTurnDeadline)
    setVariant(game.variant || 'russian')
    setBlackPlayer(game.blackPlayer)
    setWhitePlayer(game.whitePlayer)

    if (address === game.blackPlayer) {
      setPlayerColor('black')
      setOpponent(game.whitePlayer)
    } else {
      setPlayerColor('white')
      setOpponent(game.blackPlayer)
    }

    if (game.status === 'ready_check') {
      setIsReadyCheck(true)
      const amBlack = address === game.blackPlayer
      setMyReady(amBlack ? game.blackReady : game.whiteReady)
      setOpponentReady(amBlack ? game.whiteReady : game.blackReady)
    } else {
      setIsReadyCheck(false)
    }

    setGameState(parseGameState(game))

    if (game.winner) {
      setWinner(game.winner)
      setShowGameOver(true)
    }
  }

  // Load game
  useEffect(() => {
    async function load() {
      try {
        const { game } = await getGame(gameId)
        syncGameData(game)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки игры')
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
        if (msg.type === 'game:move') {
          setTurnDeadline(new Date(Date.now() + timePerMove * 1000).toISOString())
        }
        if (msg.type === 'game:over') {
          setTurnDeadline(null)
          setWinner(msg.winner as string | null)
          setShowGameOver(true)
          const iWon = msg.winner === address
          try { playGameOverSound(iWon) } catch {}
        }
      }
      if (msg.type === 'game:joined') {
        getGame(gameId).then(({ game }) => {
          syncGameData(game)
          toast('Соперник присоединился!')
        }).catch(() => {})
      }
      if (msg.type === 'game:ready') {
        const ready = msg as any
        if (ready.player === address) {
          setMyReady(true)
        } else {
          setOpponentReady(true)
        }
      }
      if (msg.type === 'game:both_ready') {
        setIsReadyCheck(false)
        setMyReady(false)
        setOpponentReady(false)
        setShowSplash(true)
        const game = (msg as any).game
        if (game) {
          setTurnDeadline(game.currentTurnDeadline)
          setGameState(parseGameState(game))
        }
      }
      if (msg.type === 'game:canceled') {
        toast('Игра отменена', 'error')
        setTimeout(() => router.push('/'), 1500)
      }
      if (msg.type === 'game:timeout') {
        setTurnDeadline(null)
        setWinner(msg.winner as string | null)
        setShowGameOver(true)
        toast(msg.winner === address ? 'Соперник не успел — вы победили!' : 'Время вышло', msg.winner === address ? 'success' : 'error')
      }
      if (msg.type === 'draw:offer') {
        if (msg.from !== address) {
          setDrawPending(true)
          toast('Соперник предлагает ничью')
        }
      }
      if (msg.type === 'game:rematch_offer') {
        if ((msg as any).from !== address) {
          setRematchPending(true)
          toast('Соперник предлагает реванш')
        }
      }
      if (msg.type === 'game:rematch_accept') {
        const newGameId = (msg as any).newGameId
        if (newGameId) router.push(`/game/${newGameId}`)
      }
      if (msg.type === 'game:rematch_decline') {
        if ((msg as any).from !== address) {
          setRematchOffered(false)
          toast('Соперник отклонил реванш')
        }
      }
      if (msg.type === 'player:disconnected') {
        toast('Соперник отключился', 'error')
      }
      if (msg.type === 'player:connected') {
        toast('Соперник переподключился', 'success')
      }
    })
    return unsub
  }, [subscribe, gameId, address, toast, router, variant, timePerMove])

  // Toast 10 seconds before timeout
  const timeoutToastFired = useRef<string | null>(null)
  const isMyTurnNow = gameState?.currentTurn === playerColor && gameState?.status === 'playing'
  useEffect(() => {
    if (!turnDeadline || !isMyTurnNow) {
      timeoutToastFired.current = null
      return
    }
    const deadlineMs = new Date(turnDeadline).getTime()
    const remainingMs = deadlineMs - Date.now()
    if (remainingMs <= 0 || remainingMs <= 10_000) return
    const timerId = setTimeout(() => {
      if (timeoutToastFired.current !== turnDeadline) {
        timeoutToastFired.current = turnDeadline
        toast('Осталось 10 секунд!', 'error')
      }
    }, remainingMs - 10_000)
    return () => clearTimeout(timerId)
  }, [turnDeadline, isMyTurnNow, toast])

  // --- Handlers ---

  const handleMove = useCallback(async (from: { row: number; col: number }, to: { row: number; col: number }) => {
    try {
      const result = await makeMove(gameId, from, to)
      const gs = result.gameState as GameState
      if (gs) {
        setGameState(gs)
        setTurnDeadline(new Date(Date.now() + timePerMove * 1000).toISOString())
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка хода', 'error')
    }
  }, [gameId, timePerMove, toast])

  const handleJoinGame = async () => {
    if (joiningGame) return
    if (!isConnected) {
      openConnectModal()
      return
    }
    setJoiningGame(true)
    try {
      const { game } = await joinGame(gameId)
      syncGameData(game)
      toast('Вы присоединились к игре!')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка присоединения', 'error')
    }
    setJoiningGame(false)
  }

  const handleCancel = async () => {
    try {
      await cancelGame(gameId)
      router.push('/')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка отмены', 'error')
    }
  }

  const handleResign = async () => {
    try {
      await resignGame(gameId)
      setShowResignConfirm(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка при сдаче', 'error')
    }
  }

  const handleDrawOffer = async () => {
    try {
      await offerDraw(gameId)
      setDrawOffered(true)
      toast('Предложение ничьи отправлено')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
  }

  const handleReady = async () => {
    if (readyLoading) return
    setReadyLoading(true)
    try {
      await confirmReady(gameId)
      setMyReady(true)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
    setReadyLoading(false)
  }

  const handleRematchOffer = async () => {
    if (rematchLoading) return
    setRematchLoading(true)
    try {
      await offerRematch(gameId)
      setRematchOffered(true)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
    setRematchLoading(false)
  }

  const handleRematchAccept = async () => {
    try {
      const { game } = await acceptRematch(gameId)
      router.push(`/game/${game.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
  }

  const handleRematchDecline = async () => {
    try {
      await declineRematch(gameId)
      setRematchPending(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
  }

  const handleDrawAccept = async () => {
    try {
      await acceptDraw(gameId)
      setDrawPending(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ошибка', 'error')
    }
  }

  // --- Derived state ---
  const isFinished = gameState ? ['black_wins', 'white_wins', 'draw'].includes(gameState.status) : false
  const isPlaying = gameState?.status === 'playing'
  const isWaiting = gameState?.status === 'waiting'
  const isCreator = !!address && address === blackPlayer
  const isPlayer = !!address && (address === blackPlayer || address === whitePlayer)
  const isSpectator = !isPlayer
  const isMyTurn = isPlayer && gameState?.currentTurn === playerColor
  const opponentColor: PieceColor = playerColor === 'white' ? 'black' : 'white'
  const isOpponentTurn = isPlaying && gameState?.currentTurn === opponentColor

  // Can this user join? (waiting game, not creator, not already a player)
  const canJoin = isWaiting && !isCreator && !isPlayer

  // Navigation block — only during active game
  const shouldBlock = !!(isPlayer && (isPlaying || isReadyCheck) && !isFinished && !showGameOver)
  const { showLeaveModal, confirmLeave, cancelLeave, tryNavigate } = useNavigationBlock(shouldBlock)

  // --- Render ---

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
          Назад в лобби
        </button>
      </div>
    )
  }

  if (!gameState) return null

  return (
    <div className="fixed inset-0 bg-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-card shrink-0">
        <button
          onClick={() => tryNavigate(() => router.push('/'))}
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
          {gameState.moveHistory.length > 0 && (
            <button
              onClick={() => setShowMoves(!showMoves)}
              className="text-text-muted hover:text-text transition-colors"
              title="Ходы"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
          )}
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
        </div>
      </div>

      {/* Game content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-3 overflow-hidden relative">

        {/* Spectator badge */}
        {isSpectator && isPlaying && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-bg-subtle border border-border rounded-full text-xs font-medium text-text-secondary z-10">
            Наблюдение
          </div>
        )}

        {/* ========== WAITING STATE ========== */}
        {isWaiting && (
          <div className="w-full max-w-md space-y-3 mb-3">
            {/* CREATOR view: waiting for opponent */}
            {isCreator && (
              <>
                <div className="px-6 py-4 bg-bg-card border border-border rounded-xl text-center space-y-2">
                  <div className="w-6 h-6 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-text-secondary">Ожидание соперника...</p>
                </div>
                <InviteLink gameId={gameId} />
                <button
                  onClick={handleCancel}
                  className="w-full py-2.5 text-sm font-medium text-danger border border-danger/30 rounded-xl hover:bg-danger/5 transition-colors"
                >
                  Отменить
                </button>
              </>
            )}

            {/* GUEST view: can join the game */}
            {canJoin && (
              <div className="px-6 py-5 bg-bg-card border border-border rounded-xl text-center space-y-4">
                <div className="space-y-1">
                  <p className="text-lg font-bold">Приглашение в игру</p>
                  <p className="text-sm text-text-secondary">
                    Ставка: <span className="font-semibold text-text">{(Number(wager) / 1_000_000).toFixed(0)} AXM</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {variant === 'russian' ? 'Русские шашки' : 'Американские шашки'} &middot; {timePerMove}с на ход
                  </p>
                </div>
                <button
                  onClick={handleJoinGame}
                  disabled={joiningGame}
                  className="w-full py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {joiningGame
                    ? 'Подключение...'
                    : isConnected
                      ? 'Присоединиться'
                      : 'Подключить кошелёк и играть'}
                </button>
                {!isConnected && (
                  <p className="text-[10px] text-text-muted">
                    Для игры необходим кошелёк с AXM
                  </p>
                )}
              </div>
            )}

            {/* Already a player but not creator — shouldn't happen normally but handle it */}
            {isPlayer && !isCreator && (
              <div className="px-6 py-4 bg-bg-card border border-border rounded-xl text-center space-y-2">
                <div className="w-6 h-6 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-text-secondary">Ожидание начала игры...</p>
              </div>
            )}
          </div>
        )}

        {/* ========== ACTIVE GAME (ready_check / playing / finished) ========== */}

        {/* Avatar VS bar */}
        {!isWaiting && (
          <AvatarVsBar
            opponent={{
              address: opponent,
              color: opponentColor,
              isCurrentTurn: isOpponentTurn,
              isReady: opponentReady,
            }}
            player={{
              address: address,
              color: playerColor,
              isCurrentTurn: isMyTurn && isPlaying,
              isReady: myReady,
            }}
            deadline={turnDeadline}
            timePerMove={timePerMove}
            isReadyCheck={isReadyCheck}
          />
        )}

        {/* Ready check UI */}
        {isReadyCheck && isPlayer && (
          <div className="w-full max-w-md">
            {!myReady ? (
              <button
                onClick={handleReady}
                disabled={readyLoading}
                className="w-full py-3 bg-success text-white font-semibold rounded-xl hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                {readyLoading ? 'Подтверждение...' : 'Начать игру'}
              </button>
            ) : (
              <div className="px-4 py-3 bg-bg-card border border-border rounded-xl text-center">
                <div className="w-5 h-5 mx-auto mb-1 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-text-secondary">Ожидание подтверждения соперника...</p>
              </div>
            )}
          </div>
        )}

        {/* Draw offer banner */}
        {drawPending && (
          <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg w-full max-w-md">
            <span className="text-xs font-medium text-warning flex-1">Предложение ничьи</span>
            <button onClick={handleDrawAccept} className="px-2.5 py-1 bg-success text-white text-xs font-medium rounded-md">Принять</button>
            <button onClick={() => setDrawPending(false)} className="px-2.5 py-1 bg-bg-subtle text-text-secondary text-xs font-medium rounded-md">Отклонить</button>
          </div>
        )}

        {/* Board */}
        <CheckersBoard
          gameId={gameId}
          playerColor={playerColor}
          externalState={gameState}
          onMove={handleMove}
        />

        {/* Turn indicator */}
        {isPlaying && isPlayer && (
          <div className={`text-xs font-medium px-3 py-1 rounded-full ${
            isMyTurn
              ? 'bg-success/10 text-success'
              : 'bg-bg-subtle text-text-muted'
          }`}>
            {isMyTurn ? 'Ваш ход' : 'Ход соперника'}
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
              {drawOffered ? 'Предложена' : 'Ничья'}
            </button>
            {showResignConfirm ? (
              <div className="flex gap-1.5 items-center">
                <span className="text-[10px] text-danger">Точно?</span>
                <button onClick={handleResign} className="px-2.5 py-1.5 text-xs font-medium text-white bg-danger rounded-lg">Да</button>
                <button onClick={() => setShowResignConfirm(false)} className="px-2.5 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg">Нет</button>
              </div>
            ) : (
              <button
                onClick={() => setShowResignConfirm(true)}
                className="px-3 py-1.5 text-xs font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger/5 transition-colors"
              >
                Сдаться
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
          gameId={gameId}
          onClose={() => setShowGameOver(false)}
          onBackToLobby={() => router.push('/')}
          onRematch={isPlayer ? handleRematchOffer : undefined}
          rematchOffered={rematchOffered}
          rematchPending={rematchPending}
          onRematchAccept={handleRematchAccept}
          onRematchDecline={handleRematchDecline}
        />
      )}

      {/* Game start splash */}
      <GameStartSplash show={showSplash} onDone={() => setShowSplash(false)} />

      {/* Leave game modal */}
      <LeaveGameModal open={showLeaveModal} onConfirm={confirmLeave} onCancel={cancelLeave} />
    </div>
  )
}
