import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Image as SvgImage } from 'react-native-svg';

// Static map required — Metro bundler does not support dynamic require()
const PIECE_ASSETS = {
  wp: require('../../assets/pieces/wp.svg'),
  bp: require('../../assets/pieces/bp.svg'),
  wn: require('../../assets/pieces/wn.svg'),
  bn: require('../../assets/pieces/bn.svg'),
  wb: require('../../assets/pieces/wb.svg'),
  bb: require('../../assets/pieces/bb.svg'),
  wr: require('../../assets/pieces/wr.svg'),
  br: require('../../assets/pieces/br.svg'),
  wq: require('../../assets/pieces/wq.svg'),
  bq: require('../../assets/pieces/bq.svg'),
  wk: require('../../assets/pieces/wk.svg'),
  bk: require('../../assets/pieces/bk.svg'),
} as const;

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

    const assetKey = `${piece.color}${piece.type}` as keyof typeof PIECE_ASSETS;
    const source = PIECE_ASSETS[assetKey];

    return (
      <Animated.View style={animatedStyle}>
        <Svg width={size} height={size}>
          <SvgImage href={source} width={size} height={size} />
        </Svg>
      </Animated.View>
    );
  }
);

ChessPiece.displayName = 'ChessPiece';

export default ChessPiece;
