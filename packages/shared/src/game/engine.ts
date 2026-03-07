/**
 * Checkers game engine
 *
 * Standard (American/English) checkers rules:
 * - 8x8 board, pieces on dark squares only
 * - 12 pieces per side (black / white)
 * - Pieces move diagonally forward one square
 * - Kings move diagonally forward or backward
 * - Captures are mandatory
 * - Multi-jump captures in a single turn
 * - King promotion when reaching the last row
 * - Win by capturing all opponent pieces or blocking all moves
 */

// ── Types ────────────────────────────────────────────────────────────

export type PieceColor = 'black' | 'white'
export type PieceType = 'man' | 'king'

export interface Piece {
  color: PieceColor
  type: PieceType
}

/** Board cell: null = empty, Piece = occupied */
export type Cell = Piece | null

/** 8x8 board. board[row][col]. Row 0 = top (black's side), Row 7 = bottom (white's side) */
export type Board = Cell[][]

export interface Position {
  row: number
  col: number
}

export interface Move {
  from: Position
  to: Position
  captures: Position[] // positions of captured pieces (can be multiple for multi-jump)
  path: Position[]     // full path including intermediate landing squares
  promotion: boolean   // whether the piece gets promoted
}

export type GameStatus = 'waiting' | 'playing' | 'black_wins' | 'white_wins' | 'draw'

export interface GameState {
  board: Board
  currentTurn: PieceColor
  status: GameStatus
  moveHistory: SerializedMove[]
  moveCount: number
  blackPieces: number
  whitePieces: number
  lastMoveTimestamp: number | null
}

export interface SerializedMove {
  from: [number, number]
  to: [number, number]
  captures: [number, number][]
  promotion: boolean
  timestamp: number
}

// ── Constants ────────────────────────────────────────────────────────

export const BOARD_SIZE = 8
export const PIECES_PER_SIDE = 12
export const ROWS_WITH_PIECES = 3

// ── Board creation ───────────────────────────────────────────────────

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  )

  for (let row = 0; row < ROWS_WITH_PIECES; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      // Pieces go on dark squares only (row + col is odd)
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: 'black', type: 'man' }
      }
    }
  }

  for (let row = BOARD_SIZE - ROWS_WITH_PIECES; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: 'white', type: 'man' }
      }
    }
  }

  return board
}

