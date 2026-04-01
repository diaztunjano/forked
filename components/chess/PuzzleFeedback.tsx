import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, Line, Marker, Path } from 'react-native-svg';

import { SQUARE_SIZE } from './ChessBoard';

// Matches ChessBoard / PuzzleBoard LABEL_SIZE
const LABEL_SIZE = 14;

const BOARD_SIZE = SQUARE_SIZE * 8;
const SVG_WIDTH = BOARD_SIZE + LABEL_SIZE;
const SVG_HEIGHT = BOARD_SIZE + LABEL_SIZE;

const AUTO_ADVANCE_MS = 2500;

/** 2-sentence theme explanations for the top common puzzle themes */
export const THEME_EXPLANATIONS: Record<string, string> = {
  fork: 'You attacked two pieces at once! The opponent can only save one.',
  pin: "A piece is pinned to a more valuable one behind it. It can't move without exposing the piece it shields.",
  hangingPiece:
    'A piece was left undefended. Capturing free material is always a good idea.',
  mateIn1:
    'Checkmate in one move! Recognizing mating patterns is a core skill.',
  skewer:
    'An attack on a valuable piece that forces it to move, exposing a piece behind it. The reverse of a pin.',
  backRankMate:
    "The king is trapped on the back rank by its own pawns. A rook or queen delivers the final blow.",
  discoveredAttack:
    'Moving one piece reveals an attack from another. Two threats in one move.',
  mateIn2:
    'Checkmate in two moves. The first move forces a reply that sets up the final blow.',
  doubleCheck:
    'Two pieces give check simultaneously. The king must move — blocking or capturing cannot answer both.',
  capturingDefender:
    'Removing the defender of a key piece or square. Without its protector, the target falls.',
  sacrifice:
    'Giving up material for a greater gain. Sometimes the best move looks like a loss.',
  deflection:
    'Forcing a defensive piece away from its duty. Once it moves, the position collapses.',
  attraction:
    'Luring a piece to a vulnerable square. The target is drawn into a trap.',
  clearance:
    'Moving a piece out of the way to open a line or square for another. Making room for the real attack.',
  intermezzo:
    'An in-between move that changes the expected sequence. A surprise check or threat before recapturing.',
};

export interface PuzzleFeedbackProps {
  success: boolean;
  eloDelta: number;
  themeExplanation: string;
  solveTimeMs: number;
  puzzleRating: number;
  streak: number;
  onDismiss: () => void;
  /** For failure: the correct move to show as an arrow */
  correctMove?: { from: string; to: string } | null;
  /** Whether the board is flipped (player is black) */
  flipped?: boolean;
  /** Y offset of the board from the top of the screen */
  boardTop?: number;
}

/** Convert a square key (e.g. "e4") to the center pixel on the SVG board */
function squareToCenter(
  square: string,
  flipped: boolean
): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]);

  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;

  return {
    x: LABEL_SIZE + col * SQUARE_SIZE + SQUARE_SIZE / 2,
    y: row * SQUARE_SIZE + SQUARE_SIZE / 2,
  };
}

export default function PuzzleFeedback({
  success,
  eloDelta,
  themeExplanation,
  solveTimeMs,
  puzzleRating,
  streak,
  onDismiss,
  correctMove,
  flipped = false,
  boardTop = 0,
}: PuzzleFeedbackProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fade in the overlay
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Checkmark scale animation for success
    if (success) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Auto-advance after 2.5s
    autoAdvanceTimer.current = setTimeout(onDismiss, AUTO_ADVANCE_MS);

    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, [success, scaleAnim, fadeAnim, onDismiss]);

  const solveTimeSec = (solveTimeMs / 1000).toFixed(1);
  const eloDeltaText = eloDelta >= 0 ? `+${eloDelta}` : `${eloDelta}`;
  const eloDeltaColor = eloDelta >= 0 ? '#4CAF50' : '#E74C3C';

  // Compute arrow coordinates for failure
  let arrowFrom: { x: number; y: number } | null = null;
  let arrowTo: { x: number; y: number } | null = null;
  if (!success && correctMove) {
    arrowFrom = squareToCenter(correctMove.from, flipped);
    arrowTo = squareToCenter(correctMove.to, flipped);
  }

  // Center the board overlay in the screen
  const screenWidth = Dimensions.get('window').width;
  const boardLeft = (screenWidth - SVG_WIDTH) / 2;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Arrow overlay on board for failure */}
      {!success && arrowFrom && arrowTo && (
        <View
          style={[
            styles.arrowContainer,
            { left: boardLeft, top: boardTop, width: SVG_WIDTH, height: SVG_HEIGHT },
          ]}
          pointerEvents="none"
        >
          <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
            <Defs>
              <Marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <Path d="M0,0 L10,3.5 L0,7 Z" fill="#E74C3C" />
              </Marker>
            </Defs>
            <Line
              x1={arrowFrom.x}
              y1={arrowFrom.y}
              x2={arrowTo.x}
              y2={arrowTo.y}
              stroke="#E74C3C"
              strokeWidth={3}
              strokeOpacity={0.85}
              markerEnd="url(#arrowhead)"
            />
          </Svg>
        </View>
      )}

      {/* Tap to dismiss */}
      <Pressable style={styles.dismissArea} onPress={onDismiss}>
        <View style={styles.card}>
          {/* Success checkmark */}
          {success && (
            <Animated.View
              style={[styles.checkmarkContainer, { transform: [{ scale: scaleAnim }] }]}
            >
              <Text style={styles.checkmark}>&#10003;</Text>
            </Animated.View>
          )}

          {/* Headline */}
          <Text style={[styles.headline, { color: success ? '#4CAF50' : '#E74C3C' }]}>
            {success ? 'Correct!' : 'Incorrect'}
          </Text>

          {/* Theme explanation */}
          <Text style={styles.explanation}>{themeExplanation}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Time</Text>
              <Text style={styles.statValue}>{solveTimeSec}s</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Puzzle</Text>
              <Text style={styles.statValue}>{puzzleRating}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Rating</Text>
              <Text style={[styles.statValue, { color: eloDeltaColor }]}>
                {eloDeltaText}
              </Text>
            </View>
            {success && streak > 0 && (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Streak</Text>
                <Text style={styles.statValue}>{streak}</Text>
              </View>
            )}
          </View>

          {/* Tap hint */}
          <Text style={styles.tapHint}>Tap for next puzzle</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  arrowContainer: {
    position: 'absolute',
    top: 0,
    zIndex: 11,
  },
  dismissArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  checkmarkContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '700',
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
  },
  explanation: {
    fontSize: 14,
    color: '#c0c0c0',
    textAlign: 'center',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 4,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e8e8e8',
  },
  tapHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});
