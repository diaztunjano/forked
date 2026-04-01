import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';

import ChessSquare, { HighlightType } from './ChessSquare';

const boardSize = Math.floor(Dimensions.get('window').width * 0.9);
export const SQUARE_SIZE = boardSize / 8;

const LABEL_SIZE = 14;
const SVG_WIDTH = boardSize + LABEL_SIZE;
const SVG_HEIGHT = boardSize + LABEL_SIZE;

// Board squares start at x = LABEL_SIZE (rank labels on left), y = 0
const BOARD_X = LABEL_SIZE;
const BOARD_Y = 0;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

interface ChessBoardProps {
  highlightMap?: Record<string, HighlightType>;
  flipped?: boolean;
}

export default function ChessBoard({
  highlightMap = {},
  flipped = false,
}: ChessBoardProps) {
  const files = flipped ? [...FILES].reverse() : [...FILES];
  const ranks = flipped ? [...RANKS].reverse() : [...RANKS];

  return (
    <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
      {/* 8x8 grid of squares */}
      {ranks.map((rank, rankIdx) =>
        files.map((file, fileIdx) => {
          const squareKey = `${file}${rank}`;
          const x = BOARD_X + fileIdx * SQUARE_SIZE;
          const y = BOARD_Y + rankIdx * SQUARE_SIZE;
          // Square color: (fileIdx + rankIdx) % 2 === 0 → light
          // Verified: a8 (0,0) = light ✓, a1 (0,7) = dark ✓, h1 (7,7) = light ✓
          const isLight = (fileIdx + rankIdx) % 2 === 0;
          return (
            <ChessSquare
              key={squareKey}
              squareKey={squareKey}
              x={x}
              y={y}
              size={SQUARE_SIZE}
              isLight={isLight}
              highlight={highlightMap[squareKey] ?? null}
            />
          );
        })
      )}

      {/* Rank labels (1-8) along left edge */}
      {ranks.map((rank, rankIdx) => (
        <SvgText
          key={`rank-${rank}`}
          x={LABEL_SIZE / 2}
          y={BOARD_Y + rankIdx * SQUARE_SIZE + SQUARE_SIZE / 2 + 4}
          fontSize={10}
          textAnchor="middle"
          fill="#555"
        >
          {rank}
        </SvgText>
      ))}

      {/* File labels (a-h) along bottom edge */}
      {files.map((file, fileIdx) => (
        <SvgText
          key={`file-${file}`}
          x={BOARD_X + fileIdx * SQUARE_SIZE + SQUARE_SIZE / 2}
          y={boardSize + LABEL_SIZE - 2}
          fontSize={10}
          textAnchor="middle"
          fill="#555"
        >
          {file}
        </SvgText>
      ))}
    </Svg>
  );
}
