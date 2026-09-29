
/**
 * BLITZ GAME — بليتز
 * A sign flashes with a name. Tap ✓ (correct) or ✗ (wrong) to judge if they match.
 * 20 rounds, 2.5s per round. Combo multiplier builds with consecutive correct answers.
 * Mistakes cost a life (3 lives). Lose all lives = game over early.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { Language, TrafficSign, SignCategory } from '@/types/game';
import { t } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import { Home, Heart, Zap, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import Confetti from './Confetti';
import XpChip from './XpChip';
import { useFinishGame } from '@/hooks/usePlayer';
import { recordEvent } from '@/lib/progress';
import { useAudio } from '@/hooks/useAudio';

const ROUND_SECONDS = 2.5;
const TOTAL_ROUNDS  = 20;
const MAX_LIVES     = 3;

interface BlitzRound {
  sign: TrafficSign;
  shownName: string;
  shownNameAr: string;
  isMatch: boolean; // true if shownName == sign.name
}

const MIN_POOL = 6;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRounds(category: SignCategory | 'all'): BlitzRound[] {
  const pool = category === 'all' ? [...TRAFFIC_SIGNS] : TRAFFIC_SIGNS.filter(s => s.category === category);
  // A small category (e.g. 5 plates) keeps all its signs and is topped up with other signs
  if (pool.length < MIN_POOL) {
    const extra = shuffle(TRAFFIC_SIGNS.filter(s => !pool.includes(s)));
    pool.push(...extra.slice(0, MIN_POOL - pool.length));
  }
  const rounds: BlitzRound[] = [];
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const sign = pool[Math.floor(Math.random() * pool.length)];
    const useCorrect = Math.random() > 0.45; // 55% correct names
    let shownName = sign.name;
    let shownNameAr = sign.nameAr;
    if (!useCorrect) {
      const other = pool.filter(s => s.id !== sign.id)[Math.floor(Math.random() * (pool.length - 1))];
      shownName = other.name;
      shownNameAr = other.nameAr;
    }
    rounds.push({ sign, shownName, shownNameAr, isMatch: shownName === sign.name });
  }
  return rounds;
}

interface BlitzGameProps {
  lang: Language;
  category: SignCategory | 'all';
  onHome: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}

type Phase = 'intro' | 'playing' | 'result';
type Feedback = 'correct' | 'wrong' | null;

const COMBO_THRESHOLDS = [
  { min: 6, mult: 4, color: 'text-purple-400', label: '×4' },
  { min: 4, mult: 3, color: 'text-red-400',    label: '×3' },
  { min: 2, mult: 2, color: 'text-orange-400', label: '×2' },
  { min: 0, mult: 1, color: 'text-slate-400',  label: '×1' },
];

function getCombo(streak: number) {
  return COMBO_THRESHOLDS.find(c => streak >= c.min) ?? COMBO_THRESHOLDS[3];
}

export default function BlitzGame({ lang, category, onHome, muted = false, onToggleMute }: BlitzGameProps) {
  const [phase, setPhase]         = useState<Phase>('intro');
  const [rounds, setRounds]       = useState<BlitzRound[]>(() => buildRounds(category));
  const [current, setCurrent]     = useState(0);
  const [lives, setLives]         = useState(MAX_LIVES);
  const [score, setScore]         = useState(0);
  const [streak, setStreak]       = useState(0);
  const [feedback, setFeedback]   = useState<Feedback>(null);
  const [timeLeft, setTimeLeft]   = useState(ROUND_SECONDS);
  const [results, setResults]     = useState<boolean[]>([]);
  const [answered, setAnswered]   = useState(false);
  const [flashClass, setFlashClass] = useState('');

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef  = useRef<number>(0);
  const { playCorrect, playWrong } = useAudio(muted);
  const isRtl = lang === 'ar';

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const restartGame = useCallback(() => {
    setRounds(buildRounds(category));
    setCurrent(0);
    setLives(MAX_LIVES);
    setScore(0);
    setStreak(0);
    setFeedback(null);
    setTimeLeft(ROUND_SECONDS);
    setResults([]);
    setAnswered(false);
    setFlashClass('');
    setPhase('playing');
  }, [category]);

  const finishGame = useCallback(() => {
    clearTimer();
    setPhase('result');
  }, [clearTimer]);

  const nextRound = useCallback((wasCorrect: boolean, currentLives: number, currentScore: number, currentStreak: number, currentResults: boolean[]) => {
    const next = current + 1;
    const newResults = [...currentResults, wasCorrect];

    if (next >= TOTAL_ROUNDS || currentLives <= 0) {
      setResults(newResults);
      setTimeout(finishGame, 600);
      return;
    }

    setTimeout(() => {
      setCurrent(next);
      setAnswered(false);
      setFeedback(null);
      setTimeLeft(ROUND_SECONDS);
      startRef.current = Date.now();
    }, 700);
    setResults(newResults);
  }, [current, finishGame]);

  const handleAnswer = useCallback((playerSaysMatch: boolean) => {
    if (answered || phase !== 'playing') return;
    clearTimer();
    setAnswered(true);

    const round = rounds[current];
    const correct = playerSaysMatch === round.isMatch;
    recordEvent({ type: 'answer', signId: round.sign.id, correct });
    const combo = getCombo(streak);
    const pts = correct ? 10 * combo.mult : 0;

    if (correct) {
      playCorrect();
      setScore(s => s + pts);
      setStreak(s => s + 1);
      setFeedback('correct');
      setFlashClass('bg-emerald-500/20');
    } else {
      playWrong();
      setLives(l => {
        const newLives = l - 1;
        setStreak(0);
        setFeedback('wrong');
        setFlashClass('bg-red-500/20');
        nextRound(false, newLives, score, streak, results);
        return newLives;
      });
      return;
    }

    nextRound(correct, lives, score + pts, correct ? streak + 1 : 0, results);
  }, [answered, phase, rounds, current, streak, lives, score, results, clearTimer, playCorrect, playWrong, nextRound]);

  // Auto-advance (time out = wrong)
  useEffect(() => {
    if (phase !== 'playing' || answered) return;
    startRef.current = Date.now();
    setTimeLeft(ROUND_SECONDS);
    clearTimer();

    const tick = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, ROUND_SECONDS - elapsed);
      setTimeLeft(left);
      if (left <= 0) {
        clearTimer();
        handleAnswer(false); // treat as wrong answer on timeout
      }
    }, 100);
    timerRef.current = tick;
    return clearTimer;
  }, [phase, current, answered, clearTimer, handleAnswer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (flashClass) {
      const id = setTimeout(() => setFlashClass(''), 400);
      return () => clearTimeout(id);
    }
  }, [flashClass]);

  const earned = useFinishGame(phase === 'result', {
    mode: 'blitz',
    xp: Math.round(score / 2) + 15,
    correct: results.filter(Boolean).length,
    total: results.length,
  });

  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-6 w-20 h-20 rounded-full bg-yellow-500/20 border-2 border-yellow-500/40 flex items-center justify-center">
          <Zap className="w-10 h-10 text-yellow-400" />
        </div>
        <h1 className="text-4xl font-display font-extrabold text-[hsl(var(--foreground))] mb-2">
          {lang === 'sv' ? 'Blitz!' : lang === 'en' ? 'Blitz!' : 'بليتز!'}
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-2 max-w-xs">
          {lang === 'en'
            ? 'A sign and a name appear. Do they match? Tap ✓ or ✗ fast!'
            : lang === 'sv'
            ? 'En skylt och ett namn visas. Stämmer de överens? Tryck ✓ eller ✗ snabbt!'
            : 'تظهر إشارة واسم. هل يتطابقان؟ اضغط ✓ أو ✗ بسرعة!'}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mb-8">
          {lang === 'en'
            ? `${TOTAL_ROUNDS} rounds · ${ROUND_SECONDS}s per round · 3 lives`
            : lang === 'sv'
            ? `${TOTAL_ROUNDS} omgångar · ${ROUND_SECONDS}s per omgång · 3 liv`
            : `${TOTAL_ROUNDS} جولة · ${ROUND_SECONDS} ثانية لكل جولة · 3 أرواح`}
        </p>

        {/* Combo info */}
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs mb-8">
          {COMBO_THRESHOLDS.slice(0,3).reverse().map(c => (
            <div key={c.mult} className="p-2.5 rounded-xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] text-center">
              <span className={cn('text-lg font-black', c.color)}>{c.label}</span>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                {lang === 'en'
                  ? `×${c.mult} at ${c.min}+ correct in a row`
                  : lang === 'sv'
                  ? `×${c.mult} vid ${c.min}+ rätt i rad`
                  : `×${c.mult} عند ${c.min}+ صح متتالية`}
              </p>
            </div>
          ))}
          <div className="p-2.5 rounded-xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] text-center">
            <span className="text-lg font-black text-red-400">❤️❤️❤️</span>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
              {lang === 'en' ? '3 lives — be careful!'
              : lang === 'sv' ? '3 liv — var försiktig!'
              : '3 أرواح — كن حذراً!'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setPhase('playing')}
          className="w-full max-w-xs py-4 rounded-2xl btn-hue hue-yellow font-display font-extrabold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Zap className="w-5 h-5" />
          {lang === 'sv' ? 'Starta Blitz!' : lang === 'en' ? 'Start Blitz!' : 'ابدأ البليتز!'}
        </button>

        <button onClick={onHome} className="mt-4 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1">
          <Home className="w-3.5 h-3.5" />
          {t(lang, 'home')}
        </button>
      </div>
    );
  }

  if (phase === 'result') {
    const correctCount = results.filter(Boolean).length;
    const pct = Math.round((correctCount / TOTAL_ROUNDS) * 100);
    const completed = results.length;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-6xl mb-4">{pct >= 80 ? '⚡' : pct >= 60 ? '🎯' : '📚'}</div>
        <h1 className="text-3xl font-display font-extrabold text-[hsl(var(--foreground))] mb-1">
          {pct >= 80
            ? (lang === 'en' ? 'Blazing fast!' : lang === 'sv' ? 'Blixtrande bra!' : 'رائع كالبرق!')
            : pct >= 60
            ? (lang === 'en' ? 'Good job!' : lang === 'sv' ? 'Bra jobbat!' : 'عمل رائع!')
            : (lang === 'en' ? 'Keep practising!' : lang === 'sv' ? 'Fortsätt träna!' : 'استمر في التدريب!')}
        </h1>
        <div className="mt-3"><XpChip earned={earned} lang={lang} /></div>
        {pct >= 60 && <Confetti />}

        <div className="grid grid-cols-3 gap-3 w-full max-w-xs mt-6 mb-8">
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-2xl font-black text-yellow-400">{score}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'score')}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-2xl font-black text-emerald-400">{correctCount}/{completed}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'correct')}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-2xl font-black text-purple-400">{pct}%</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{lang === 'sv' ? 'Rätt' : lang === 'en' ? 'Accuracy' : 'دقة'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={restartGame}
            className="py-3.5 rounded-2xl btn-hue hue-yellow font-display font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {lang === 'sv' ? 'Spela igen' : lang === 'en' ? 'Play again' : 'العب مجدداً'}
          </button>
          <button
            onClick={onHome}
            className="py-3 rounded-2xl border-2 border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] text-[hsl(var(--foreground))] font-semibold hover:border-[hsl(var(--option-hover-border))] transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            {t(lang, 'home')}
          </button>
        </div>
      </div>
    );
  }

  // Playing phase
  const round = rounds[current];
  const combo = getCombo(streak);
  const progressPct = (current / TOTAL_ROUNDS) * 100;
  const timePct = (timeLeft / ROUND_SECONDS) * 100;
  const isUrgent = timeLeft < 1;

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col transition-colors duration-300',
        flashClass || 'bg-transparent',
      )}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onHome} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            {t(lang, 'exit')}
          </button>

          {/* Lives */}
          <div className="flex gap-1">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <Heart key={i} className={cn('w-5 h-5', i < lives ? 'text-red-400 fill-red-400' : 'text-slate-700 fill-slate-700')} />
            ))}
          </div>

          {/* Combo badge + mute */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'px-2.5 py-1 rounded-full border text-xs font-black transition-all',
              streak >= 4 ? 'bg-purple-500/20 border-purple-500/50' :
              streak >= 2 ? 'bg-orange-500/20 border-orange-500/40' :
              'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))]'
            )}>
              <span className={combo.color}>{combo.label}</span>
            </div>
            {onToggleMute && (
              <button
                onClick={onToggleMute}
                className="w-7 h-7 rounded-lg bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center text-xs hover:border-[hsl(var(--option-hover-border))] transition-colors"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >{muted ? '🔇' : '🔊'}</button>
            )}
          </div>
        </div>

        {/* Score + round */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-black text-yellow-400 text-lg tabular-nums">{score} pts</span>
          <span dir="ltr" className="text-xs text-[hsl(var(--muted-foreground))]">{current + 1} / {TOTAL_ROUNDS}</span>
        </div>

        {/* Round progress */}
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-1">
          <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Timer bar */}
        <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isUrgent ? 'bg-red-500' : timePct > 50 ? 'bg-emerald-500' : 'bg-amber-500',
            )}
            style={{ width: `${timePct}%`, transition: 'width 0.1s linear' }}
          />
        </div>
      </div>

      {/* Main card */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6 max-w-lg mx-auto w-full">
        {/* Sign */}
        <div className={cn(
          'p-6 rounded-3xl border-2 mb-5 bg-[hsl(var(--option-bg))] transition-all duration-300',
          feedback === 'correct' ? 'border-emerald-500/60' :
          feedback === 'wrong' ? 'border-red-500/50' :
          'border-[hsl(var(--option-border))]',
        )}>
          <SignDisplay sign={round.sign} size="lg" />
        </div>

        {/* Shown name */}
        <div className="text-center mb-8 px-4">
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1 uppercase tracking-widest">
            {lang === 'en' ? 'Is this the right name?' : lang === 'sv' ? 'Är detta rätt namn?' : 'هل هذا الاسم صحيح؟'}
          </p>
          <p className={cn(
            'text-xl font-bold leading-snug transition-colors',
            feedback === 'correct' ? 'text-emerald-400' :
            feedback === 'wrong' ? 'text-red-400' :
            'text-[hsl(var(--foreground))]',
          )}>
            {lang === 'ar' ? round.shownNameAr : round.shownName}
          </p>
          {lang === 'ar' && (
            <p dir="ltr" className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{round.shownName}</p>
          )}
          {feedback && (
            <p className="text-sm mt-1.5 font-semibold">
              {round.isMatch
                ? <span className="text-emerald-400">✓ {lang === 'en' ? 'Yes, correct!' : lang === 'sv' ? 'Ja, stämmer!' : 'نعم، صحيح!'}</span>
                : <span className="text-red-400">✗ {lang === 'en' ? `Wrong — correct: ${round.sign.name}` : lang === 'sv' ? `Fel — rätt: ${round.sign.name}` : `خطأ — الصحيح: ${round.sign.nameAr}`}</span>
              }
            </p>
          )}
        </div>

        {/* Answer buttons */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          <button
            onClick={() => handleAnswer(false)}
            disabled={answered}
            className={cn(
              'py-5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all active:scale-95 select-none',
              answered
                ? 'border-slate-700 bg-slate-800/50 opacity-60 cursor-not-allowed'
                : 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400 cursor-pointer',
            )}
          >
            <span className="text-3xl">✗</span>
            <span className="text-xs font-bold text-red-400">{lang === 'en' ? 'Wrong' : lang === 'sv' ? 'Fel' : 'خطأ'}</span>
          </button>
          <button
            onClick={() => handleAnswer(true)}
            disabled={answered}
            className={cn(
              'py-5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all active:scale-95 select-none',
              answered
                ? 'border-slate-700 bg-slate-800/50 opacity-60 cursor-not-allowed'
                : 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-400 cursor-pointer',
            )}
          >
            <span className="text-3xl">✓</span>
            <span className="text-xs font-bold text-emerald-400">{lang === 'en' ? 'Correct' : lang === 'sv' ? 'Stämmer' : 'صحيح'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
