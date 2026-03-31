export interface RatingTier {
  name: string;
  label: string;
  minRating: number;
  pieceSymbol: string;
}

export const RATING_TIERS: RatingTier[] = [
  { name: 'Pawn', label: 'Beginner', minRating: 0, pieceSymbol: '\u265F' },
  { name: 'Knight', label: 'Developing', minRating: 600, pieceSymbol: '\u265E' },
  { name: 'Bishop', label: 'Intermediate', minRating: 900, pieceSymbol: '\u265D' },
  { name: 'Rook', label: 'Advanced', minRating: 1200, pieceSymbol: '\u265C' },
  { name: 'Queen', label: 'Expert', minRating: 1500, pieceSymbol: '\u265B' },
  { name: 'King', label: 'Master', minRating: 1800, pieceSymbol: '\u265A' },
];

export function getRatingTier(rating: number): RatingTier {
  for (let i = RATING_TIERS.length - 1; i >= 0; i--) {
    if (rating >= RATING_TIERS[i].minRating) {
      return RATING_TIERS[i];
    }
  }
  return RATING_TIERS[0];
}

export function getEloDelta(
  playerRating: number,
  puzzleRating: number,
  solved: boolean,
  totalSolved: number,
): number {
  const K = totalSolved < 30 ? 32 : 16;
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - playerRating) / 400));
  const score = solved ? 1 : 0;
  return Math.round(K * (score - expected));
}

export function calculateElo(
  playerRating: number,
  puzzleRating: number,
  solved: boolean,
  totalSolved: number,
): number {
  const delta = getEloDelta(playerRating, puzzleRating, solved, totalSolved);
  return Math.max(0, playerRating + delta);
}

export function applyRatingFloor(newRating: number, peakRating: number): number {
  const peakTier = getRatingTier(peakRating);
  return Math.max(newRating, peakTier.minRating);
}
