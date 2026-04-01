import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chess } from 'chess.js';

import PuzzleBoard from '@/components/chess/PuzzleBoard';
import PuzzleFeedback, { THEME_EXPLANATIONS } from '@/components/chess/PuzzleFeedback';
import { usePuzzle } from '@/lib/hooks/usePuzzle';

export default function PuzzleScreen() {
  const {
    puzzle,
    phase,
    boardFen,
    setupMove,
    correctMove,
    eloDelta,
    solveTimeMs,
    loadNextPuzzle,
    submitMove,
  } = usePuzzle();

  const [boardTop, setBoardTop] = useState(0);

  useEffect(() => {
    loadNextPuzzle();
  }, [loadNextPuzzle]);

  // The FEN's side-to-move is the opponent (who plays the setup move).
  // The player is the opposite color.
  const playerColor = useMemo((): 'w' | 'b' => {
    if (!puzzle) return 'w';
    try {
      const chess = new Chess(puzzle.fen);
      return chess.turn() === 'w' ? 'b' : 'w';
    } catch {
      return 'w';
    }
  }, [puzzle]);

  // Board is disabled except during player-turn
  const boardDisabled = phase !== 'player-turn';

  // Last move highlight: show the setup move's result after it plays
  const highlightLastMove = useMemo(() => {
    if (phase === 'setup-move' || !setupMove) return null;
    return { from: setupMove.from, to: setupMove.to };
  }, [phase, setupMove]);

  // Theme pills from puzzle
  const themes = useMemo(() => {
    if (!puzzle?.themes) return [];
    return puzzle.themes.split(' ').filter(Boolean);
  }, [puzzle]);

  // Derive theme explanation for feedback overlay
  const themeExplanation = useMemo(() => {
    for (const theme of themes) {
      if (THEME_EXPLANATIONS[theme]) {
        return THEME_EXPLANATIONS[theme];
      }
    }
    return 'Good tactical awareness! Keep solving to sharpen your skills.';
  }, [themes]);

  const handleFeedbackDismiss = useCallback(() => {
    loadNextPuzzle();
  }, [loadNextPuzzle]);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#779556" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header: Rating display */}
      <View style={styles.header}>
        <Text style={styles.ratingText}>Rating: 800</Text>
      </View>

      {/* Board */}
      <View style={styles.boardContainer} onLayout={(e) => setBoardTop(e.nativeEvent.layout.y)}>
        <PuzzleBoard
          boardFen={boardFen}
          onMove={submitMove}
          playerColor={playerColor}
          disabled={boardDisabled}
          highlightLastMove={highlightLastMove}
          flipped={playerColor === 'b'}
        />
      </View>

      {/* Info row */}
      <View style={styles.infoRow}>
        {themes.length > 0 && (
          <View style={styles.themePills}>
            {themes.map((theme) => (
              <View key={theme} style={styles.pill}>
                <Text style={styles.pillText}>{theme}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.moveIndicator}>
          {phase === 'setup-move'
            ? 'Watch the opponent...'
            : phase === 'player-turn'
              ? 'Find the best move'
              : phase === 'opponent-reply'
                ? 'Opponent is responding...'
                : ''}
        </Text>
      </View>

      {/* Puzzle feedback overlay */}
      {(phase === 'success' || phase === 'failure') && (
        <PuzzleFeedback
          success={phase === 'success'}
          eloDelta={eloDelta ?? 0}
          themeExplanation={themeExplanation}
          solveTimeMs={solveTimeMs ?? 0}
          puzzleRating={puzzle?.rating ?? 0}
          streak={0}
          onDismiss={handleFeedbackDismiss}
          correctMove={phase === 'failure' ? correctMove : null}
          flipped={playerColor === 'b'}
          boardTop={boardTop}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e8e8e8',
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  themePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  pill: {
    backgroundColor: 'rgba(119, 149, 86, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    color: '#c0c0c0',
  },
  moveIndicator: {
    fontSize: 16,
    fontWeight: '500',
    color: '#e8e8e8',
  },
});
