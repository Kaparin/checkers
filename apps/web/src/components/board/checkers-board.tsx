'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { playMoveSound, playCaptureSound, playKingSound } from '@/lib/sounds'
import { useBoardTheme } from '@/hooks/use-board-theme'
import {
  createInitialGameState,
  getValidMovesForPiece,
  applyMove,
  BOARD_SIZE,
  type GameState,
  type GameVariant,
  type Position,
  type Move,
  type PieceColor,
} from '@checkers/shared'
import { CheckersPiece } from './checkers-piece'

interface CheckersBoardProps {
  gameId: string
  playerColor?: PieceColor
  localMode?: boolean
  variant?: GameVariant
  externalState?: GameState
  onMove?: (from: Position, to: Position) => void
}

export function CheckersBoard({
  gameId,
  playerColor = 'white',
  localMode = false,
  variant = 'russian',
  externalState,
  onMove,
}: CheckersBoardProps) {
  const { theme } = useBoardTheme()
  const [internalState, setInternalState] = useState<GameState>(() => createInitialGameState(variant))
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null)
  const [validMoves, setValidMoves] = useState<Move[]>([])
  const [lastMove, setLastMove] = useState<{ from: Position; to: Position } | null>(null)

  // Use external state if provided, otherwise internal
  const gameState = externalState ?? internalState
  const setGameState = externalState ? () => {} : setInternalState

  const activeColor = localMode ? gameState.currentTurn : playerColor
  const isMyTurn = localMode ? true : gameState.currentTurn === playerColor
  const isGameOver = gameState.status !== 'playing' && gameState.status !== 'waiting'

  // Reset board when variant changes (local mode)
  useEffect(() => {
    if (localMode && !externalState) {
      setInternalState(createInitialGameState(variant))
      setSelectedPiece(null)
      setValidMoves([])
      setLastMove(null)
    }
  }, [variant, localMode, externalState])

  // Clear selection when turn changes (opponent moved)
  useEffect(() => {
    setSelectedPiece(null)
    setValidMoves([])
  }, [gameState.currentTurn])

  // Update valid moves when selection changes
  useEffect(() => {
    if (selectedPiece && isMyTurn) {
      const moves = getValidMovesForPiece(gameState, selectedPiece)
      setValidMoves(moves)
    } else {
      setValidMoves([])
    }
  }, [selectedPiece, gameState, isMyTurn])

  const handleCellClick = useCallback((row: number, col: number) => {
    if (isGameOver || !isMyTurn) return

    const piece = gameState.board[row][col]

    // If clicking on a valid move destination
    if (selectedPiece) {
      const move = validMoves.find(m => m.to.row === row && m.to.col === col)
      if (move) {
        // Sound effects
        if (move.captures.length > 0) {
          playCaptureSound()
        } else {
          playMoveSound()
        }
        if (move.promotion) {
          setTimeout(playKingSound, 200)
        }

        if (localMode) {
          const newState = applyMove(gameState, move)
          setGameState(newState)
        }

        if (onMove) {
          onMove(move.from, move.to)
        }

        setLastMove({ from: move.from, to: move.to })
        setSelectedPiece(null)
        setValidMoves([])
        return
      }
    }

    // If clicking on own piece, select it
    if (piece && piece.color === activeColor) {
      const moves = getValidMovesForPiece(gameState, { row, col })
      if (moves.length > 0) {
        setSelectedPiece({ row, col })
      } else {
        setSelectedPiece(null)
      }
      return
    }

    // Deselect
    setSelectedPiece(null)
  }, [gameState, selectedPiece, validMoves, isMyTurn, isGameOver, activeColor, localMode, onMove, setGameState])

  const isValidTarget = (row: number, col: number) =>
    validMoves.some(m => m.to.row === row && m.to.col === col)

  const isSelected = (row: number, col: number) =>
    selectedPiece?.row === row && selectedPiece?.col === col

  const isLastMoveCell = (row: number, col: number) =>
    lastMove && ((lastMove.from.row === row && lastMove.from.col === col) ||
                 (lastMove.to.row === row && lastMove.to.col === col))

  // Board orientation: row 0 at top for black, row 7 at top for white
  const rows = playerColor === 'white' && !localMode
    ? Array.from({ length: BOARD_SIZE }, (_, i) => i)
    : localMode
      ? Array.from({ length: BOARD_SIZE }, (_, i) => i)
      : Array.from({ length: BOARD_SIZE }, (_, i) => BOARD_SIZE - 1 - i)

  const cols = playerColor === 'white' && !localMode
    ? Array.from({ length: BOARD_SIZE }, (_, i) => i)
    : localMode
      ? Array.from({ length: BOARD_SIZE }, (_, i) => i)
      : Array.from({ length: BOARD_SIZE }, (_, i) => BOARD_SIZE - 1 - i)

  // Captured pieces
  const blackCaptured = 12 - gameState.blackPieces
  const whiteCaptured = 12 - gameState.whitePieces

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Game status */}
      {!externalState && (
        <div className="text-center">
          {isGameOver ? (
            <div className="px-4 py-2 rounded-xl bg-bg-card border border-border">
              <span className="text-lg font-semibold">
                {gameState.status === 'black_wins' && 'Black wins!'}
                {gameState.status === 'white_wins' && 'White wins!'}
                {gameState.status === 'draw' && 'Draw!'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <div className={`w-3 h-3 rounded-full ${
                gameState.currentTurn === 'black' ? 'bg-piece-black' : 'bg-piece-white border border-border'
              }`} />
              <span className="font-medium">
                {localMode
                  ? `${gameState.currentTurn === 'black' ? 'Black' : 'White'}'s turn`
                  : isMyTurn ? 'Your turn' : "Opponent's turn"
                }
              </span>
            </div>
          )}
        </div>
      )}

      {/* Captured pieces (top = opponent's captured) */}
      <CapturedPieces color="black" count={blackCaptured} />

      {/* Board */}
      <div className="rounded-xl overflow-hidden shadow-lg border-2 border-board-dark/30 select-none">
        {rows.map((row) => (
          <div key={row} className="flex">
            {cols.map((col) => {
              const isDark = (row + col) % 2 === 1
              const piece = gameState.board[row][col]
              const selected = isSelected(row, col)
              const validTarget = isValidTarget(row, col)
              const wasLastMove = isLastMoveCell(row, col)

              return (
                <div
                  key={`${row}-${col}`}
                  onClick={() => handleCellClick(row, col)}
                  className={`
                    relative w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px]
                    flex items-center justify-center
                    transition-colors cursor-pointer
                    ${selected ? 'ring-2 ring-inset ring-accent' : ''}
                  `}
                  style={{
                    backgroundColor: wasLastMove
                      ? theme.highlightFrom
                      : isDark ? theme.dark : theme.light,
                  }}
                >
                  {/* Valid move dot */}
                  {validTarget && !piece && (
                    <div className="absolute w-4 h-4 bg-success/50 rounded-full" />
                  )}

                  {/* Valid capture ring */}
                  {validTarget && piece && (
                    <div className="absolute inset-1.5 rounded-full border-[3px] border-danger/60" />
                  )}

                  {/* Piece */}
                  <AnimatePresence mode="popLayout">
                    {piece && (
                      <CheckersPiece
                        key={`${row}-${col}-${piece.color}-${piece.type}`}
                        color={piece.color}
                        type={piece.type}
                        isSelected={selected}
                        isClickable={piece.color === activeColor && isMyTurn}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Captured pieces (bottom = my captured) */}
      <CapturedPieces color="white" count={whiteCaptured} />

      {/* Move counter */}
      {localMode && (
        <span className="text-xs text-text-muted">
          Move {gameState.moveCount} &middot; {gameState.variant === 'russian' ? 'Russian' : 'American'} (local)
        </span>
      )}
    </div>
  )
}

function CapturedPieces({ color, count }: { color: PieceColor; count: number }) {
  if (count === 0) return <div className="h-6" />
  return (
    <div className="flex gap-1 h-6 items-center">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`w-5 h-5 rounded-full ${
            color === 'black'
              ? 'bg-piece-black/70'
              : 'bg-piece-white/70 border border-border/50'
          }`}
          style={{ marginLeft: i > 0 ? -6 : 0 }}
        />
      ))}
      <span className="text-xs text-text-muted ml-1">x{count}</span>
    </div>
  )
}
