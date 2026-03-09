'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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

  // Multi-capture animation state
  const [animating, setAnimating] = useState(false)
  const [animPiece, setAnimPiece] = useState<{ pos: Position; color: PieceColor; type: 'man' | 'king' } | null>(null)
  const [fadingCaptures, setFadingCaptures] = useState<Set<string>>(new Set())

  // Touch drag state
  const boardRef = useRef<HTMLDivElement>(null)
  const [dragPiece, setDragPiece] = useState<Position | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [dragTarget, setDragTarget] = useState<Position | null>(null)

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
    if (selectedPiece && isMyTurn && !animating) {
      const moves = getValidMovesForPiece(gameState, selectedPiece)
      setValidMoves(moves)
    } else {
      setValidMoves([])
    }
  }, [selectedPiece, gameState, isMyTurn, animating])

  // Animate multi-capture step by step
  const animateMultiCapture = useCallback(async (move: Move) => {
    if (!move.path || move.path.length <= 1 || move.captures.length <= 1) return false

    const piece = gameState.board[move.from.row][move.from.col]
    if (!piece) return false

    setAnimating(true)
    setSelectedPiece(null)
    setValidMoves([])

    const steps = move.path
    const captures = move.captures
    const fading = new Set<string>()

    // Set up the animating piece at the start position
    setAnimPiece({ pos: move.from, color: piece.color, type: piece.type })

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]

      // Move the piece to this step
      setAnimPiece(prev => prev ? { ...prev, pos: step } : null)
      playCaptureSound()

      // Find which capture corresponds to this step
      if (i < captures.length) {
        const capKey = `${captures[i].row}-${captures[i].col}`
        fading.add(capKey)
        setFadingCaptures(new Set(fading))
      }

      // Wait for animation
      await new Promise(r => setTimeout(r, 280))
    }

    // Cleanup animation state
    setAnimPiece(null)
    setFadingCaptures(new Set())
    setAnimating(false)

    return true
  }, [gameState])

  const executeMove = useCallback(async (move: Move) => {
    // Try multi-capture animation
    const isMulti = move.path && move.path.length > 1 && move.captures.length > 1
    if (isMulti) {
      await animateMultiCapture(move)
    } else {
      // Simple move or single capture
      if (move.captures.length > 0) {
        playCaptureSound()
      } else {
        playMoveSound()
      }
    }

    if (move.promotion) {
      setTimeout(playKingSound, 150)
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
  }, [gameState, localMode, onMove, setGameState, animateMultiCapture])

  const handleCellClick = useCallback((row: number, col: number) => {
    if (isGameOver || !isMyTurn || animating) return

    const piece = gameState.board[row][col]

    // If clicking on a valid move destination
    if (selectedPiece) {
      const move = validMoves.find(m => m.to.row === row && m.to.col === col)
      if (move) {
        executeMove(move)
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
  }, [gameState, selectedPiece, validMoves, isMyTurn, isGameOver, activeColor, executeMove, animating])

  // Board orientation
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

  // Convert screen position to board cell
  const getCellFromPoint = useCallback((clientX: number, clientY: number): Position | null => {
    if (!boardRef.current) return null
    const rect = boardRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null
    const cellSize = rect.width / BOARD_SIZE
    const colIdx = Math.floor(x / cellSize)
    const rowIdx = Math.floor(y / cellSize)
    if (colIdx < 0 || colIdx >= BOARD_SIZE || rowIdx < 0 || rowIdx >= BOARD_SIZE) return null
    return { row: rows[rowIdx], col: cols[colIdx] }
  }, [rows, cols])

  // Touch handlers for drag-and-drop
  const handleTouchStart = useCallback((e: React.TouchEvent, row: number, col: number) => {
    if (isGameOver || !isMyTurn || animating) return
    const piece = gameState.board[row][col]
    if (!piece || piece.color !== activeColor) return
    const moves = getValidMovesForPiece(gameState, { row, col })
    if (moves.length === 0) return

    e.preventDefault()
    setSelectedPiece({ row, col })
    setDragPiece({ row, col })
    const touch = e.touches[0]
    setDragPos({ x: touch.clientX, y: touch.clientY })
  }, [gameState, isGameOver, isMyTurn, activeColor, animating])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragPiece) return
    e.preventDefault()
    const touch = e.touches[0]
    setDragPos({ x: touch.clientX, y: touch.clientY })
    const target = getCellFromPoint(touch.clientX, touch.clientY)
    setDragTarget(target)
  }, [dragPiece, getCellFromPoint])

  const handleTouchEnd = useCallback(() => {
    if (!dragPiece) return

    if (dragTarget) {
      const moves = getValidMovesForPiece(gameState, dragPiece)
      const move = moves.find(m => m.to.row === dragTarget.row && m.to.col === dragTarget.col)
      if (move) {
        executeMove(move)
      }
    }

    setDragPiece(null)
    setDragPos(null)
    setDragTarget(null)
  }, [dragPiece, dragTarget, gameState, executeMove])

  const isValidTarget = (row: number, col: number) =>
    validMoves.some(m => m.to.row === row && m.to.col === col)

  const isSelected = (row: number, col: number) =>
    selectedPiece?.row === row && selectedPiece?.col === col

  const isLastMoveCell = (row: number, col: number) =>
    lastMove && ((lastMove.from.row === row && lastMove.from.col === col) ||
                 (lastMove.to.row === row && lastMove.to.col === col))

  const isDragOver = (row: number, col: number) =>
    dragTarget?.row === row && dragTarget?.col === col

  const isFading = (row: number, col: number) =>
    fadingCaptures.has(`${row}-${col}`)

  const isAnimPieceAt = (row: number, col: number) =>
    animPiece?.pos.row === row && animPiece?.pos.col === col

  // Captured pieces
  const blackCaptured = 12 - gameState.blackPieces
  const whiteCaptured = 12 - gameState.whitePieces

  // Column labels
  const colLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Game status for local mode */}
      {!externalState && (
        <div className="text-center">
          {isGameOver ? (
            <div className="px-5 py-2.5 rounded-xl bg-bg-card border border-border">
              <span className="text-lg font-bold">
                {gameState.status === 'black_wins' && 'Чёрные победили!'}
                {gameState.status === 'white_wins' && 'Белые победили!'}
                {gameState.status === 'draw' && 'Ничья!'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-sm text-text-secondary">
              <div className={`w-3.5 h-3.5 rounded-full shadow-sm ${
                gameState.currentTurn === 'black' ? 'bg-piece-black border border-[#333]' : 'bg-piece-white'
              }`} />
              <span className="font-medium">
                {localMode
                  ? `Ход ${gameState.currentTurn === 'black' ? 'чёрных' : 'белых'}`
                  : isMyTurn ? 'Ваш ход' : 'Ход соперника'
                }
              </span>
            </div>
          )}
        </div>
      )}

      {/* Captured pieces (top = opponent's captured) */}
      <CapturedPieces color="black" count={blackCaptured} />

      {/* Board with frame */}
      <div className="w-full max-w-[640px] relative">
        {/* Wooden frame */}
        <div className="rounded-2xl p-1 sm:p-1.5" style={{
          background: 'linear-gradient(145deg, #6b4423, #4a2e14, #3d2510)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          {/* Column labels top */}
          <div className="flex px-0.5">
            {cols.map((col, i) => (
              <div key={`top-${i}`} className="flex-1 text-center text-[9px] sm:text-[10px] font-medium text-amber-200/40 pb-0.5 select-none">
                {colLabels[col]}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Row labels left */}
            <div className="flex flex-col">
              {rows.map((row, i) => (
                <div key={`left-${i}`} className="flex-1 flex items-center justify-center text-[9px] sm:text-[10px] font-medium text-amber-200/40 px-0.5 select-none">
                  {8 - row}
                </div>
              ))}
            </div>

            {/* Board grid */}
            <div
              ref={boardRef}
              className="flex-1 aspect-square rounded-sm overflow-hidden select-none touch-none"
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
                {rows.map((row, rowIdx) =>
                  cols.map((col, colIdx) => {
                    const isDark = (row + col) % 2 === 1
                    const piece = gameState.board[row][col]
                    const selected = isSelected(row, col)
                    const validTarget = isValidTarget(row, col)
                    const wasLastMove = isLastMoveCell(row, col)
                    const isDragging = dragPiece?.row === row && dragPiece?.col === col
                    const isDropTarget = isDragOver(row, col) && validTarget
                    const fading = isFading(row, col)
                    const showAnimPiece = isAnimPieceAt(row, col)

                    return (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        onClick={() => handleCellClick(row, col)}
                        onTouchStart={(e) => handleTouchStart(e, row, col)}
                        className={`
                          relative flex items-center justify-center
                          transition-colors duration-150
                          ${isDark ? 'cursor-pointer' : ''}
                          ${selected ? 'ring-2 ring-inset ring-accent' : ''}
                          ${isDropTarget ? 'ring-2 ring-inset ring-success' : ''}
                        `}
                        style={{
                          backgroundColor: wasLastMove && isDark
                            ? theme.highlightFrom
                            : isDark ? theme.dark : theme.light,
                        }}
                      >
                        {/* Valid move dot */}
                        {validTarget && !piece && !isDropTarget && (
                          <div className="absolute w-[28%] h-[28%] bg-success/50 rounded-full shadow-sm" />
                        )}
                        {/* Drop target highlight */}
                        {isDropTarget && !piece && (
                          <div className="absolute w-[40%] h-[40%] bg-success/60 rounded-full" />
                        )}

                        {/* Valid capture ring */}
                        {validTarget && piece && !fading && (
                          <div className="absolute inset-[6%] rounded-full border-[3px] border-danger/70" />
                        )}

                        {/* Piece */}
                        <AnimatePresence mode="popLayout">
                          {piece && !fading && !(animating && isDragging) && (
                            <CheckersPiece
                              key={`${row}-${col}-${piece.color}-${piece.type}`}
                              color={piece.color}
                              type={piece.type}
                              isSelected={selected}
                              isClickable={piece.color === activeColor && isMyTurn && !animating}
                              isDragging={isDragging}
                            />
                          )}
                        </AnimatePresence>

                        {/* Fading captured piece */}
                        {piece && fading && (
                          <motion.div
                            initial={{ opacity: 1, scale: 1 }}
                            animate={{ opacity: 0, scale: 0.3 }}
                            transition={{ duration: 0.25 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <CheckersPiece
                              color={piece.color}
                              type={piece.type}
                              isSelected={false}
                              isClickable={false}
                            />
                          </motion.div>
                        )}

                        {/* Animated piece during multi-capture */}
                        {showAnimPiece && animPiece && (
                          <motion.div
                            key={`anim-${animPiece.pos.row}-${animPiece.pos.col}`}
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute inset-0 flex items-center justify-center z-20"
                          >
                            <CheckersPiece
                              color={animPiece.color}
                              type={animPiece.type}
                              isSelected
                              isClickable={false}
                            />
                          </motion.div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Row labels right */}
            <div className="flex flex-col">
              {rows.map((row, i) => (
                <div key={`right-${i}`} className="flex-1 flex items-center justify-center text-[9px] sm:text-[10px] font-medium text-amber-200/40 px-0.5 select-none">
                  {8 - row}
                </div>
              ))}
            </div>
          </div>

          {/* Column labels bottom */}
          <div className="flex px-0.5">
            {cols.map((col, i) => (
              <div key={`bot-${i}`} className="flex-1 text-center text-[9px] sm:text-[10px] font-medium text-amber-200/40 pt-0.5 select-none">
                {colLabels[col]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drag ghost */}
      {dragPiece && dragPos && (() => {
        const piece = gameState.board[dragPiece.row][dragPiece.col]
        if (!piece) return null
        return (
          <div
            className="fixed pointer-events-none z-50"
            style={{
              left: dragPos.x - 30,
              top: dragPos.y - 60,
              width: 60,
              height: 60,
            }}
          >
            <CheckersPiece
              color={piece.color}
              type={piece.type}
              isSelected
              isClickable={false}
              isDragging={false}
            />
          </div>
        )
      })()}

      {/* Captured pieces (bottom = my captured) */}
      <CapturedPieces color="white" count={whiteCaptured} />

      {/* Move counter */}
      {localMode && (
        <span className="text-xs text-text-muted">
          Ход {gameState.moveCount} &middot; {gameState.variant === 'russian' ? 'Русские' : 'Американские'} шашки
        </span>
      )}
    </div>
  )
}

function CapturedPieces({ color, count }: { color: PieceColor; count: number }) {
  if (count === 0) return <div className="h-5" />
  return (
    <div className="flex gap-0.5 h-5 items-center">
      {Array.from({ length: Math.min(count, 12) }, (_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full ${
            color === 'black'
              ? 'bg-piece-black/60 border border-[#333]/40'
              : 'bg-piece-white/60 border border-[#999]/30'
          }`}
          style={{ marginLeft: i > 0 ? -4 : 0 }}
        />
      ))}
      <span className="text-[10px] text-text-muted ml-1.5">x{count}</span>
    </div>
  )
}
