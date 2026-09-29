
import { useState, useCallback, useRef, useEffect } from 'react';
import { GameState, Question, SignCategory, TrafficSign } from '@/types/game';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { useAudio } from '@/hooks/useAudio';
import { recordEvent } from '@/lib/progress';

const QUESTIONS_PER_GAME = 10;
export const TIMER_SECONDS = 10;
export const LIFELINES_PER_GAME = 2;

/** Extra points for answering correctly in a row. */
export function streakBonus(streak: number): number {
  return streak >= 5 ? 10 : streak >= 3 ? 5 : 0;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateQuestion(sign: TrafficSign, allSigns: TrafficSign[]): Question {
  const wrongPool = allSigns.filter(s => s.id !== sign.id);
  const wrongOptions = shuffle(wrongPool).slice(0, 3);
  const options = shuffle([sign, ...wrongOptions]);
  return { sign, options, correctId: sign.id };
}

function buildQuestions(category: SignCategory | 'all', signPool?: TrafficSign[]): Question[] {
  // Questions come from the pool; wrong options come from the pool too,
  // unless it is too small to make 4 choices (then from all signs).
  const pool = signPool && signPool.length > 0
    ? signPool
    : category !== 'all'
    ? TRAFFIC_SIGNS.filter(s => s.category === category)
    : TRAFFIC_SIGNS;
  const targets = pool.length > 0 ? pool : TRAFFIC_SIGNS;
  const distractors = targets.length >= 4 ? targets : TRAFFIC_SIGNS;
  return shuffle(targets).slice(0, QUESTIONS_PER_GAME).map(sign => generateQuestion(sign, distractors));
}

const initialState: GameState = {
  currentQuestion: 0,
  totalQuestions: QUESTIONS_PER_GAME,
  score: 0,
  streak: 0,
  maxStreak: 0,
  answers: [],
  phase: 'start',
  selectedCategory: 'all',
  difficulty: 'medium',
  lifelines: LIFELINES_PER_GAME,
};

export function useGame(muted = false) {
  const [state, setState] = useState<GameState>(initialState);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [eliminated, setEliminated] = useState<string[]>([]); // option ids removed by 50/50

  const questionStartTime = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef(false);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { playCorrect, playWrong, playCombo, playTick, stopTick } = useAudio(muted);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopTick();
  }, [stopTick]);

  // Cancel the pending "move to next question" timeout so a stale one can't
  // advance a different game (exit / restart during the feedback delay).
  const clearAdvanceTimeout = useCallback(() => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  }, []);

  const advanceQuestion = useCallback(() => {
    advanceTimeoutRef.current = null;
    setState(prev => {
      const next = prev.currentQuestion + 1;
      return next >= prev.totalQuestions
        ? { ...prev, phase: 'result' }
        : { ...prev, currentQuestion: next };
    });
    setSelectedAnswer(null);
    setEliminated([]);
    setShowFeedback(false);
    feedbackRef.current = false;
    setTimeLeft(TIMER_SECONDS);
    questionStartTime.current = Date.now();
  }, []);

  const processAnswer = useCallback((chosenId: string | null, stateSnap: GameState, qs: Question[]) => {
    if (feedbackRef.current) return;
    feedbackRef.current = true;
    clearTimer();

    const timeMs = Date.now() - questionStartTime.current;
    const currentQ = qs[stateSnap.currentQuestion];
    const correct = chosenId !== null && chosenId === currentQ.correctId;

    recordEvent({
      type: 'answer', signId: currentQ.sign.id, correct, streak: correct ? stateSnap.streak + 1 : 0,
      pickedId: !correct && chosenId ? chosenId : undefined,
      otherIds: correct ? currentQ.options.filter(o => o.id !== currentQ.correctId).map(o => o.id) : undefined,
    });

    // Audio feedback — streaks get the rising combo chime
    if (correct) {
      if (streakBonus(stateSnap.streak + 1) > 0) playCombo(stateSnap.streak + 1);
      else playCorrect();
    } else {
      playWrong();
    }

    setSelectedAnswer(chosenId);
    setShowFeedback(true);

    setState(prev => {
      const newStreak = correct ? prev.streak + 1 : 0;
      const scoreIncrement = correct
        ? (prev.difficulty === 'easy' ? 10 : prev.difficulty === 'hard' ? 20 : 15) + streakBonus(newStreak)
        : 0;
      return {
        ...prev,
        score: prev.score + scoreIncrement,
        streak: newStreak,
        maxStreak: Math.max(prev.maxStreak, newStreak),
        answers: [...prev.answers, {
          questionIndex: prev.currentQuestion,
          signId: currentQ.sign.id,
          chosenId: chosenId ?? '',
          correct,
          timeMs,
        }],
      };
    });

    advanceTimeoutRef.current = setTimeout(advanceQuestion, 1600);
  }, [advanceQuestion, clearTimer, playCorrect, playWrong, playCombo]);

  // Per-question countdown
  const startTimer = useCallback((stateSnap: GameState, qs: Question[]) => {
    clearTimer();
    setTimeLeft(TIMER_SECONDS);
    feedbackRef.current = false;

    let remaining = TIMER_SECONDS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimeLeft(remaining);
      playTick(remaining <= 3);
      if (remaining <= 0) {
        clearTimer();
        processAnswer(null, stateSnap, qs);
      }
    }, 1000);
  }, [processAnswer, clearTimer, playTick]);

  useEffect(() => {
    if (state.phase !== 'playing') return;
    startTimer(state, questions);
    return clearTimer;
  }, [state.phase, state.currentQuestion, startTimer, questions, clearTimer]); // Added startTimer, questions, clearTimer

  useEffect(() => () => {
    clearTimer();
    clearAdvanceTimeout();
  }, [clearTimer, clearAdvanceTimeout]);

  const startGame = useCallback((category: SignCategory | 'all' = 'all', difficulty: 'easy' | 'medium' | 'hard' = 'medium', signPool?: TrafficSign[]) => {
    clearAdvanceTimeout();
    const qs = buildQuestions(category, signPool);
    setQuestions(qs);
    setSelectedAnswer(null);
    setEliminated([]);
    setShowFeedback(false);
    feedbackRef.current = false;
    setTimeLeft(TIMER_SECONDS);
    questionStartTime.current = Date.now();
    setState({
      ...initialState,
      phase: 'playing',
      selectedCategory: category,
      difficulty,
      totalQuestions: qs.length,
    });
  }, [clearAdvanceTimeout]);

  const answerQuestion = useCallback((chosenId: string) => {
    if (feedbackRef.current) return;
    processAnswer(chosenId, state, questions);
  }, [state, questions, processAnswer]);

  /** 50/50 lifeline: hide two wrong options for the current question. */
  const fiftyFifty = useCallback(() => {
    if (feedbackRef.current || state.lifelines <= 0 || eliminated.length > 0) return;
    const q = questions[state.currentQuestion];
    if (!q) return;
    const wrong = q.options.filter(o => o.id !== q.correctId);
    setEliminated(shuffle(wrong).slice(0, 2).map(o => o.id));
    setState(prev => ({ ...prev, lifelines: prev.lifelines - 1 }));
  }, [state.lifelines, state.currentQuestion, eliminated.length, questions]);

  const resetGame = useCallback(() => {
    clearTimer();
    clearAdvanceTimeout();
    setState(initialState);
    setQuestions([]);
    setSelectedAnswer(null);
    setEliminated([]);
    setShowFeedback(false);
    feedbackRef.current = false;
    setTimeLeft(TIMER_SECONDS);
  }, [clearTimer, clearAdvanceTimeout]);

  const currentQuestion = questions[state.currentQuestion] ?? null;

  return {
    state,
    currentQuestion,
    selectedAnswer,
    showFeedback,
    timeLeft,
    eliminated,
    startGame,
    answerQuestion,
    fiftyFifty,
    resetGame,
  };
}
