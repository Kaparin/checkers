import type { Board, PieceColor } from './engine'

export const BOARD_SIZE = 8
export const PIECES_PER_SIDE = 12

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

export function opponent(color: PieceColor): PieceColor {
  return color === 'black' ? 'white' : 'black'
}

export function isPromotionRow(row: number, color: PieceColor): boolean {
  return color === 'black' ? row === BOARD_SIZE - 1 : row === 0
}

export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  )

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: 'black', type: 'man' }
      }
    }
  }

  for (let row = BOARD_SIZE - 3; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: 'white', type: 'man' }
      }
    }
  }

  return board
}
