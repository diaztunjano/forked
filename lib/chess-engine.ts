import { Chess, type Square, type Color, type PieceSymbol } from 'chess.js';

interface UCIMove {
  from: string;
  to: string;
  promotion?: string;
}

interface ApplyMoveResult {
  valid: boolean;
  isComplete: boolean;
}

interface PieceInfo {
  type: PieceSymbol;
  color: Color;
}

function parseUCI(uci: string): UCIMove {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length === 5 ? uci[4] : undefined,
  };
}

class PuzzleEngine {
  private chess: Chess;
  private moves: string[];
  private moveIndex: number;

  constructor(fen: string, movesUCI: string) {
    this.chess = new Chess(fen);
    this.moves = movesUCI.split(' ');
    this.moveIndex = 0;
  }

  getSetupMove(): UCIMove {
    return parseUCI(this.moves[0]);
  }

  applyMove(from: string, to: string, promotion?: string): ApplyMoveResult {
    if (this.moveIndex >= this.moves.length) {
      return { valid: false, isComplete: false };
    }

    const expected = parseUCI(this.moves[this.moveIndex]);

    if (from !== expected.from || to !== expected.to || (promotion ?? undefined) !== expected.promotion) {
      return { valid: false, isComplete: false };
    }

    try {
      this.chess.move({ from: from as Square, to: to as Square, promotion: promotion as PieceSymbol | undefined });
    } catch {
      return { valid: false, isComplete: false };
    }

    this.moveIndex++;
    const isComplete = this.moveIndex >= this.moves.length;
    return { valid: true, isComplete };
  }

  getLegalMovesFrom(square: string): string[] {
    const piece = this.chess.get(square as Square);
    if (!piece || piece.color !== this.chess.turn()) {
      return [];
    }

    const moves = this.chess.moves({ square: square as Square, verbose: true });
    return moves.map((m) => m.to);
  }

  triggerOpponentReply(): UCIMove | null {
    if (this.moveIndex >= this.moves.length) {
      return null;
    }

    const uci = parseUCI(this.moves[this.moveIndex]);

    try {
      this.chess.move({ from: uci.from as Square, to: uci.to as Square, promotion: uci.promotion as PieceSymbol | undefined });
    } catch {
      return null;
    }

    this.moveIndex++;
    return uci;
  }

  isPlayerTurn(): boolean {
    // Player moves are at odd indices (0 = setup, 1 = player, 2 = opponent, 3 = player, ...)
    return this.moveIndex % 2 === 1;
  }

  getBoardFen(): string {
    return this.chess.fen();
  }

  getPieceAt(square: string): PieceInfo | null {
    const piece = this.chess.get(square as Square);
    if (!piece) {
      return null;
    }
    return { type: piece.type, color: piece.color };
  }
}

export default PuzzleEngine;
