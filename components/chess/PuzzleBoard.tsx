import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Chess, type Square } from 'chess.js';

import ChessBoard, { SQUARE_SIZE } from './ChessBoard';
import ChessPiece, { ChessPieceRef } from './ChessPiece';
import { HighlightType } from './ChessSquare';

// Matches ChessBoard's internal LABEL_SIZE constant (space for rank labels)
const LABEL_SIZE = 14;
const PIECE_SIZE = SQUARE_SIZE * 0.8;
const PIECE_OFFSET = (SQUARE_SIZE - PIECE_SIZE) / 2;
const BOARD_SIZE = SQUARE_SIZE * 8;
const SVG_WIDTH = BOARD_SIZE + LABEL_SIZE;
const SVG_HEIGHT = BOARD_SIZE + LABEL_SIZE;

// Delay onMove until animation completes so the sliding piece is visible
const MOVE_ANIMATION_MS = 200;

interface PuzzleBoardProps {
  boardFen: string;
  onMove: (from: string, to: string, promotion?: string) => void;
  playerColor: 'w' | 'b';
  disabled: boolean;
  highlightLastMove: { from: string; to: string } | null;
  flipped?: boolean;
}

/** Returns top-left pixel position of a piece centered within its square */
function squareToPieceXY(
  square: string,
  flipped: boolean
): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97; // 'a'=0 … 'h'=7
  const rank = parseInt(square[1]);        // '1'=1 … '8'=8

  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;

  return {
    x: LABEL_SIZE + col * SQUARE_SIZE + PIECE_OFFSET,
    y: row * SQUARE_SIZE + PIECE_OFFSET,
  };
}

/** Converts tap pixel coordinates to a square key, or null if out of bounds */
function xyToSquare(x: number, y: number, flipped: boolean): string | null {
  const col = Math.floor((x - LABEL_SIZE) / SQUARE_SIZE);
  const row = Math.floor(y / SQUARE_SIZE);

  if (col < 0 || col > 7 || row < 0 || row > 7) return null;

  const file = flipped ? 7 - col : col;
  const rank = flipped ? row + 1 : 8 - row;

  return `${String.fromCharCode(97 + file)}${rank}`;
}

export default function PuzzleBoard({
  boardFen,
  onMove,
  playerColor,
  disabled,
  highlightLastMove,
  flipped = false,
}: PuzzleBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);

  // Piece refs keyed by square; populated via ref callbacks on ChessPiece
  const pieceRefs = useRef<Record<string, ChessPieceRef | null>>({});

  // Parse FEN → list of { square, type, color }
  const pieces = useMemo(() => {
    try {
      const chess = new Chess(boardFen);
      const board = chess.board();
      const result: Array<{ square: string; type: string; color: string }> = [];
      board.forEach((rank, rankIdx) => {
        rank.forEach((piece, fileIdx) => {
          if (piece) {
            const f = String.fromCharCode(97 + fileIdx);
            const r = String(8 - rankIdx);
            result.push({ square: `${f}${r}`, type: piece.type, color: piece.color });
          }
        });
      });
      return result;
    } catch {
      return [];
    }
  }, [boardFen]);

  // Build highlight map from last-move, selection, and legal move indicators
  const highlightMap = useMemo((): Record<string, HighlightType> => {
    const map: Record<string, HighlightType> = {};

    if (highlightLastMove) {
      map[highlightLastMove.from] = 'lastMove';
      map[highlightLastMove.to] = 'lastMove';
    }

    if (selectedSquare) {
      map[selectedSquare] = 'selected';
      try {
        const chess = new Chess(boardFen);
        legalMoves.forEach((sq) => {
          const occupant = chess.get(sq as Square);
          map[sq] = occupant ? 'legalCapture' : 'legalMove';
        });
      } catch {
        // Invalid FEN — skip legal move highlights
      }
    }

    return map;
  }, [selectedSquare, legalMoves, boardFen, highlightLastMove]);

  const handleSquareTap = useCallback(
    (square: string) => {
      if (disabled) return;

      try {
        const chess = new Chess(boardFen);

        if (!selectedSquare) {
          // No selection yet — select own piece
          const piece = chess.get(square as Square);
          if (piece && piece.color === playerColor) {
            const moves = chess.moves({ square: square as Square, verbose: true });
            setSelectedSquare(square);
            setLegalMoves(moves.map((m) => m.to));
          }
        } else if (legalMoves.includes(square)) {
          // Legal destination — animate then call onMove
          const fromRef = pieceRefs.current[selectedSquare];
          if (fromRef) {
            const { x, y } = squareToPieceXY(square, flipped);
            fromRef.animateTo(x, y);
          }

          const from = selectedSquare;
          setSelectedSquare(null);
          setLegalMoves([]);

          // Detect pawn promotion: auto-queen (picker UI can be added later)
          const movesTo = chess.moves({ square: from as Square, verbose: true }).filter((m) => m.to === square);
          const promotion = movesTo.length > 0 && movesTo[0].promotion ? 'q' : undefined;

          // Delay onMove so the 200ms slide animation is visible before parent
          // re-renders the board with the new FEN
          setTimeout(() => {
            onMove(from, square, promotion);
          }, MOVE_ANIMATION_MS);
        } else {
          // Check if tapping another own piece — switch selection
          const piece = chess.get(square as Square);
          if (piece && piece.color === playerColor) {
            const moves = chess.moves({ square: square as Square, verbose: true });
            setSelectedSquare(square);
            setLegalMoves(moves.map((m) => m.to));
          } else {
            // Deselect
            setSelectedSquare(null);
            setLegalMoves([]);
          }
        }
      } catch {
        // Invalid FEN — reset selection
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    },
    [disabled, boardFen, selectedSquare, legalMoves, playerColor, flipped, onMove]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((event) => {
          const square = xyToSquare(event.x, event.y, flipped);
          if (square) handleSquareTap(square);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flipped, handleSquareTap]
  );

  return (
    <View style={{ width: SVG_WIDTH, height: SVG_HEIGHT }}>
      {/* Board layer: squares + coordinate labels */}
      <ChessBoard highlightMap={highlightMap} flipped={flipped} />

      {/* Piece layer: absolute-positioned Animated.Views, non-interactive */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, width: SVG_WIDTH, height: SVG_HEIGHT }}
        pointerEvents="none"
      >
        {pieces.map(({ square, type, color }) => {
          const { x, y } = squareToPieceXY(square, flipped);
          return (
            <ChessPiece
              key={square}
              ref={(r) => {
                pieceRefs.current[square] = r;
              }}
              piece={{ type, color }}
              x={x}
              y={y}
              size={PIECE_SIZE}
            />
          );
        })}
      </View>

      {/* Tap overlay: transparent view capturing all taps */}
      <GestureDetector gesture={tapGesture}>
        <View
          style={{ position: 'absolute', top: 0, left: 0, width: SVG_WIDTH, height: SVG_HEIGHT }}
        />
      </GestureDetector>
    </View>
  );
}
