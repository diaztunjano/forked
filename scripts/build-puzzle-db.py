#!/usr/bin/env python3
"""
Download Lichess puzzle database, filter, and build SQLite DB.

Lichess CSV columns:
  PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes, GameUrl, OpeningTags

Filter criteria:
  - popularity > 50
  - nb_plays > 100
  - rating_deviation < 100

Target: ~10K puzzles across rating range 400-2200, balanced by theme.
"""

import csv
import io
import os
import sqlite3
import sys
import urllib.request
import zstandard

LICHESS_URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
OUTPUT_DB = os.path.join(os.path.dirname(__file__), "..", "assets", "puzzles.db")
TARGET_COUNT = 10000
TEMP_CSV = "/tmp/lichess_puzzles.csv"
TEMP_ZST = "/tmp/lichess_puzzles.csv.zst"


def download_puzzles():
    """Download the Lichess puzzle CSV (zstd compressed)."""
    if os.path.exists(TEMP_CSV):
        print(f"Using cached CSV at {TEMP_CSV}")
        return

    if not os.path.exists(TEMP_ZST):
        print(f"Downloading {LICHESS_URL} ...")
        urllib.request.urlretrieve(LICHESS_URL, TEMP_ZST)
        print(f"Downloaded to {TEMP_ZST}")
    else:
        print(f"Using cached zst at {TEMP_ZST}")

    print("Decompressing...")
    dctx = zstandard.ZstdDecompressor()
    with open(TEMP_ZST, "rb") as ifh, open(TEMP_CSV, "wb") as ofh:
        dctx.copy_stream(ifh, ofh)
    print(f"Decompressed to {TEMP_CSV}")


def filter_and_sample(csv_path: str) -> list[dict]:
    """Filter puzzles and sample ~10K across rating range."""
    print("Filtering puzzles...")

    # First pass: collect all qualifying puzzles
    qualifying = []
    total = 0

    with open(csv_path, "r") as f:
        reader = csv.reader(f)
        for row in reader:
            total += 1
            if total % 500000 == 0:
                print(f"  Processed {total:,} rows, {len(qualifying):,} qualifying...")

            if len(row) < 10:
                continue

            puzzle_id, fen, moves, rating, rating_dev, popularity, nb_plays, themes, game_url, opening_tags = row[:10]

            try:
                rating_int = int(rating)
                rating_dev_int = int(rating_dev)
                popularity_int = int(popularity)
                nb_plays_int = int(nb_plays)
            except ValueError:
                continue

            # Apply filters
            if popularity_int <= 50:
                continue
            if nb_plays_int <= 100:
                continue
            if rating_dev_int >= 100:
                continue

            qualifying.append({
                "id": puzzle_id,
                "fen": fen,
                "moves": moves,
                "rating": rating_int,
                "rating_deviation": rating_dev_int,
                "popularity": popularity_int,
                "nb_plays": nb_plays_int,
                "themes": themes,
                "game_url": game_url,
                "opening_tags": opening_tags,
            })

    print(f"Total rows: {total:,}, Qualifying: {len(qualifying):,}")

    # Sort by popularity (descending) to get the best puzzles
    qualifying.sort(key=lambda p: p["popularity"], reverse=True)

    # Sample across rating buckets to ensure good distribution
    # Rating buckets: 400-800, 800-1000, 1000-1200, 1200-1500, 1500-1800, 1800-2200, 2200+
    buckets = [
        (400, 800, 1500),    # Beginner - more puzzles
        (800, 1000, 2000),   # Developing - most puzzles
        (1000, 1200, 2000),  # Intermediate
        (1200, 1500, 2000),  # Advanced
        (1500, 1800, 1500),  # Expert
        (1800, 2200, 800),   # Master
        (2200, 4000, 200),   # Grandmaster
    ]

    selected = []
    for low, high, target in buckets:
        bucket_puzzles = [p for p in qualifying if low <= p["rating"] < high]
        take = min(len(bucket_puzzles), target)
        selected.extend(bucket_puzzles[:take])
        print(f"  Rating {low}-{high}: {len(bucket_puzzles):,} available, took {take}")

    # If we have more than target, trim. If less, that's fine.
    if len(selected) > TARGET_COUNT:
        selected = selected[:TARGET_COUNT]

    print(f"Selected {len(selected):,} puzzles total")
    return selected


