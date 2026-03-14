'use client'

import { motion } from 'framer-motion'
import { Sparkles, X, Trophy, RotateCcw, Eye, Play, ExternalLink } from 'lucide-react'
import type { GameState, PieceColor } from '@checkers/shared'

interface GameOverModalProps {
  winner: string | null
  myAddress: string | null
  playerColor: PieceColor
  wager: string
  gameState: GameState
  gameId?: string
  txHash?: string | null
  onClose: () => void
  onBackToLobby: () => void
  onRematch?: () => void
  rematchOffered?: boolean
  rematchPending?: boolean
  onRematchAccept?: () => void
  onRematchDecline?: () => void
}

export function GameOverModal({
  winner,
  myAddress,
  playerColor,
  wager,
  gameState,
  gameId,
  txHash,
  onClose,
  onBackToLobby,
  onRematch,
  rematchOffered,
  rematchPending,
  onRematchAccept,
  onRematchDecline,
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-5"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
          isDraw ? 'bg-warning/10' : iWon ? 'bg-success/10' : 'bg-danger/10'
        }`}>
          {isDraw ? (
            <span className="text-3xl font-bold text-warning">=</span>
          ) : iWon ? (
            <Trophy className="w-10 h-10 text-success" />
          ) : (
            <X className="w-10 h-10 text-danger" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-text">
          {isDraw ? 'Ничья!' : iWon ? 'Вы победили!' : 'Вы проиграли'}
        </h2>

        {/* Stats */}
        <div className="bg-bg-subtle rounded-xl p-4 space-y-2.5 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Ходы</span>
            <span className="font-medium text-text">{gameState.moveCount}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Ставка</span>
            <span className="font-medium text-text">{wagerDisplay} AXM</span>
          </div>
          {iWon && (
            <>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Выигрыш</span>
                <span className="font-semibold text-success">+{prizeDisplay} AXM</span>
              </div>
            </>
          )}
          {txHash && (
            <>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Транзакция</span>
                <span className="font-mono text-[10px] text-text-muted flex items-center gap-1" title={txHash}>
                  {txHash.slice(0, 8)}...{txHash.slice(-6)}
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </>
          )}
        </div>

        {/* Rematch pending notification */}
        {rematchPending && onRematchAccept && onRematchDecline && (
          <div className="px-4 py-3 bg-accent/10 border border-accent/30 rounded-xl space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <p className="text-sm font-medium text-accent">Соперник предлагает реванш</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onRematchAccept}
                className="flex-1 py-2 bg-success text-white text-sm font-medium rounded-xl hover:bg-success/90 transition-colors"
              >
                Принять
              </button>
              <button
                onClick={onRematchDecline}
                className="flex-1 py-2 border border-border text-text-secondary text-sm font-medium rounded-xl hover:border-border-hover hover:text-text transition-colors"
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
              className="flex-1 py-2.5 bg-accent text-white font-medium rounded-xl hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              В лобби
            </button>
            {onRematch && !rematchPending && (
              <button
                onClick={onRematch}
                disabled={rematchOffered}
                className="flex-1 py-2.5 bg-success text-white font-medium rounded-xl hover:bg-success/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {rematchOffered ? 'Ожидание...' : 'Реванш'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-text-secondary font-medium rounded-xl hover:border-border-hover hover:text-text transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Смотреть доску
            </button>
            {gameId && (
              <a
                href={`/replay/${gameId}`}
                className="flex-1 py-2.5 border border-border text-text-secondary font-medium rounded-xl hover:border-border-hover hover:text-text transition-colors text-center flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Повтор
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