export function createInitialGameState(): GameState {
  const board = createInitialBoard()
  return {
    board,
    currentTurn: 'black',
    status: 'playing',
    moveHistory: [],
    moveCount: 0,
    blackPieces: PIECES_PER_SIDE,
    whitePieces: PIECES_PER_SIDE,
    lastMoveTimestamp: null,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

function opponent(color: PieceColor): PieceColor {
  return color === 'black' ? 'white' : 'black'
}

function isPromotionRow(row: number, color: PieceColor): boolean {
  return color === 'black' ? row === BOARD_SIZE - 1 : row === 0
}

function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

// ── Move generation ──────────────────────────────────────────────────

/** Get forward directions for a piece (kings can go both ways) */
function getDirections(piece: Piece): { dr: number; dc: number }[] {
  if (piece.type === 'king') {
    return [
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
      { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
    ]
  }
  // Men: black moves down (+row), white moves up (-row)
  const dr = piece.color === 'black' ? 1 : -1
  return [{ dr, dc: -1 }, { dr, dc: 1 }]
}

/** Find all capture sequences starting from a position */
function findCaptures(
  board: Board,
  pos: Position,
  piece: Piece,
  alreadyCaptured: Set<string>,
): Move[] {
  const directions = piece.type === 'king'
    ? [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }]
    : getDirections(piece)

  const results: Move[] = []

  for (const { dr, dc } of directions) {
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
    if (landCell !== null && !(landRow === pos.row && landCol === pos.col)) continue

    // Valid capture — check for chain captures
    const newCaptured = new Set(alreadyCaptured)
    newCaptured.add(midKey)

    const landPos = { row: landRow, col: landCol }
    const promoted = !piece.type.startsWith('k') && isPromotionRow(landRow, piece.color)
    const pieceAfterMove = promoted ? { ...piece, type: 'king' as PieceType } : piece

    // Try to continue capturing from the landing position
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

  return results
}

/** Get all simple (non-capture) moves for a piece at given position */
function getSimpleMoves(board: Board, pos: Position, piece: Piece): Move[] {
  const moves: Move[] = []
  const directions = getDirections(piece)

  for (const { dr, dc } of directions) {
    const newRow = pos.row + dr
    const newCol = pos.col + dc
    if (!inBounds(newRow, newCol)) continue
    if (board[newRow][newCol] !== null) continue

    const promoted = piece.type === 'man' && isPromotionRow(newRow, piece.color)
    moves.push({
      from: pos,
      to: { row: newRow, col: newCol },
      captures: [],
      path: [{ row: newRow, col: newCol }],
      promotion: promoted,
    })
  }

  return moves
}

// ── Public API ───────────────────────────────────────────────────────

/** Get all valid moves for the current player. Captures are mandatory. */
export function getValidMoves(state: GameState): Move[] {
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

  // Mandatory capture rule: if any captures exist, must capture
  // Additionally, must take the longest capture chain
  if (allCaptures.length > 0) {
    const maxCaptures = Math.max(...allCaptures.map(m => m.captures.length))
    return allCaptures.filter(m => m.captures.length === maxCaptures)
  }

  return allSimple
}

/** Get valid moves for a specific piece */
export function getValidMovesForPiece(state: GameState, pos: Position): Move[] {
  const allMoves = getValidMoves(state)
  return allMoves.filter(m => m.from.row === pos.row && m.from.col === pos.col)
}

/** Apply a move to the game state. Returns new state (immutable). */
export function applyMove(state: GameState, move: Move): GameState {
  const board = cloneBoard(state.board)
  const piece = board[move.from.row][move.from.col]

  if (!piece) throw new Error('No piece at source position')
  if (piece.color !== state.currentTurn) throw new Error('Not your turn')

  // Move piece
  board[move.from.row][move.from.col] = null

  // Remove captured pieces
  for (const cap of move.captures) {
    board[cap.row][cap.col] = null
  }

  // Place piece at destination (with possible promotion)
  const promoted = move.promotion
  board[move.to.row][move.to.col] = {
    color: piece.color,
    type: promoted ? 'king' : piece.type,
  }

  // Count remaining pieces
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
    board,
    currentTurn: nextTurn,
    status: 'playing',
    moveHistory: [...state.moveHistory, serializedMove],
    moveCount: state.moveCount + 1,
    blackPieces,
    whitePieces,
    lastMoveTimestamp: now,
  }

  // Check win conditions
  if (blackPieces === 0) {
    newState.status = 'white_wins'
  } else if (whitePieces === 0) {
    newState.status = 'black_wins'
  } else {
    // Check if next player has any moves
    const nextMoves = getValidMoves(newState)
    if (nextMoves.length === 0) {
      // Current player (who just moved) wins because opponent is blocked
      newState.status = state.currentTurn === 'black' ? 'black_wins' : 'white_wins'
    }
  }

  return newState
}

/** Validate that a move is legal in the current state */
export function isValidMove(state: GameState, from: Position, to: Position): Move | null {
  const validMoves = getValidMoves(state)
  return validMoves.find(
    m => m.from.row === from.row && m.from.col === from.col &&
         m.to.row === to.row && m.to.col === to.col
  ) || null
}

/** Serialize board to a compact string for storage */
export function serializeBoard(board: Board): string {
  return board.map(row =>
    row.map(cell => {
      if (!cell) return '.'
      if (cell.color === 'black') return cell.type === 'king' ? 'B' : 'b'
      return cell.type === 'king' ? 'W' : 'w'
    }).join('')
  ).join('/')
}

/** Deserialize board from compact string */
export function deserializeBoard(str: string): Board {
  return str.split('/').map(row =>
    row.split('').map(ch => {
      if (ch === '.') return null
      if (ch === 'b') return { color: 'black' as PieceColor, type: 'man' as PieceType }
      if (ch === 'B') return { color: 'black' as PieceColor, type: 'king' as PieceType }
      if (ch === 'w') return { color: 'white' as PieceColor, type: 'man' as PieceType }
      if (ch === 'W') return { color: 'white' as PieceColor, type: 'king' as PieceType }
      return null
    })
  )
}

/** Serialize full game state for DB storage */
export function serializeGameState(state: GameState): string {
  return JSON.stringify({
    b: serializeBoard(state.board),
    t: state.currentTurn,
    s: state.status,
    h: state.moveHistory,
    mc: state.moveCount,
    bp: state.blackPieces,
    wp: state.whitePieces,
    lm: state.lastMoveTimestamp,
  })
}

/** Deserialize game state from DB */
export function deserializeGameState(json: string): GameState {
  const d = JSON.parse(json)
  return {
    board: deserializeBoard(d.b),
    currentTurn: d.t,
    status: d.s,
    moveHistory: d.h,
    moveCount: d.mc,
    blackPieces: d.bp,
    whitePieces: d.wp,
    lastMoveTimestamp: d.lm,
  }
}
