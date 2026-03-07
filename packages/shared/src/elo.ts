/**
 * ELO Rating System
 *
 * K-factor:
 *   K=32 for players with < 30 games (provisional)
 *   K=16 for established players
 *
 * Expected score: E = 1 / (1 + 10^((Rb - Ra) / 400))
 * New rating: Ra' = Ra + K * (S - E)
 *   S = 1 (win), 0.5 (draw), 0 (loss)
 */

export function getKFactor(gamesPlayed: number): number {
  return gamesPlayed < 30 ? 32 : 16
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

export interface EloResult {
  newRatingWinner: number
  newRatingLoser: number
  changeWinner: number
  changeLoser: number
}

export function calculateElo(
  winnerRating: number,
  loserRating: number,
  winnerGames: number,
  loserGames: number,
): EloResult {
  const kWinner = getKFactor(winnerGames)
  const kLoser = getKFactor(loserGames)

  const expectedWinner = expectedScore(winnerRating, loserRating)
  const expectedLoser = expectedScore(loserRating, winnerRating)

  const changeWinner = Math.round(kWinner * (1 - expectedWinner))
  const changeLoser = Math.round(kLoser * (0 - expectedLoser))

  return {
    newRatingWinner: winnerRating + changeWinner,
    newRatingLoser: Math.max(100, loserRating + changeLoser), // floor at 100
    changeWinner,
    changeLoser,
  }
}

export interface EloDraw {
  newRatingA: number
  newRatingB: number
  changeA: number
  changeB: number
}

export function calculateEloDraw(
  ratingA: number,
  ratingB: number,
  gamesA: number,
  gamesB: number,
): EloDraw {
  const kA = getKFactor(gamesA)
  const kB = getKFactor(gamesB)

  const expectedA = expectedScore(ratingA, ratingB)
  const expectedB = expectedScore(ratingB, ratingA)

  const changeA = Math.round(kA * (0.5 - expectedA))
  const changeB = Math.round(kB * (0.5 - expectedB))

  return {
    newRatingA: Math.max(100, ratingA + changeA),
    newRatingB: Math.max(100, ratingB + changeB),
    changeA,
    changeB,
  }
}
