'use client'

import { motion } from 'framer-motion'
import type { GameState, PieceColor } from '@checkers/shared'

interface GameOverModalProps {
  winner: string | null
  myAddress: string | null
  playerColor: PieceColor
  wager: string
  gameState: GameState
  gameId?: string
  onClose: () => void
  onBackToLobby: () => void
  onRematch?: () => void
  rematchOffered?: boolean
  rematchPending?: boolean
  onRematchAccept?: () => void
  onRematchDecline?: () => void
  txHashResolve?: string | null
  relayerActive?: boolean
}

export function GameOverModal({
  winner,
  myAddress,
  playerColor,
  wager,
  gameState,
  gameId,
  onClose,
  onBackToLobby,
  onRematch,
  rematchOffered,
  rematchPending,
  onRematchAccept,
  onRematchDecline,
  txHashResolve,
  relayerActive,
}: GameOverModalProps) {
  const iWon = winner === myAddress
  const isDraw = gameState.status === 'draw'
  const wagerDisplay = (Number(wager) / 1_000_000).toFixed(0)
  const prizeDisplay = (Number(wager) * 2 * 0.9 / 1_000_000).toFixed(0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-bg-card border border-border rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-5"
      >
        {/* Icon */}
        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
          isDraw ? 'bg-warning/10' : iWon ? 'bg-success/10' : 'bg-danger/10'
        }`}>
          {isDraw ? (
            <span className="text-3xl font-bold text-warning">=</span>
          ) : iWon ? (
            <svg className="w-10 h-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold">
          {isDraw ? 'Ничья!' : iWon ? 'Вы победили!' : 'Вы проиграли'}
        </h2>

        {/* Stats */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between px-4">
            <span className="text-text-secondary">Ходы</span>
            <span className="font-medium">{gameState.moveCount}</span>
          </div>
          <div className="flex justify-between px-4">
            <span className="text-text-secondary">Ставка</span>
            <span className="font-medium">{wagerDisplay} AXM</span>
          </div>
          {iWon && (
            <div className="flex justify-between px-4">
              <span className="text-text-secondary">Выигрыш</span>
              <span className="font-medium text-success">+{prizeDisplay} AXM</span>
            </div>
          )}
          {/* On-chain status */}
          {Number(wager) > 0 && (
            <div className="flex justify-between px-4">
              <span className="text-text-secondary">On-chain</span>
              <span className={`font-medium ${txHashResolve ? 'text-success' : relayerActive ? 'text-warning' : 'text-text-muted'}`}>
                {txHashResolve ? 'Подтверждено' : relayerActive ? 'Ожидание...' : 'Офлайн'}
              </span>
            </div>
          )}
        </div>

        {/* Rematch pending notification */}
        {rematchPending && onRematchAccept && onRematchDecline && (
          <div className="px-4 py-3 bg-accent/10 border border-accent/30 rounded-xl space-y-2">
            <p className="text-sm font-medium text-accent">Соперник предлагает реванш</p>
            <div className="flex gap-2">
              <button
                onClick={onRematchAccept}
                className="flex-1 py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90 transition-colors"
              >
                Принять
              </button>
              <button
                onClick={onRematchDecline}
                className="flex-1 py-2 border border-border text-text-secondary text-sm font-medium rounded-lg hover:border-border-hover transition-colors"
              >
                Отклонить
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-3">
            <button
              onClick={onBackToLobby}
              className="flex-1 py-2.5 bg-accent text-white font-medium rounded-xl hover:bg-accent-hover transition-colors"
            >
              В лобби
            </button>
            {onRematch && !rematchPending && (
              <button
                onClick={onRematch}
                disabled={rematchOffered}
                className="flex-1 py-2.5 bg-success text-white font-medium rounded-xl hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                {rematchOffered ? 'Ожидание ответа...' : 'Реванш'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-text-secondary font-medium rounded-xl hover:border-border-hover transition-colors"
            >
              Смотреть доску
            </button>
            {gameId && (
              <a
                href={`/replay/${gameId}`}
                className="flex-1 py-2.5 border border-border text-text-secondary font-medium rounded-xl hover:border-border-hover transition-colors text-center"
              >
                Повтор
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
