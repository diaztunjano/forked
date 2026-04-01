import React from 'react';
import { G, Rect, Circle } from 'react-native-svg';

export type HighlightType =
  | 'selected'
  | 'legalMove'
  | 'legalCapture'
  | 'lastMove'
  | 'check'
  | null;

const LIGHT_SQUARE = '#EBECD0';
const DARK_SQUARE = '#779556';

interface ChessSquareProps {
  squareKey: string;
  x: number;
  y: number;
  size: number;
  isLight: boolean;
  highlight: HighlightType;
}

export default function ChessSquare({
  x,
  y,
  size,
  isLight,
  highlight,
}: ChessSquareProps) {
  const fill = isLight ? LIGHT_SQUARE : DARK_SQUARE;
  const borderInset = 1.5;
  const innerSize = size - borderInset * 2;

  return (
    <G>
      {/* Base square */}
      <Rect x={x} y={y} width={size} height={size} fill={fill} />

      {/* lastMove: yellow fill at 30% opacity */}
      {highlight === 'lastMove' && (
        <Rect
          x={x}
          y={y}
          width={size}
          height={size}
          fill="#F7EC3D"
          fillOpacity={0.3}
        />
      )}

      {/* selected: 3px blue border */}
      {highlight === 'selected' && (
        <Rect
          x={x + borderInset}
          y={y + borderInset}
          width={innerSize}
          height={innerSize}
          fill="none"
          stroke="#4A90D9"
          strokeWidth={3}
        />
      )}

      {/* legalMove: small dot at center */}
      {highlight === 'legalMove' && (
        <Circle
          cx={x + size / 2}
          cy={y + size / 2}
          r={8}
          fill="#4A90D9"
          fillOpacity={0.4}
        />
      )}

      {/* legalCapture: 3px orange ring border */}
      {highlight === 'legalCapture' && (
        <Rect
          x={x + borderInset}
          y={y + borderInset}
          width={innerSize}
          height={innerSize}
          fill="none"
          stroke="#E8833A"
          strokeWidth={3}
        />
      )}

      {/* check: 3px red ring border */}
      {highlight === 'check' && (
        <Rect
          x={x + borderInset}
          y={y + borderInset}
          width={innerSize}
          height={innerSize}
          fill="none"
          stroke="#E74C3C"
          strokeWidth={3}
        />
      )}
    </G>
  );
}
