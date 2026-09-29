/**
 * ODD ONE OUT — الدخيل / Udda skylt
 * Four signs: three belong to one category, one does not. Tap the odd one before the
 * 10 seconds run out. Later rounds are trickier: the odd sign has the same shape as the others,
 * so only its meaning (its category) gives it away. 10 rounds.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { Language, SignCategory } from '@/types/game';
import { CATEGORY_LABELS_I18N, t } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import { Home, Shapes, RotateCcw, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import Confetti from './Confetti';
import XpChip from './XpChip';
import { useFinishGame } from '@/hooks/usePlayer';
import { streakBonus } from '@/hooks/useGame';
import { recordEvent } from '@/lib/progress';
import { useAudio } from '@/hooks/useAudio';
import { buildOddRounds, type OddRound } from '@/lib/gameLogic';
import { signName } from '@/lib/signName';

const TOTAL_ROUNDS = 10;
const ROUND_MS = 10_000;
const BEST_KEY = 'vq-odd-best';
const GREEN = 'hsl(132 68% 50%)';

const readBest = (): number => {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
};
const writeBest = (n: number) => {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
};

interface OddOneOutGameProps {
  lang: Language;
  category: SignCategory | 'all';
  onHome: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}

type Phase = 'intro' | 'playing' | 'result';

export default function OddOneOutGame({ lang, category, onHome, muted = false, onToggleMute }: OddOneOutGameProps) {
  const [phase, setPhase]       = useState<Phase>('intro');
  const [rounds, setRounds]     = useState<OddRound[]>([]);
  const [index, setIndex]       = useState(0);
  const [elapsed, setElapsed]   = useState(0);
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked]     = useState<string | null>(null);
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
  const isRtl = lang === 'ar';
  const round = rounds[index];

  const clearAdvance = useCallback(() => {
    if (advanceRef.current) { clearTimeout(advanceRef.current); advanceRef.current = null; }
  }, []);
  useEffect(() => clearAdvance, [clearAdvance]);

  const startGame = useCallback(() => {
    clearAdvance();
    setRounds(buildOddRounds(TRAFFIC_SIGNS, category, TOTAL_ROUNDS));
    setIndex(0);
    setElapsed(0);
    setAnswered(false);
    answeredRef.current = false;
    setPicked(null);
    setGained(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setNewRecord(false);
    setBest(readBest());
    setPhase('playing');
  }, [category, clearAdvance]);

  const next = useCallback(() => {
    clearAdvance();
    if (index + 1 >= rounds.length) {
      setPhase('result');
      return;
    }
    setIndex(i => i + 1);
    setElapsed(0);
    setAnswered(false);
    answeredRef.current = false;
    setPicked(null);
    setGained(0);
  }, [index, rounds.length, clearAdvance]);

  const answer = useCallback((signId: string | null) => {
    if (answeredRef.current || !round) return;
    answeredRef.current = true;
    const ms = Math.min(ROUND_MS, performance.now() - startRef.current);
    const correct = signId === round.odd.id;
    const newStreak = correct ? streak + 1 : 0;
    const points = correct ? 50 + Math.round(50 * (1 - ms / ROUND_MS)) + streakBonus(newStreak) : 0;

    setAnswered(true);
    setPicked(signId);
    setGained(points);
    setStreak(newStreak);
    setMaxStreak(m => Math.max(m, newStreak));
    setScore(s => s + points);
    if (correct) setCorrectCount(c => c + 1);
    // The sign being judged is the odd one: knowing it belongs elsewhere is what this round teaches
    recordEvent({ type: 'answer', signId: round.odd.id, correct, streak: correct ? newStreak : undefined });
    if (correct) playCorrect(); else playWrong();

    advanceRef.current = setTimeout(next, correct ? 1800 : 3600);
  }, [round, streak, next, playCorrect, playWrong]);

  // The clock for the current round
  useEffect(() => {
    if (phase !== 'playing' || answered || !round) return;
    startRef.current = performance.now();
    const id = setInterval(() => {
      const e = performance.now() - startRef.current;
      if (e >= ROUND_MS) {
        clearInterval(id);
        setElapsed(ROUND_MS);
        answer(null);
      } else {
        setElapsed(e);
      }
    }, 80);
    return () => clearInterval(id);
  }, [phase, index, answered, round, answer]);

  // Personal best, when the game ends (the score no longer changes once the result is showing)
  useEffect(() => {
    if (phase !== 'result') return;
    const previous = readBest();
    setBest(Math.max(previous, score));
    if (score > previous) {
      writeBest(score);
      setNewRecord(previous > 0);
    }
  }, [phase, score]);

  const earned = useFinishGame(phase === 'result', {
    mode: 'odd',
    xp: 20 + Math.round(score / 20),
    correct: correctCount,
    total: rounds.length || TOTAL_ROUNDS,
    maxStreak,
  });

  const title = t(lang, 'modeOdd');
  const labels = CATEGORY_LABELS_I18N[lang];

  if (phase === 'intro') {
    const sample = ['B2', 'A1', 'A2', 'C1'].map(id => TRAFFIC_SIGNS.find(s => s.id === id)).filter(Boolean);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-6 w-20 h-20 rounded-full flex items-center justify-center bg-[hsl(132_68%_50%/0.16)] border-2 border-[hsl(132_68%_50%/0.4)]">
          <Shapes className="w-10 h-10" style={{ color: GREEN }} />
        </div>
        <h1 className="text-4xl font-display font-extrabold text-[hsl(var(--foreground))] mb-2">{title}</h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-2 max-w-xs">
          {lang === 'en'
            ? 'Four signs, three of them belong together. Find the odd one out before time runs out. Later rounds are trickier: the odd sign looks like the others.'
            : lang === 'sv'
            ? 'Fyra skyltar, tre av dem hör ihop. Hitta den udda innan tiden tar slut. Senare rundor är knepigare: den udda skylten liknar de andra.'
            : 'أربع إشارات، ثلاث منها من عائلة واحدة. اكتشف الدخيلة قبل انتهاء الوقت. الجولات الأخيرة أصعب لأن الدخيلة تشبه البقية.'}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mb-8">
          {lang === 'en' ? '10 rounds · 10 seconds each'
          : lang === 'sv' ? '10 rundor · 10 sekunder var'
          : '10 جولات · 10 ثوانٍ لكل جولة'}
        </p>

        <div className="grid grid-cols-4 gap-2 mb-8" aria-hidden="true">
          {sample.map((s, i) => (
            <div key={i} className={cn(
              'w-16 h-16 rounded-2xl bg-[hsl(var(--option-bg))] border overflow-hidden flex items-center justify-center',
              i === 0 ? 'border-[hsl(132_68%_50%/0.7)]' : 'border-[hsl(var(--option-border))]',
            )}>
              <div style={{ transform: 'scale(0.5)' }}><SignDisplay sign={s!} size="md" /></div>
            </div>
          ))}
        </div>

        <button
          onClick={startGame}
          className="w-full max-w-xs py-4 rounded-2xl btn-hue hue-emerald font-display font-extrabold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Shapes className="w-5 h-5" />
          {lang === 'sv' ? 'Starta spelet!' : lang === 'en' ? 'Start game!' : 'ابدأ اللعبة!'}
        </button>

        <button onClick={onHome} className="mt-4 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1">
          <Home className="w-3.5 h-3.5" />
          {t(lang, 'home')}
        </button>
      </div>
    );
  }

  if (phase === 'result') {
    const total = rounds.length || TOTAL_ROUNDS;
    const ratio = correctCount / total;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-6xl mb-4">{ratio >= 0.9 ? '🧩' : ratio >= 0.6 ? '🎯' : '🔎'}</div>
        <h1 className="text-3xl font-display font-extrabold text-[hsl(var(--foreground))] mb-1">
          {ratio >= 0.9
            ? (lang === 'en' ? 'Pattern master!' : lang === 'sv' ? 'Mönstermästare!' : 'خبير التصنيف!')
            : ratio >= 0.6
            ? (lang === 'en' ? 'Good eye!' : lang === 'sv' ? 'Bra öga!' : 'نظرة جيدة!')
            : (lang === 'en' ? 'Keep practising' : lang === 'sv' ? 'Fortsätt öva' : 'واصل التدريب')}
        </h1>
        <div className="mt-2 mb-3"><XpChip earned={earned} lang={lang} /></div>
        {newRecord && (
          <p className="pop-in text-sm font-display font-extrabold text-amber-400 mb-2">
            🏅 {lang === 'en' ? 'New record!' : lang === 'sv' ? 'Nytt rekord!' : 'رقم قياسي جديد!'}
          </p>
        )}
        {ratio >= 0.6 && <Confetti />}

        <div className="grid grid-cols-3 gap-3 w-full max-w-xs my-5">
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-2xl font-black tabular-nums" style={{ color: GREEN }}>{score}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'score')}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span dir="ltr" className="text-2xl font-black text-sky-400 tabular-nums">{correctCount}/{total}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'correct')}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-2xl font-black text-amber-400 tabular-nums">{best}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{lang === 'en' ? 'Best' : lang === 'sv' ? 'Rekord' : 'الأفضل'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="py-3.5 rounded-2xl btn-hue hue-emerald font-display font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {t(lang, 'playAgain')}
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

  // Playing
  if (!round) return null;
  const wasRight = answered && picked === round.odd.id;
  const remaining = Math.max(0, 1 - elapsed / ROUND_MS);

  return (
    <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onHome} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            {t(lang, 'exit')}
          </button>
          <h1 className="text-sm font-display font-bold text-[hsl(var(--foreground))]">{title}</h1>
          <div className="flex items-center gap-1.5">
            <span dir="ltr" className="text-xs font-bold tabular-nums" style={{ color: GREEN }}>{index + 1}/{rounds.length}</span>
            {onToggleMute && (
              <button
                onClick={onToggleMute}
                className="w-7 h-7 rounded-lg bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center text-xs hover:border-[hsl(var(--option-hover-border))] transition-colors"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >{muted ? '🔇' : '🔊'}</button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'score')}:</span>
            <span className="text-sm font-black tabular-nums" style={{ color: GREEN }}>{score}</span>
          </div>
          {streak >= 2 && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-sm font-black text-orange-400 tabular-nums">{streak}</span>
            </div>
          )}
        </div>

        {/* Time left */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.ceil(remaining * 10)}>
          <div
            className={cn('h-full rounded-full', remaining < 0.3 && !answered ? 'bg-rose-400' : 'bg-gradient-to-r from-emerald-400 to-teal-300')}
            style={{ width: `${remaining * 100}%` }}
          />
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto w-full">
        <p className="text-center text-base font-display font-bold text-[hsl(var(--foreground))] mb-3">
          {lang === 'en' ? 'Which sign does not belong?' : lang === 'sv' ? 'Vilken skylt hör inte hit?' : 'أي إشارة لا تنتمي إلى الباقي؟'}
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
          {round.tiles.map(sign => {
            const isOdd = sign.id === round.odd.id;
            const isPicked = picked === sign.id;
            return (
              <button
                key={sign.id}
                onClick={() => answer(sign.id)}
                disabled={answered}
                aria-label={signName(sign, lang)}
                className={cn(
                  'relative rounded-3xl border-2 p-2 flex flex-col items-center justify-center transition-all duration-200 aspect-square',
                  !answered && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] hover:border-[hsl(var(--option-hover-border))] active:scale-[0.97]',
                  answered && isOdd && 'bg-emerald-500/15 border-emerald-500/70',
                  answered && isPicked && !isOdd && 'bg-rose-500/15 border-rose-500/60',
                  answered && !isOdd && !isPicked && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] opacity-60',
                )}
              >
                <SignDisplay sign={sign} size="md" />
                {answered && (
                  <span className="mt-1 text-[11px] leading-tight font-semibold text-[hsl(var(--foreground))] line-clamp-2 text-center">
                    {signName(sign, lang)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center mt-3 h-9">
          {answered && (
            <span
              className={cn(
                'pop-in inline-flex items-center px-4 py-1.5 rounded-full font-display font-black text-lg tabular-nums',
                wasRight ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/15 text-rose-300',
              )}
            >
              <span dir="ltr">+{gained}</span>
            </span>
          )}
        </div>
      </div>

      {answered && (
        <div className="px-4 pb-6 pt-1 max-w-lg mx-auto w-full" aria-live="polite">
          <div className="rounded-2xl border border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] px-4 py-3">
            <p className={cn('text-sm font-display font-extrabold mb-2', wasRight ? 'text-emerald-300' : 'text-rose-300')}>
              {wasRight
                ? (lang === 'en' ? 'Correct!' : lang === 'sv' ? 'Rätt!' : 'صحيح!')
                : picked === null
                ? (lang === 'en' ? "Time's up" : lang === 'sv' ? 'Tiden är slut' : 'انتهى الوقت')
                : (lang === 'en' ? 'Not quite' : lang === 'sv' ? 'Inte riktigt' : 'ليست صحيحة')}
            </p>
            <div className="flex flex-col gap-1.5 text-xs">
              <p className="text-[hsl(var(--muted-foreground))]">
                {lang === 'en' ? 'The other three: ' : lang === 'sv' ? 'De andra tre: ' : 'الثلاث الأخرى: '}
                <span className="font-bold text-[hsl(var(--foreground))]">{labels[round.groupCategory]}</span>
              </p>
              <p className="text-[hsl(var(--muted-foreground))]">
                {lang === 'en' ? 'The odd one: ' : lang === 'sv' ? 'Den udda: ' : 'الدخيلة: '}
                <span className="font-bold" style={{ color: GREEN }}>{labels[round.odd.category]}</span>
              </p>
              {round.hard && (
                <p className="text-[hsl(var(--muted-foreground))]/80">
                  {lang === 'en' ? 'Same shape, different meaning.' : lang === 'sv' ? 'Samma form, annan betydelse.' : 'الشكل نفسه، لكن المعنى مختلف.'}
                </p>
              )}
            </div>
            <button
              onClick={next}
              className="mt-3 w-full py-2.5 rounded-xl btn-hue hue-emerald font-display font-bold text-sm active:scale-[0.98] transition-all"
            >
              {index + 1 >= rounds.length
                ? (lang === 'en' ? 'Results' : lang === 'sv' ? 'Resultat' : 'النتيجة')
                : (lang === 'en' ? 'Next' : lang === 'sv' ? 'Nästa' : 'التالي')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
