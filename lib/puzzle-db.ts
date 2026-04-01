import * as SQLite from 'expo-sqlite';
import type { FSRSCardRow } from './fsrs';

export interface Puzzle {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  rating_deviation: number;
  popularity: number;
  nb_plays: number;
  themes: string;
  game_url: string;
  opening_tags: string;
}

export interface PuzzleProgress {
  puzzle_id: string;
  times_seen: number;
  times_correct: number;
  last_seen_at: number;
  avg_solve_time_ms: number;
  fsrs_difficulty: number;
  fsrs_stability: number;
  fsrs_due_at: number;
  fsrs_state: number;
  fsrs_reps: number;
  fsrs_lapses: number;
  fsrs_last_review_at: number | null;
}

export interface UserStats {
  puzzle_rating: number;
  peak_rating: number;
  total_solved: number;
  total_failed: number;
  current_streak: number;
  best_streak: number;
  streak_last_date: string;
  theme_ratings: Record<string, number>;
  unlocked_achievements: string[];
}

const USER_STATS_DEFAULTS: Record<string, string> = {
  puzzle_rating: '800',
  peak_rating: '800',
  total_solved: '0',
  total_failed: '0',
  current_streak: '0',
  best_streak: '0',
  streak_last_date: '',
  theme_ratings: '{}',
  unlocked_achievements: '[]',
};

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('puzzles.db');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS puzzle_progress (
      puzzle_id TEXT PRIMARY KEY,
      times_seen INTEGER NOT NULL DEFAULT 0,
      times_correct INTEGER NOT NULL DEFAULT 0,
      last_seen_at INTEGER NOT NULL DEFAULT 0,
      avg_solve_time_ms INTEGER NOT NULL DEFAULT 0,
      fsrs_difficulty REAL NOT NULL DEFAULT 0,
      fsrs_stability REAL NOT NULL DEFAULT 0,
      fsrs_due_at INTEGER NOT NULL DEFAULT 0,
      fsrs_state INTEGER NOT NULL DEFAULT 0,
      fsrs_reps INTEGER NOT NULL DEFAULT 0,
      fsrs_lapses INTEGER NOT NULL DEFAULT 0,
      fsrs_last_review_at INTEGER
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_stats (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export async function getPuzzleById(id: string): Promise<Puzzle | null> {
  const database = getDatabase();
  const row = await database.getFirstAsync<Puzzle>(
    'SELECT * FROM puzzles WHERE id = ?',
    [id],
  );
  return row ?? null;
}

export async function getPuzzlesByRating(
  targetRating: number,
  jitter: number,
  limit: number,
  excludeIds?: string[],
): Promise<Puzzle[]> {
  const database = getDatabase();
  const minRating = targetRating - jitter;
  const maxRating = targetRating + jitter;

  if (excludeIds && excludeIds.length > 0) {
    const placeholders = excludeIds.map(() => '?').join(', ');
    return database.getAllAsync<Puzzle>(
      `SELECT * FROM puzzles WHERE rating BETWEEN ? AND ? AND id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT ?`,
      [minRating, maxRating, ...excludeIds, limit],
    );
  }

  return database.getAllAsync<Puzzle>(
    'SELECT * FROM puzzles WHERE rating BETWEEN ? AND ? ORDER BY RANDOM() LIMIT ?',
    [minRating, maxRating, limit],
  );
}

export async function getDueFSRSPuzzles(limit: number): Promise<Puzzle[]> {
  const database = getDatabase();
  return database.getAllAsync<Puzzle>(
    `SELECT p.* FROM puzzles p
     INNER JOIN puzzle_progress pp ON p.id = pp.puzzle_id
     WHERE pp.fsrs_due_at <= unixepoch()
       AND pp.fsrs_state > 0
     ORDER BY pp.fsrs_due_at ASC
     LIMIT ?`,
    [limit],
  );
}

export async function getRecentAccuracy(n: number): Promise<number> {
  const database = getDatabase();
  const rows = await database.getAllAsync<{ times_correct: number; times_seen: number }>(
    'SELECT times_correct, times_seen FROM puzzle_progress WHERE last_seen_at > 0 ORDER BY last_seen_at DESC LIMIT ?',
    [n],
  );
  if (rows.length === 0) return 0.85;
  let totalCorrect = 0;
  let totalSeen = 0;
  for (const row of rows) {
    totalCorrect += row.times_correct;
    totalSeen += row.times_seen;
  }
  if (totalSeen === 0) return 0.85;
  return totalCorrect / totalSeen;
}

export async function selectNextPuzzle(
  userRating: number,
  recentAccuracy: number,
  excludeIds?: string[],
): Promise<Puzzle> {
  const duePuzzles = await getDueFSRSPuzzles(1);
  if (duePuzzles.length > 0) {
    return duePuzzles[0];
  }

  let offset: number;
  if (recentAccuracy > 0.90) {
    offset = 100;
  } else if (recentAccuracy >= 0.85) {
    offset = 50;
  } else if (recentAccuracy >= 0.75) {
    offset = 0;
  } else if (recentAccuracy >= 0.65) {
    offset = -50;
  } else {
    offset = -100;
  }

  const jitter = Math.random() * 50 - 25;
  const targetRating = userRating + offset + jitter;

  const puzzles = await getPuzzlesByRating(targetRating, 100, 1, excludeIds);
  if (puzzles.length > 0) {
    return puzzles[0];
  }

  // Widen search if no puzzles found in narrow range
  const fallback = await getPuzzlesByRating(targetRating, 300, 1, excludeIds);
  if (fallback.length > 0) {
    return fallback[0];
  }

  throw new Error('No puzzles available');
}

export async function updatePuzzleProgress(
  puzzleId: string,
  correct: boolean,
  solveTimeMs: number,
  fsrsCardRow?: FSRSCardRow,
): Promise<void> {
  const database = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const existing = await database.getFirstAsync<PuzzleProgress>(
    'SELECT * FROM puzzle_progress WHERE puzzle_id = ?',
    [puzzleId],
  );

  if (existing) {
    const newTimesSeen = existing.times_seen + 1;
    const newTimesCorrect = existing.times_correct + (correct ? 1 : 0);
    const newAvgSolveTime = Math.round(
      (existing.avg_solve_time_ms * existing.times_seen + solveTimeMs) / newTimesSeen,
    );

    await database.runAsync(
      `UPDATE puzzle_progress SET
        times_seen = ?, times_correct = ?, last_seen_at = ?, avg_solve_time_ms = ?,
        fsrs_difficulty = ?, fsrs_stability = ?, fsrs_due_at = ?,
        fsrs_state = ?, fsrs_reps = ?, fsrs_lapses = ?, fsrs_last_review_at = ?
      WHERE puzzle_id = ?`,
      [
        newTimesSeen,
        newTimesCorrect,
        now,
        newAvgSolveTime,
        fsrsCardRow?.fsrs_difficulty ?? existing.fsrs_difficulty,
        fsrsCardRow?.fsrs_stability ?? existing.fsrs_stability,
        fsrsCardRow?.fsrs_due_at ?? existing.fsrs_due_at,
        fsrsCardRow?.fsrs_state ?? existing.fsrs_state,
        fsrsCardRow?.fsrs_reps ?? existing.fsrs_reps,
        fsrsCardRow?.fsrs_lapses ?? existing.fsrs_lapses,
        fsrsCardRow?.fsrs_last_review_at ?? existing.fsrs_last_review_at,
        puzzleId,
      ],
    );
  } else {
    await database.runAsync(
      `INSERT INTO puzzle_progress (
        puzzle_id, times_seen, times_correct, last_seen_at, avg_solve_time_ms,
        fsrs_difficulty, fsrs_stability, fsrs_due_at, fsrs_state,
        fsrs_reps, fsrs_lapses, fsrs_last_review_at
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        puzzleId,
        correct ? 1 : 0,
        now,
        solveTimeMs,
        fsrsCardRow?.fsrs_difficulty ?? 0,
        fsrsCardRow?.fsrs_stability ?? 0,
        fsrsCardRow?.fsrs_due_at ?? 0,
        fsrsCardRow?.fsrs_state ?? 0,
        fsrsCardRow?.fsrs_reps ?? 0,
        fsrsCardRow?.fsrs_lapses ?? 0,
        fsrsCardRow?.fsrs_last_review_at ?? null,
      ],
    );
  }
}

export async function getUserStat(key: string): Promise<string | null> {
  const database = getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM user_stats WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setUserStat(key: string, value: string): Promise<void> {
  const database = getDatabase();
  await database.runAsync(
    'INSERT OR REPLACE INTO user_stats (key, value) VALUES (?, ?)',
    [key, value],
  );
}

export async function getUserStats(): Promise<UserStats> {
  const database = getDatabase();
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM user_stats',
  );

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }

  return {
    puzzle_rating: parseInt(map.get('puzzle_rating') ?? '800', 10),
    peak_rating: parseInt(map.get('peak_rating') ?? '800', 10),
    total_solved: parseInt(map.get('total_solved') ?? '0', 10),
    total_failed: parseInt(map.get('total_failed') ?? '0', 10),
    current_streak: parseInt(map.get('current_streak') ?? '0', 10),
    best_streak: parseInt(map.get('best_streak') ?? '0', 10),
    streak_last_date: map.get('streak_last_date') ?? '',
    theme_ratings: (() => { try { return JSON.parse(map.get('theme_ratings') ?? '{}'); } catch { return {}; } })() as Record<string, number>,
    unlocked_achievements: (() => { try { return JSON.parse(map.get('unlocked_achievements') ?? '[]'); } catch { return []; } })() as string[],
  };
}

export async function initDefaultStats(): Promise<void> {
  const database = getDatabase();
  for (const [key, value] of Object.entries(USER_STATS_DEFAULTS)) {
    await database.runAsync(
      'INSERT OR IGNORE INTO user_stats (key, value) VALUES (?, ?)',
      [key, value],
    );
  }
}
