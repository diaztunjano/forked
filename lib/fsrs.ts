import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

export type { Card } from 'ts-fsrs';
export { Rating } from 'ts-fsrs';

export interface FSRSCardRow {
  fsrs_difficulty: number;
  fsrs_stability: number;
  fsrs_due_at: number;
  fsrs_state: number;
  fsrs_reps: number;
  fsrs_lapses: number;
  fsrs_last_review_at: number | null;
}

const scheduler = fsrs();

export function createFSRSCard(): Card {
  return createEmptyCard();
}

export function mapSolveTimeToQuality(correct: boolean, solveTimeMs: number): Grade {
  if (!correct) return Rating.Again;
  if (solveTimeMs > 60000) return Rating.Hard;
  if (solveTimeMs < 10000) return Rating.Easy;
  return Rating.Good;
}

export function schedulePuzzleReview(
  card: Card,
  quality: Grade,
): { updatedCard: Card; dueAt: Date } {
  const now = new Date();
  const result = scheduler.next(card, now, quality);
  return {
    updatedCard: result.card,
    dueAt: result.card.due,
  };
}

export function serializeCard(card: Card): FSRSCardRow {
  return {
    fsrs_difficulty: card.difficulty,
    fsrs_stability: card.stability,
    fsrs_due_at: Math.floor(card.due.getTime() / 1000),
    fsrs_state: card.state,
    fsrs_reps: card.reps,
    fsrs_lapses: card.lapses,
    fsrs_last_review_at: card.last_review ? Math.floor(card.last_review.getTime() / 1000) : null,
  };
}

export function deserializeCard(row: FSRSCardRow): Card {
  const base = createEmptyCard();
  return {
    ...base,
    difficulty: row.fsrs_difficulty,
    stability: row.fsrs_stability,
    due: new Date(row.fsrs_due_at * 1000),
    state: row.fsrs_state,
    reps: row.fsrs_reps,
    lapses: row.fsrs_lapses,
    last_review: row.fsrs_last_review_at ? new Date(row.fsrs_last_review_at * 1000) : undefined,
  };
}
