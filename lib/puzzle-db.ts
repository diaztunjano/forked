import * as SQLite from 'expo-sqlite';

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
