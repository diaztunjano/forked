# CLAUDE.md

## What is Forked

Forked is an iOS chess puzzle app that turns screen time into brain training. When users try to open distracting apps, they solve chess tactics puzzles first. The app uses adaptive difficulty (Elo), spaced repetition (FSRS), and gamification to make the friction rewarding instead of boring. Name comes from the chess term "fork" (attacking two pieces at once).

## Tech Stack

- **Framework**: React Native (Expo SDK 55, managed workflow with dev builds)
- **Routing**: Expo Router (file-based, tab layout)
- **Chess Logic**: chess.js v1.4.0 (move validation, legal moves, game state)
- **Puzzle Storage**: expo-sqlite (10K pre-bundled Lichess puzzles as SQLite DB)
- **Spaced Repetition**: ts-fsrs (FSRS algorithm for failed puzzle review scheduling)
- **Board Rendering**: react-native-svg + react-native-gesture-handler (custom board)
- **Backend**: Supabase (auth, remote sync, analytics)
- **Payments**: RevenueCat (react-native-purchases)
- **Language**: TypeScript 5.9

## Commands

```bash
npx expo start          # Start Metro bundler (dev server)
npx expo run:ios        # Build and run on iOS simulator (requires dev build)
npx expo run:android    # Build and run on Android emulator
npx expo prebuild       # Generate native projects
npx tsc --noEmit        # Type-check without emitting
```

**Important**: This project requires Expo dev builds (NOT Expo Go) because of native modules (expo-sqlite, future FamilyControls). Use `npx expo run:ios` for development.

## Project Structure

```
app/                      # Expo Router screens (file-based routing)
  (tabs)/                 # Tab navigator group
  _layout.tsx             # Root layout
components/
  ui/                     # Primitives (Button, Card, etc.)
  chess/                  # Board, Piece, Square components
  onboarding/             # Onboarding flow screens
  gamification/           # Streaks, achievements, rating display
constants/                # Theme colors, config values
lib/
  chess-engine.ts         # chess.js wrapper for puzzle logic
  puzzle-db.ts            # SQLite puzzle queries
  elo.ts                  # Elo rating system
  fsrs.ts                 # ts-fsrs wrapper for spaced repetition
  supabase.ts             # Supabase client initialization
assets/
  puzzles.db              # Pre-built SQLite database (10K Lichess puzzles)
  pieces/                 # SVG chess piece images
  images/                 # App icons, splash screen
  fonts/                  # Custom fonts
```

## Key Conventions

- **Puzzle format**: Lichess UCI format. `moves` field is space-separated UCI (e.g., "e2e4 d7d5 e4d5"). First move is opponent's setup move, played automatically.
- **Board input**: Tap-tap only (tap piece, tap destination). No drag-and-drop.
- **Offline-first**: All core features must work without internet. SQLite is the source of truth for puzzles and progress.
- **Elo system**: Start at 800, K=32 for first 30 puzzles (provisional), K=16 after. Target 85% success rate.
- **FSRS quality mapping**: 1=Again (failed), 2=Hard (slow solve), 3=Good (normal solve), 4=Easy (quick solve).

## Scope

- **In scope (MVP)**: Chess puzzle engine, adaptive difficulty, spaced repetition, onboarding, gamification (streaks/achievements/rating tiers), RevenueCat paywall
- **Out of scope**: App blocking (FamilyControls), Android, social features, leaderboards, Puzzle Rush, widgets, cosmetic IAP

## iOS Only

This is iOS-only for now. Android support comes later. FamilyControls app blocking is also deferred (requires Apple entitlement approval, ~2-3 weeks).
