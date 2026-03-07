'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  createInitialGameState,
  getValidMovesForPiece,
  getValidMoves,
  applyMove,
  isValidMove,
  BOARD_SIZE,
  type GameState,
  type Position,
  type Move,
  type PieceColor,
} from '@checkers/shared'
import { CheckersPiece } from './checkers-piece'

interface CheckersBoardProps {
  gameId: string
  playerColor?: PieceColor
  localMode?: boolean // both players on same device
}

export function CheckersBoard({ gameId, playerColor = 'white', localMode = false }: CheckersBoardProps) {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState)
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null)
  const [validMoves, setValidMoves] = useState<Move[]>([])
  const [lastMove, setLastMove] = useState<{ from: Position; to: Position } | null>(null)

  // In local mode, both colors are playable
  const activeColor = localMode ? gameState.currentTurn : playerColor
  const isMyTurn = localMode ? true : gameState.currentTurn === playerColor
  const isGameOver = gameState.status !== 'playing' && gameState.status !== 'waiting'

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
        // Apply move locally (optimistic)
        const newState = applyMove(gameState, move)
        setGameState(newState)
        setLastMove({ from: move.from, to: move.to })
        setSelectedPiece(null)
        setValidMoves([])

        // TODO: Send to server via API/WS
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
  }, [gameState, selectedPiece, validMoves, isMyTurn, isGameOver, playerColor])

  const isValidTarget = (row: number, col: number) =>
    validMoves.some(m => m.to.row === row && m.to.col === col)

  const isSelected = (row: number, col: number) =>
    selectedPiece?.row === row && selectedPiece?.col === col

  const isLastMoveCell = (row: number, col: number) =>
    lastMove && ((lastMove.from.row === row && lastMove.from.col === col) ||
                 (lastMove.to.row === row && lastMove.to.col === col))

  // Flip board for white player (white plays from bottom)
  const rows = playerColor === 'white'
    ? Array.from({ length: BOARD_SIZE }, (_, i) => i)
    : Array.from({ length: BOARD_SIZE }, (_, i) => BOARD_SIZE - 1 - i)

  const cols = playerColor === 'white'
    ? Array.from({ length: BOARD_SIZE }, (_, i) => i)
    : Array.from({ length: BOARD_SIZE }, (_, i) => BOARD_SIZE - 1 - i)

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Game status */}
      <div className="text-center">
        {isGameOver ? (
          <div className="text-lg font-semibold">
            {gameState.status === 'black_wins' && (playerColor === 'black' ? 'You won!' : 'You lost')}
            {gameState.status === 'white_wins' && (playerColor === 'white' ? 'You won!' : 'You lost')}
            {gameState.status === 'draw' && 'Draw!'}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <div className={`w-3 h-3 rounded-full ${isMyTurn ? 'bg-success animate-pulse' : 'bg-text-muted'}`} />
            {isMyTurn ? 'Your turn' : "Opponent's turn"}
          </div>
        )}
      </div>

      {/* Piece counts */}
      <div className="flex items-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-piece-black rounded-full border border-border" />
          <span className="font-medium">{gameState.blackPieces}</span>
        </div>
        <span className="text-text-muted">vs</span>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-piece-white rounded-full border border-border" />
          <span className="font-medium">{gameState.whitePieces}</span>
        </div>
      </div>

      {/* Board */}
      <div className="rounded-xl overflow-hidden shadow-lg border-2 border-board-dark/30">
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
                    ${isDark ? 'bg-board-dark' : 'bg-board-light'}
                    ${selected ? 'ring-2 ring-inset ring-accent' : ''}
                    ${wasLastMove && isDark ? 'bg-amber-600/80' : ''}
                    ${wasLastMove && !isDark ? 'bg-amber-200' : ''}
                  `}
                >
                  {/* Valid move indicator */}
                  {validTarget && !piece && (
                    <div className="absolute w-4 h-4 bg-success/50 rounded-full" />
                  )}

                  {/* Valid capture indicator */}
                  {validTarget && piece && (
                    <div className="absolute inset-1 rounded-full border-3 border-danger/60" />
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

      {/* Move count */}
      <div className="text-xs text-text-muted">
        Move {gameState.moveCount}
      </div>
    </div>
  )
}