def build_database(puzzles: list[dict], db_path: str):
    """Build SQLite database from filtered puzzles."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    if os.path.exists(db_path):
        os.remove(db_path)

    print(f"Building SQLite database at {db_path}...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Create tables
    cur.executescript("""
        CREATE TABLE puzzles (
            id TEXT PRIMARY KEY,
            fen TEXT NOT NULL,
            moves TEXT NOT NULL,
            rating INTEGER NOT NULL,
            rating_deviation INTEGER,
            popularity INTEGER,
            nb_plays INTEGER,
            themes TEXT,
            game_url TEXT,
            opening_tags TEXT
        );

        CREATE INDEX idx_puzzles_rating ON puzzles(rating);
        CREATE INDEX idx_puzzles_themes ON puzzles(themes);
        CREATE INDEX idx_puzzles_popularity ON puzzles(popularity);

        CREATE TABLE puzzle_progress (
            puzzle_id TEXT PRIMARY KEY REFERENCES puzzles(id),
            times_seen INTEGER DEFAULT 0,
            times_correct INTEGER DEFAULT 0,
            last_seen_at INTEGER,
            avg_solve_time_ms INTEGER,
            fsrs_difficulty REAL,
            fsrs_stability REAL,
            fsrs_due_at INTEGER,
            fsrs_state INTEGER DEFAULT 0
        );

        CREATE INDEX idx_progress_due ON puzzle_progress(fsrs_due_at);
        CREATE INDEX idx_progress_state ON puzzle_progress(fsrs_state);

        CREATE TABLE user_stats (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)

    # Insert puzzles
    cur.executemany(
        """INSERT INTO puzzles (id, fen, moves, rating, rating_deviation, popularity, nb_plays, themes, game_url, opening_tags)
           VALUES (:id, :fen, :moves, :rating, :rating_deviation, :popularity, :nb_plays, :themes, :game_url, :opening_tags)""",
        puzzles,
    )

    # Insert default user stats
    default_stats = [
        ("puzzle_rating", "800"),
        ("peak_rating", "800"),
        ("total_solved", "0"),
        ("total_failed", "0"),
        ("current_streak", "0"),
        ("best_streak", "0"),
        ("streak_last_date", ""),
        ("theme_ratings", "{}"),
        ("blocked_time_saved_seconds", "0"),
        ("puzzles_attempted", "0"),
    ]
    cur.executemany("INSERT INTO user_stats (key, value) VALUES (?, ?)", default_stats)

    conn.commit()

    # Print stats
    cur.execute("SELECT COUNT(*) FROM puzzles")
    count = cur.fetchone()[0]
    cur.execute("SELECT MIN(rating), MAX(rating), AVG(rating) FROM puzzles")
    min_r, max_r, avg_r = cur.fetchone()
    print(f"Database built: {count} puzzles, rating range {min_r}-{max_r}, avg {avg_r:.0f}")

    # Theme distribution
    cur.execute("SELECT themes FROM puzzles")
    theme_counts = {}
    for (themes,) in cur.fetchall():
        if themes:
            for t in themes.split():
                theme_counts[t] = theme_counts.get(t, 0) + 1

    print("\nTop 20 themes:")
    for theme, count in sorted(theme_counts.items(), key=lambda x: -x[1])[:20]:
        print(f"  {theme}: {count}")

    conn.close()
    db_size = os.path.getsize(db_path)
    print(f"\nDatabase size: {db_size / 1024 / 1024:.1f} MB")


def main():
    # Check for zstandard
    try:
        import zstandard
    except ImportError:
        print("Installing zstandard...")
        os.system(f"{sys.executable} -m pip install zstandard")
        import zstandard

    download_puzzles()
    puzzles = filter_and_sample(TEMP_CSV)
    build_database(puzzles, os.path.abspath(OUTPUT_DB))
    print("\nDone!")


if __name__ == "__main__":
    main()
