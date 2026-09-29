/**
 * The shared game loop of the timed round games (Twins, Classify): intro -> ten rounds against a
 * clock -> result, with points, streak, personal best and XP. The games only decide what a round
 * looks like and whether an answer is right.
 *
 * A right answer moves on by itself after a moment; a wrong one waits for "Next", so the
 * player can read why.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFinishGame } from '@/hooks/usePlayer';
import { streakBonus } from '@/hooks/useGame';
import { useAudio } from '@/hooks/useAudio';
import { recordEvent, type GameMode } from '@/lib/progress';

export type RoundPhase = 'intro' | 'playing' | 'result';

export interface AnswerDetail { pickedId?: string; otherIds?: readonly string[] }

interface Options<R> {
  mode: GameMode;
  bestKey: string;
  roundMs: number;
  muted: boolean;
  /** Builds a fresh set of rounds */
  build: () => R[];
  /** The sign the round is about: its answer is recorded, so a miss lands in the mistakes list */
  signIdOf: (round: R) => string;
  /** How long a right answer stays on screen before the next round (ms) */
  advanceMs?: number;
}

const readBest = (key: string): number => {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
};
const writeBest = (key: string, n: number) => {
  try { localStorage.setItem(key, String(n)); } catch { /* storage unavailable */ }
};

export function useRoundGame<R>(options: Options<R>) {
  const { mode, bestKey, roundMs, muted } = options;
  const [phase, setPhase]       = useState<RoundPhase>('intro');
  const [rounds, setRounds]     = useState<R[]>([]);
  const [index, setIndex]       = useState(0);
  const [elapsed, setElapsed]   = useState(0);
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked]     = useState<string | null>(null);
  const [wasRight, setWasRight] = useState(false);
  const [gained, setGained]     = useState(0);
  const [score, setScore]       = useState(0);
  const [streak, setStreak]     = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [best, setBest]         = useState(0);
  const [newRecord, setNewRecord] = useState(false);

  const startRef    = useRef(0);
  const answeredRef = useRef(false);
  const advanceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playCorrect, playWrong } = useAudio(muted);
  const round = rounds[index];

  // The callbacks below read the latest values from here, so they can keep one identity and the
  // round clock is not restarted by an unrelated re-render (a mute toggle, for instance).
  const latest = useRef({ options, rounds, index, streak, round, playCorrect, playWrong });
  latest.current = { options, rounds, index, streak, round, playCorrect, playWrong };

  const clearAdvance = useCallback(() => {
    if (advanceRef.current) { clearTimeout(advanceRef.current); advanceRef.current = null; }
  }, []);
  useEffect(() => clearAdvance, [clearAdvance]);

  const start = useCallback(() => {
    clearAdvance();
    setRounds(latest.current.options.build());
    setIndex(0);
    setElapsed(0);
    setAnswered(false);
    answeredRef.current = false;
    setPicked(null);
    setWasRight(false);
    setGained(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setNewRecord(false);
    setBest(readBest(bestKey));
    setPhase('playing');
  }, [bestKey, clearAdvance]);

  const next = useCallback(() => {
    clearAdvance();
    const { rounds: all, index: i } = latest.current;
    if (i + 1 >= all.length) {
      setPhase('result');
      return;
    }
    setIndex(i + 1);
    setElapsed(0);
    setAnswered(false);
    answeredRef.current = false;
    setPicked(null);
    setWasRight(false);
    setGained(0);
  }, [clearAdvance]);

  /**
   * `key` is what the player chose (null when the time ran out). `detail` says which sign was picked
   * instead (wrong answer) or which other signs were on screen (right answer), for the mix-up record.
   */
  const answer = useCallback((key: string | null, correct: boolean, detail?: AnswerDetail) => {
    const { round: current, streak: streakNow, options: o } = latest.current;
    if (answeredRef.current || !current) return;
    answeredRef.current = true;
    const ms = Math.min(o.roundMs, performance.now() - startRef.current);
    const newStreak = correct ? streakNow + 1 : 0;
    const points = correct ? 50 + Math.round(50 * (1 - ms / o.roundMs)) + streakBonus(newStreak) : 0;

    setAnswered(true);
    setPicked(key);
    setWasRight(correct);
    setGained(points);
    setStreak(newStreak);
    setMaxStreak(m => Math.max(m, newStreak));
    setScore(s => s + points);
    if (correct) setCorrectCount(c => c + 1);
    recordEvent({ type: 'answer', signId: o.signIdOf(current), correct, streak: correct ? newStreak : undefined, ...detail });
    if (correct) latest.current.playCorrect(); else latest.current.playWrong();

    if (correct) advanceRef.current = setTimeout(next, o.advanceMs ?? 1800);
  }, [next]);

  // The clock for the current round
  useEffect(() => {
    if (phase !== 'playing' || answered || !round) return;
    startRef.current = performance.now();
    const id = setInterval(() => {
      const e = performance.now() - startRef.current;
      if (e >= roundMs) {
        clearInterval(id);
        setElapsed(roundMs);
        answer(null, false);
      } else {
        setElapsed(e);
      }
    }, 80);
    return () => clearInterval(id);
  }, [phase, index, answered, round, roundMs, answer]);

  // Personal best, once the game has ended (the score no longer changes on the result screen)
  useEffect(() => {
    if (phase !== 'result') return;
    const previous = readBest(bestKey);
    setBest(Math.max(previous, score));
    if (score > previous) {
      writeBest(bestKey, score);
      setNewRecord(previous > 0);
    }
  }, [phase, score, bestKey]);

  const earned = useFinishGame(phase === 'result', {
    mode,
    xp: 20 + Math.round(score / 20),
    correct: correctCount,
    total: rounds.length || 10,
    maxStreak,
  });

  return {
    phase, rounds, round, index, total: rounds.length || 10,
    elapsed, remaining: Math.max(0, 1 - elapsed / roundMs),
    answered, picked, wasRight, gained, score, streak, maxStreak, correctCount, best, newRecord, earned,
    start, next, answer,
  };
}
