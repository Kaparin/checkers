/**
 * Unified API that dispatches to the correct engine based on game variant.
 * This is the primary import for all game logic.
 */

import type { GameState, Position, Move, GameVariant } from './engine'
import { getValidMoves as getValidMovesAmerican, getValidMovesForPiece as getValidMovesForPieceAmerican, applyMove as applyMoveAmerican, isValidMove as isValidMoveAmerican } from './engine'
import { getValidMovesRussian, getValidMovesForPieceRussian, applyMoveRussian, isValidMoveRussian } from './russian-engine'

export function getValidMoves(state: GameState): Move[] {
  if (state.variant === 'american') return getValidMovesAmerican(state)
  return getValidMovesRussian(state)
}

export function getValidMovesForPiece(state: GameState, pos: Position): Move[] {
  if (state.variant === 'american') return getValidMovesForPieceAmerican(state, pos)
  return getValidMovesForPieceRussian(state, pos)
}

export function applyMove(state: GameState, move: Move): GameState {
  if (state.variant === 'american') return applyMoveAmerican(state, move)
  return applyMoveRussian(state, move)
}

export function isValidMove(state: GameState, from: Position, to: Position): Move | null {
  if (state.variant === 'american') return isValidMoveAmerican(state, from, to)
  return isValidMoveRussian(state, from, to)
}
