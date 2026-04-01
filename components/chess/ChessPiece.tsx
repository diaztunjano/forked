import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// Static imports required — react-native-svg-transformer converts SVGs to React components
import WpSvg from '../../assets/pieces/wp.svg';
import BpSvg from '../../assets/pieces/bp.svg';
import WnSvg from '../../assets/pieces/wn.svg';
import BnSvg from '../../assets/pieces/bn.svg';
import WbSvg from '../../assets/pieces/wb.svg';
import BbSvg from '../../assets/pieces/bb.svg';
import WrSvg from '../../assets/pieces/wr.svg';
import BrSvg from '../../assets/pieces/br.svg';
import WqSvg from '../../assets/pieces/wq.svg';
import BqSvg from '../../assets/pieces/bq.svg';
import WkSvg from '../../assets/pieces/wk.svg';
import BkSvg from '../../assets/pieces/bk.svg';

import type { SvgProps } from 'react-native-svg';

const PIECE_COMPONENTS: Record<string, React.FC<SvgProps>> = {
  wp: WpSvg,
  bp: BpSvg,
  wn: WnSvg,
  bn: BnSvg,
  wb: WbSvg,
  bb: BbSvg,
  wr: WrSvg,
  br: BrSvg,
  wq: WqSvg,
  bq: BqSvg,
  wk: WkSvg,
  bk: BkSvg,
};

export interface ChessPieceRef {
  animateTo: (toX: number, toY: number) => void;
}

interface ChessPieceProps {
  piece: { type: string; color: string };
  x: number;
  y: number;
  size: number;
}

const ChessPiece = forwardRef<ChessPieceRef, ChessPieceProps>(
  ({ piece, x, y, size }, ref) => {
    const left = useSharedValue(x);
    const top = useSharedValue(y);

    // Jump to new position (no animation) when x/y props change externally
    useEffect(() => {
      cancelAnimation(left);
      cancelAnimation(top);
      left.value = x;
      top.value = y;
    }, [x, y, left, top]);

    useImperativeHandle(ref, () => ({
      animateTo: (toX: number, toY: number) => {
        left.value = withTiming(toX, {
          duration: 200,
          easing: Easing.out(Easing.quad),
        });
        top.value = withTiming(toY, {
          duration: 200,
          easing: Easing.out(Easing.quad),
        });
      },
    }));

    const animatedStyle = useAnimatedStyle(() => ({
      position: 'absolute' as const,
      left: left.value,
      top: top.value,
      width: size,
      height: size,
    }));

    const assetKey = `${piece.color}${piece.type}`;
    const PieceComponent = PIECE_COMPONENTS[assetKey];

    if (!PieceComponent) return null;

    return (
      <Animated.View style={animatedStyle}>
        <PieceComponent width={size} height={size} />
      </Animated.View>
    );
  }
);

ChessPiece.displayName = 'ChessPiece';

export default ChessPiece;
