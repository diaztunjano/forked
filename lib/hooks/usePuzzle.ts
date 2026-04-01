import { useState, useRef, useCallback } from 'react';
import PuzzleEngine, { type UCIMove } from '@/lib/chess-engine';
import {
  initDatabase,
  initDefaultStats,
  selectNextPuzzle,
  getRecentAccuracy,
  getUserStat,
  setUserStat,
  updatePuzzleProgress,
  type Puzzle,
} from '@/lib/puzzle-db';
import { calculateElo, applyRatingFloor, getEloDelta } from '@/lib/elo';
import {
  createFSRSCard,
  mapSolveTimeToQuality,
  schedulePuzzleReview,
  serializeCard,
} from '@/lib/fsrs';

export type PuzzlePhase =
  | 'loading'
  | 'setup-move'
  | 'player-turn'
  | 'opponent-reply'
  | 'success'
  | 'failure';

interface CorrectMove {
  from: string;
  to: string;
  promotion?: string;
}

interface UsePuzzleReturn {
  puzzle: Puzzle | null;
  phase: PuzzlePhase;
  boardFen: string;
  setupMove: UCIMove | null;
  correctMove: CorrectMove | null;
  eloDelta: number | null;
  loadNextPuzzle: () => Promise<void>;
  submitMove: (from: string, to: string, promotion?: string) => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function usePuzzle(): UsePuzzleReturn {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [phase, setPhase] = useState<PuzzlePhase>('loading');
  const [boardFen, setBoardFen] = useState(INITIAL_FEN);
  const [setupMove, setSetupMove] = useState<UCIMove | null>(null);
  const [correctMove, setCorrectMove] = useState<CorrectMove | null>(null);
  const [eloDelta, setEloDelta] = useState<number | null>(null);

  const engineRef = useRef<PuzzleEngine | null>(null);
  const solveStartTimeRef = useRef<number | null>(null);
  const dbInitializedRef = useRef(false);

  const updateStatsOnResult = useCallback(async (solved: boolean, currentPuzzle: Puzzle, solveTimeMs: number) => {
    const ratingStr = await getUserStat('puzzle_rating');
    const peakStr = await getUserStat('peak_rating');
    const totalSolvedStr = await getUserStat('total_solved');
    const totalFailedStr = await getUserStat('total_failed');

    const playerRating = parseInt(ratingStr ?? '800', 10);
    const peakRating = parseInt(peakStr ?? '800', 10);
    const totalSolved = parseInt(totalSolvedStr ?? '0', 10);
    const totalFailed = parseInt(totalFailedStr ?? '0', 10);

    const totalAttempts = totalSolved + totalFailed;

    const delta = getEloDelta(playerRating, currentPuzzle.rating, solved, totalAttempts);
    setEloDelta(delta);

    let newRating = calculateElo(playerRating, currentPuzzle.rating, solved, totalAttempts);
    newRating = applyRatingFloor(newRating, peakRating);

    const newPeak = Math.max(peakRating, newRating);

    await setUserStat('puzzle_rating', String(newRating));
    await setUserStat('peak_rating', String(newPeak));

    if (solved) {
      await setUserStat('total_solved', String(totalSolved + 1));
    } else {
      await setUserStat('total_failed', String(totalFailed + 1));
    }

    const quality = mapSolveTimeToQuality(solved, solveTimeMs);
    const card = createFSRSCard();
    const { updatedCard } = schedulePuzzleReview(card, quality);
    const fsrsRow = serializeCard(updatedCard);
    await updatePuzzleProgress(currentPuzzle.id, solved, solveTimeMs, fsrsRow);
  }, []);

  const loadNextPuzzle = useCallback(async () => {
    setPhase('loading');
    setCorrectMove(null);
    setEloDelta(null);
    setSetupMove(null);

    if (!dbInitializedRef.current) {
      await initDatabase();
      await initDefaultStats();
      dbInitializedRef.current = true;
    }

    const ratingStr = await getUserStat('puzzle_rating');
    const userRating = parseInt(ratingStr ?? '800', 10);
    const accuracy = await getRecentAccuracy(20);

    const nextPuzzle = await selectNextPuzzle(userRating, accuracy);
    setPuzzle(nextPuzzle);

    const engine = new PuzzleEngine(nextPuzzle.fen, nextPuzzle.moves);
    engineRef.current = engine;

    const setup = engine.getSetupMove();
    setSetupMove(setup);
    setPhase('setup-move');
    setBoardFen(engine.getBoardFen());

    setTimeout(() => {
      engine.applyMove(setup.from, setup.to, setup.promotion);
      setBoardFen(engine.getBoardFen());
      setPhase('player-turn');
      solveStartTimeRef.current = Date.now();
    }, 800);
  }, []);

  const submitMove = useCallback((from: string, to: string, promotion?: string) => {
    const engine = engineRef.current;
    const currentPuzzle = puzzle;
    if (!engine || !currentPuzzle || phase !== 'player-turn') return;

    // Check expected move before attempting (for failure feedback)
    const expected = engine.getCurrentExpectedMove();
    const result = engine.applyMove(from, to, promotion);

    if (!result.valid) {
      setPhase('failure');
      if (expected) {
        setCorrectMove({
          from: expected.from,
          to: expected.to,
          promotion: expected.promotion,
        });
      }
      const solveTimeMs = solveStartTimeRef.current ? Date.now() - solveStartTimeRef.current : 0;
      updateStatsOnResult(false, currentPuzzle, solveTimeMs);
      return;
    }

    setBoardFen(engine.getBoardFen());

    if (result.isComplete) {
      setPhase('success');
      const solveTimeMs = solveStartTimeRef.current ? Date.now() - solveStartTimeRef.current : 0;
      updateStatsOnResult(true, currentPuzzle, solveTimeMs);
      return;
    }

    // Multi-move puzzle: trigger opponent reply
    setPhase('opponent-reply');
    setTimeout(() => {
      const reply = engine.triggerOpponentReply();
      if (reply) {
        setBoardFen(engine.getBoardFen());
      }
      setPhase('player-turn');
    }, 500);
  }, [puzzle, phase, updateStatsOnResult]);

  return {
    puzzle,
    phase,
    boardFen,
    setupMove,
    correctMove,
    eloDelta,
    loadNextPuzzle,
    submitMove,
  };
}
