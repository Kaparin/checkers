/**
 * Russian Checkers (Русские шашки) engine
 *
 * Differences from American/English checkers:
 * 1. Regular pieces (men) can capture backwards
 * 2. Kings are "flying" — move/capture any number of squares diagonally
 * 3. If a man reaches promotion row during a multi-capture, it becomes a king
 *    and continues capturing as a king
 * 4. Captured pieces are removed after the entire capture chain completes
 *    (a piece cannot be jumped twice in one chain)
 * 5. Must take the longest capture chain (mandatory maximum capture)
 */

import type { Board, Piece, PieceColor, PieceType, Position, Move, GameState, SerializedMove } from './engine'
import { BOARD_SIZE, createInitialBoard, cloneBoard, inBounds, opponent, isPromotionRow } from './common'

// ── Move generation (Russian rules) ─────────────────────────────────

const ALL_DIRS = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
  { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
]

/**
 * Find all capture sequences for a piece (Russian rules).
 * - Men capture in all 4 diagonal directions (forward + backward)
 * - Kings "fly": look along diagonal for an enemy, then land on any empty square beyond
 * - Captured pieces stay on board during chain (tracked via alreadyCaptured set)
 * - Promotion mid-chain: man becomes king and continues as king
 */
function findCaptures(
  board: Board,
  pos: Position,
  piece: Piece,
  alreadyCaptured: Set<string>,
): Move[] {
  const results: Move[] = []

  if (piece.type === 'king') {
    // Flying king capture: scan along each diagonal
    for (const { dr, dc } of ALL_DIRS) {
      let r = pos.row + dr
      let c = pos.col + dc

      // Scan until we hit an enemy piece
      while (inBounds(r, c) && board[r][c] === null) {
        r += dr
        c += dc
      }

      // Check if we found an enemy piece to capture
      if (!inBounds(r, c)) continue
      const midPiece = board[r][c]
      if (!midPiece || midPiece.color === piece.color) continue

      const midKey = `${r},${c}`
      if (alreadyCaptured.has(midKey)) continue

      const midRow = r
      const midCol = c

      // Land on any empty square beyond the captured piece
      r += dr
      c += dc
      while (inBounds(r, c) && (board[r][c] === null || alreadyCaptured.has(`${r},${c}`))) {
        // Can only land on truly empty squares (not on captured-but-not-removed pieces)
        if (board[r][c] !== null && !alreadyCaptured.has(`${r},${c}`)) {
          r += dr
          c += dc
          continue
        }
        // But also skip if there's a real piece here (not captured)
        if (board[r][c] !== null) {
          r += dr
          c += dc
          continue
        }

        const landPos = { row: r, col: c }
        const newCaptured = new Set(alreadyCaptured)
        newCaptured.add(midKey)

        // Continue capturing from landing position
        const continuations = findCaptures(board, landPos, piece, newCaptured)

        if (continuations.length > 0) {
          for (const cont of continuations) {
            results.push({
              from: pos,
              to: cont.to,
              captures: [{ row: midRow, col: midCol }, ...cont.captures],
              path: [landPos, ...cont.path],
              promotion: false, // kings don't promote
            })
          }
        } else {
          results.push({
            from: pos,
            to: landPos,
            captures: [{ row: midRow, col: midCol }],
            path: [landPos],
            promotion: false,
          })
        }

        r += dr
        c += dc
      }
    }
  } else {
    // Man capture: all 4 directions (Russian rules: men capture backwards too)
    for (const { dr, dc } of ALL_DIRS) {
      const midRow = pos.row + dr
      const midCol = pos.col + dc
      const landRow = pos.row + 2 * dr
      const landCol = pos.col + 2 * dc

      if (!inBounds(landRow, landCol)) continue

      const midKey = `${midRow},${midCol}`
      if (alreadyCaptured.has(midKey)) continue

      const midPiece = board[midRow][midCol]
      const landCell = board[landRow][landCol]

      if (!midPiece || midPiece.color === piece.color) continue
      // Landing square must be empty (or be the starting position for looping captures)
      if (landCell !== null && !(landRow === pos.row && landCol === pos.col)) continue

      const landPos = { row: landRow, col: landCol }
      const newCaptured = new Set(alreadyCaptured)
      newCaptured.add(midKey)

      // Check for promotion mid-chain (Russian rule!)
      const promoted = isPromotionRow(landRow, piece.color)
      const pieceAfterMove = promoted
        ? { color: piece.color, type: 'king' as PieceType }
        : piece

      // Continue capturing (as king if promoted)
      const continuations = findCaptures(board, landPos, pieceAfterMove, newCaptured)

      if (continuations.length > 0) {
        for (const cont of continuations) {
          results.push({
            from: pos,
            to: cont.to,
            captures: [{ row: midRow, col: midCol }, ...cont.captures],
            path: [landPos, ...cont.path],
            promotion: cont.promotion || promoted,
          })
        }
      } else {
        results.push({
          from: pos,
          to: landPos,
          captures: [{ row: midRow, col: midCol }],
          path: [landPos],
          promotion: promoted,
        })
      }
    }
  }

  return results
}

