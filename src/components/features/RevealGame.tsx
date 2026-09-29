/**
 * REVEAL — كشف الإشارة / Avslöja
 * A sign starts blurred and zoomed in, and clears over 8 seconds. Tap its name as early
 * as you can: the sooner the right answer, the more points (100 down to 10). 10 rounds.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { Language, SignCategory, TrafficSign } from '@/types/game';
import { t } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import { Home, ScanEye, RotateCcw, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import Confetti from './Confetti';
import XpChip from './XpChip';
import { useFinishGame } from '@/hooks/usePlayer';
import { streakBonus } from '@/hooks/useGame';
import { recordEvent } from '@/lib/progress';
import { useAudio } from '@/hooks/useAudio';
import { buildChoices, REVEAL_MS, revealLook, revealPoints, shuffle, signPool } from '@/lib/gameLogic';
import { signDescription, signName, signNameSecondary } from '@/lib/signName';

const TOTAL_ROUNDS = 10;
const MIN_POOL = 6;
const BEST_KEY = 'vq-reveal-best';

interface RevealRound {
  sign: TrafficSign;
  choices: TrafficSign[];
}

function buildRounds(category: SignCategory | 'all'): RevealRound[] {
  const pool = signPool(TRAFFIC_SIGNS, category, MIN_POOL);
  // Wrong choices come from every sign, so a small category still gets four names to pick from
  return shuffle(pool).slice(0, TOTAL_ROUNDS).map(sign => ({ sign, choices: buildChoices(sign, TRAFFIC_SIGNS) }));
}

const readBest = (): number => {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
};
const writeBest = (n: number) => {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
};

interface RevealGameProps {
  lang: Language;
  category: SignCategory | 'all';
  onHome: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}

type Phase = 'intro' | 'playing' | 'result';

export default function RevealGame({ lang, category, onHome, muted = false, onToggleMute }: RevealGameProps) {
  const [phase, setPhase]       = useState<Phase>('intro');
  const [rounds, setRounds]     = useState<RevealRound[]>([]);
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
    setRounds(buildRounds(category));
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

  const answer = useCallback((choiceId: string | null) => {
    if (answeredRef.current || !round) return;
    answeredRef.current = true;
    const ms = Math.min(REVEAL_MS, performance.now() - startRef.current);
    const correct = choiceId === round.sign.id;
    const newStreak = correct ? streak + 1 : 0;
    const points = correct ? revealPoints(ms) + streakBonus(newStreak) : 0;

    setAnswered(true);
    setPicked(choiceId);
    setGained(points);
    setStreak(newStreak);
    setMaxStreak(m => Math.max(m, newStreak));
    setScore(s => s + points);
    if (correct) setCorrectCount(c => c + 1);
    recordEvent({
      type: 'answer', signId: round.sign.id, correct, streak: correct ? newStreak : undefined,
      pickedId: !correct && choiceId ? choiceId : undefined,
      otherIds: correct ? round.choices.filter(c => c.id !== round.sign.id).map(c => c.id) : undefined,
    });
    if (correct) playCorrect(); else playWrong();

    // Enough time to read the name and meaning of a sign that was missed
    advanceRef.current = setTimeout(next, correct ? 1600 : 3200);
  }, [round, streak, next, playCorrect, playWrong]);

  // The clock for the current round: clears the sign and ends the round when it runs out
  useEffect(() => {
    if (phase !== 'playing' || answered || !round) return;
    startRef.current = performance.now();
    const id = setInterval(() => {
      const e = performance.now() - startRef.current;
      if (e >= REVEAL_MS) {
        clearInterval(id);
        setElapsed(REVEAL_MS);
        answer(null);
      } else {
        setElapsed(e);
      }
    }, 60);
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
    mode: 'reveal',
    xp: 20 + Math.round(score / 20),
    correct: correctCount,
    total: rounds.length || TOTAL_ROUNDS,
    maxStreak,
  });

  const title = t(lang, 'modeReveal');

  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-6 w-20 h-20 rounded-full flex items-center justify-center bg-[hsl(228_86%_68%/0.18)] border-2 border-[hsl(228_86%_68%/0.4)]">
          <ScanEye className="w-10 h-10 text-[hsl(228_86%_68%)]" />
        </div>
        <h1 className="text-4xl font-display font-extrabold text-[hsl(var(--foreground))] mb-2">{title}</h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-2 max-w-xs">
          {lang === 'en'
            ? 'The sign is blurred and zoomed in. It gets clearer every second. Tap its name as early as you can — the sooner you answer, the more points you earn.'
            : lang === 'sv'
            ? 'Skylten är suddig och inzoomad. Den blir tydligare för varje sekund. Tryck på rätt namn så tidigt du kan – ju snabbare, desto fler poäng.'
            : 'الإشارة ضبابية ومكبّرة، وتزداد وضوحًا كل ثانية. اضغط على اسمها الصحيح مبكرًا قدر استطاعتك، فكلما أجبت أسرع حصلت على نقاط أكثر.'}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mb-8">
          {lang === 'en' ? '10 signs · up to 100 points each'
          : lang === 'sv' ? '10 skyltar · upp till 100 poäng var'
          : '10 إشارات · حتى 100 نقطة لكل إشارة'}
        </p>

        {/* Preview: the same badge sharpening in three steps */}
        <div className="flex gap-3 mb-8" aria-hidden="true">
          {[10, 5, 0].map(blur => (
            <div key={blur} className="w-16 h-16 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] overflow-hidden flex items-center justify-center">
              <div style={{ filter: `blur(${blur}px)`, transform: 'scale(0.6)' }}>
                <SignDisplay sign={TRAFFIC_SIGNS.find(s => s.id === 'B2') ?? TRAFFIC_SIGNS[0]} size="md" />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={startGame}
          className="w-full max-w-xs py-4 rounded-2xl btn-hue hue-indigo font-display font-extrabold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <ScanEye className="w-5 h-5" />
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
        <div className="text-6xl mb-4">{ratio >= 0.9 ? '🦅' : ratio >= 0.6 ? '👁️' : '🔍'}</div>
        <h1 className="text-3xl font-display font-extrabold text-[hsl(var(--foreground))] mb-1">
          {ratio >= 0.9
            ? (lang === 'en' ? 'Sharp eyes!' : lang === 'sv' ? 'Skarp blick!' : 'عين حادة!')
            : ratio >= 0.6
            ? (lang === 'en' ? 'Well spotted!' : lang === 'sv' ? 'Bra sett!' : 'ملاحظة جيدة!')
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
            <span className="text-2xl font-black text-[hsl(228_86%_68%)] tabular-nums">{score}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'score')}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span dir="ltr" className="text-2xl font-black text-emerald-400 tabular-nums">{correctCount}/{total}</span>
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
            className="py-3.5 rounded-2xl btn-hue hue-indigo font-display font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
  const look = answered ? { blur: 0, scale: 1 } : revealLook(elapsed);
  const available = answered ? gained : revealPoints(elapsed);
  const wasRight = answered && picked === round.sign.id;
  const secondary = signNameSecondary(round.sign, lang);

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
            <span dir="ltr" className="text-xs font-bold text-[hsl(228_86%_68%)] tabular-nums">{index + 1}/{rounds.length}</span>
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
            <span className="text-sm font-black text-[hsl(228_86%_68%)] tabular-nums">{score}</span>
          </div>
          {streak >= 2 && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-sm font-black text-orange-400 tabular-nums">{streak}</span>
            </div>
          )}
        </div>

        <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(228_86%_68%)] to-sky-400"
            style={{ width: `${Math.min(100, (answered ? REVEAL_MS : elapsed) / REVEAL_MS * 100)}%` }}
          />
        </div>
      </div>

      {/* The sign, blurred until it clears (hidden from screen readers: its alt text is its name) */}
      <div className="px-4 max-w-lg mx-auto w-full">
        <div
          role="img"
          aria-label={lang === 'en' ? 'A sign that is gradually becoming clear' : lang === 'sv' ? 'En skylt som gradvis blir tydlig' : 'إشارة تزداد وضوحًا تدريجيًا'}
          className="relative mx-auto w-[min(70vw,260px)] aspect-square rounded-3xl overflow-hidden bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center"
        >
          <div
            aria-hidden="true"
            style={{
              filter: `blur(${look.blur}px)`,
              transform: `scale(${look.scale})`,
              transition: answered ? 'filter 0.35s ease-out, transform 0.35s ease-out' : 'none',
            }}
          >
            <SignDisplay sign={round.sign} size="lg" />
          </div>
        </div>

        <div className="flex justify-center mt-3 h-9">
          <span
            key={answered ? 'gain' : 'live'}
            className={cn(
              'inline-flex items-center px-4 py-1.5 rounded-full font-display font-black text-lg tabular-nums',
              !answered && 'bg-[hsl(228_86%_68%/0.15)] text-[hsl(228_86%_72%)]',
              answered && wasRight && 'pop-in bg-emerald-500/20 text-emerald-300',
              answered && !wasRight && 'bg-rose-500/15 text-rose-300',
            )}
          >
            <span dir="ltr">+{available}</span>
          </span>
        </div>
      </div>

      {/* Names to choose from */}
      <div className="px-4 pb-6 pt-2 max-w-lg mx-auto w-full flex flex-col gap-2.5">
        {round.choices.map(choice => {
          const isAnswer = choice.id === round.sign.id;
          const isPicked = picked === choice.id;
          const sub = signNameSecondary(choice, lang);
          return (
            <button
              key={choice.id}
              onClick={() => answer(choice.id)}
              disabled={answered}
              className={cn(
                'w-full text-start px-4 py-3 rounded-2xl border-2 transition-all duration-200 min-h-[56px]',
                !answered && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] hover:border-[hsl(var(--option-hover-border))] active:scale-[0.98]',
                answered && isAnswer && 'bg-emerald-500/15 border-emerald-500/60',
                answered && isPicked && !isAnswer && 'bg-rose-500/15 border-rose-500/60',
                answered && !isAnswer && !isPicked && 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] opacity-50',
              )}
            >
              <span className="block text-sm font-bold leading-snug text-[hsl(var(--foreground))]">{signName(choice, lang)}</span>
              {sub && <bdi dir="ltr" className="block text-xs font-medium opacity-70 mt-0.5 text-start">{sub}</bdi>}
            </button>
          );
        })}

        {answered && (
          <div className="mt-1 rounded-2xl border border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] px-4 py-3" aria-live="polite">
            <p className={cn('text-sm font-display font-extrabold mb-1', wasRight ? 'text-emerald-300' : 'text-rose-300')}>
              {wasRight
                ? (lang === 'en' ? 'Correct!' : lang === 'sv' ? 'Rätt!' : 'صحيح!')
                : picked === null
                ? (lang === 'en' ? "Time's up" : lang === 'sv' ? 'Tiden är slut' : 'انتهى الوقت')
                : (lang === 'en' ? 'Not quite' : lang === 'sv' ? 'Inte riktigt' : 'ليست صحيحة')}
              {!wasRight && <span className="font-semibold text-[hsl(var(--foreground))]"> · {signName(round.sign, lang)}</span>}
            </p>
            {!wasRight && secondary && <bdi dir="ltr" className="block text-xs opacity-70 mb-1">{secondary}</bdi>}
            <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{signDescription(round.sign, lang)}</p>
            <button
              onClick={next}
              className="mt-3 w-full py-2.5 rounded-xl btn-hue hue-indigo font-display font-bold text-sm active:scale-[0.98] transition-all"
            >
              {index + 1 >= rounds.length
                ? (lang === 'en' ? 'Results' : lang === 'sv' ? 'Resultat' : 'النتيجة')
                : (lang === 'en' ? 'Next' : lang === 'sv' ? 'Nästa' : 'التالي')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