/** Get simple (non-capture) moves for a piece (Russian rules) */
function getSimpleMoves(board: Board, pos: Position, piece: Piece): Move[] {
  const moves: Move[] = []

  if (piece.type === 'king') {
    // Flying king: move any number of squares diagonally
    for (const { dr, dc } of ALL_DIRS) {
      let r = pos.row + dr
      let c = pos.col + dc
      while (inBounds(r, c) && board[r][c] === null) {
        moves.push({
          from: pos,
          to: { row: r, col: c },
          captures: [],
          path: [{ row: r, col: c }],
          promotion: false,
        })
        r += dr
        c += dc
      }
    }
  } else {
    // Man: move one square diagonally forward
    const dr = piece.color === 'black' ? 1 : -1
    for (const dc of [-1, 1]) {
      const newRow = pos.row + dr
      const newCol = pos.col + dc
      if (!inBounds(newRow, newCol)) continue
      if (board[newRow][newCol] !== null) continue

      const promoted = isPromotionRow(newRow, piece.color)
      moves.push({
        from: pos,
        to: { row: newRow, col: newCol },
        captures: [],
        path: [{ row: newRow, col: newCol }],
        promotion: promoted,
      })
    }
  }

  return moves
}

// ── Public API (same interface as American engine) ──────────────────

export function getValidMovesRussian(state: GameState): Move[] {
  const { board, currentTurn } = state
  const allCaptures: Move[] = []
  const allSimple: Move[] = []

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col]
      if (!piece || piece.color !== currentTurn) continue

      const pos = { row, col }
      const captures = findCaptures(board, pos, piece, new Set())
      allCaptures.push(...captures)

      if (allCaptures.length === 0) {
        allSimple.push(...getSimpleMoves(board, pos, piece))
      }
    }
  }

  // Mandatory capture: must take the longest chain
  if (allCaptures.length > 0) {
    const maxCaptures = Math.max(...allCaptures.map(m => m.captures.length))
    return allCaptures.filter(m => m.captures.length === maxCaptures)
  }

  return allSimple
}

export function getValidMovesForPieceRussian(state: GameState, pos: Position): Move[] {
  const allMoves = getValidMovesRussian(state)
  return allMoves.filter(m => m.from.row === pos.row && m.from.col === pos.col)
}

export function applyMoveRussian(state: GameState, move: Move): GameState {
  const board = cloneBoard(state.board)
  const piece = board[move.from.row][move.from.col]

  if (!piece) throw new Error('No piece at source position')
  if (piece.color !== state.currentTurn) throw new Error('Not your turn')

  // Move piece
  board[move.from.row][move.from.col] = null

  // Remove captured pieces (all at once after chain)
  for (const cap of move.captures) {
    board[cap.row][cap.col] = null
  }

  // Place piece at destination
  board[move.to.row][move.to.col] = {
    color: piece.color,
    type: move.promotion ? 'king' : piece.type,
  }

  // Count pieces
  let blackPieces = 0
  let whitePieces = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c]
      if (p?.color === 'black') blackPieces++
      if (p?.color === 'white') whitePieces++
    }
  }

  const nextTurn = opponent(state.currentTurn)
  const now = Date.now()

  const serializedMove: SerializedMove = {
    from: [move.from.row, move.from.col],
    to: [move.to.row, move.to.col],
    captures: move.captures.map(c => [c.row, c.col]),
    promotion: move.promotion,
    timestamp: now,
  }

  const newState: GameState = {
    ...state,
    board,
    currentTurn: nextTurn,
    status: 'playing',
    moveHistory: [...state.moveHistory, serializedMove],
    moveCount: state.moveCount + 1,
    blackPieces,
    whitePieces,
    lastMoveTimestamp: now,
  }

  // Win conditions
  if (blackPieces === 0) {
    newState.status = 'white_wins'
  } else if (whitePieces === 0) {
    newState.status = 'black_wins'
  } else {
    const nextMoves = getValidMovesRussian(newState)
    if (nextMoves.length === 0) {
      newState.status = state.currentTurn === 'black' ? 'black_wins' : 'white_wins'
    }
  }

  return newState
}

export function isValidMoveRussian(state: GameState, from: Position, to: Position): Move | null {
  const validMoves = getValidMovesRussian(state)
  return validMoves.find(
    m => m.from.row === from.row && m.from.col === from.col &&
         m.to.row === to.row && m.to.col === to.col
  ) || null
}
