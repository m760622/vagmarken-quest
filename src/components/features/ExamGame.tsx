/**
 * MOCK EXAM — 50 sign questions against a clock, no feedback until the end.
 * Passing needs PASS_PCT% or more. Answers still feed the mistakes list, XP and badges.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ClipboardCheck, Clock, Home, RotateCcw, XCircle } from 'lucide-react';
import { Language, TrafficSign } from '@/types/game';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { t } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import AnswerOptions from './AnswerOptions';
import Confetti from './Confetti';
import XpChip from './XpChip';
import { useFinishGame } from '@/hooks/usePlayer';
import { recordEvent } from '@/lib/progress';
import { cn } from '@/lib/utils';

const EXAM_QUESTIONS = 50;
const EXAM_MINUTES = 25;
const EXAM_SECONDS = EXAM_MINUTES * 60;
const PASS_PCT = 80;
/** How long the tapped answer stays highlighted before the next question (confirms the tap, no verdict). */
const PICK_FLASH_MS = 250;

interface ExamQuestion { sign: TrafficSign; options: TrafficSign[] }
type Phase = 'intro' | 'playing' | 'result';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wrong options prefer the same sign family, so the choices look alike (like the real thing). */
function buildExam(): ExamQuestion[] {
  const targets = shuffle(TRAFFIC_SIGNS).slice(0, Math.min(EXAM_QUESTIONS, TRAFFIC_SIGNS.length));
  return targets.map(sign => {
    const others = TRAFFIC_SIGNS.filter(s => s.id !== sign.id);
    const same = shuffle(others.filter(s => s.category === sign.category));
    const rest = shuffle(others.filter(s => s.category !== sign.category));
    const wrong = [...same.slice(0, 2), ...rest.slice(0, 3 - Math.min(2, same.length))];
    return { sign, options: shuffle([sign, ...wrong]) };
  });
}

const mmss = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

interface ExamGameProps {
  lang: Language;
  onHome: () => void;
}

export default function ExamGame({ lang, onHome }: ExamGameProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS);
  const [picked, setPicked] = useState<string | null>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRtl = lang === 'ar';

  const total = questions.length;
  const correctCount = answers.filter((a, i) => a === questions[i]?.sign.id).length;
  const pct = total ? Math.round((correctCount / total) * 100) : 0;
  const passed = pct >= PASS_PCT;
  const earned = useFinishGame(phase === 'result', {
    mode: 'exam',
    xp: 30 + correctCount * 2 + (passed ? 30 : 0),
    correct: correctCount,
    total,
  });

  // Clock: one tick per second while playing; time's up ends the exam
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => {
    if (phase === 'playing' && secondsLeft <= 0) setPhase('result');
  }, [phase, secondsLeft]);

  // A pending "next question" must not outlive the screen
  useEffect(() => () => { if (pickTimer.current) clearTimeout(pickTimer.current); }, []);

  const start = () => {
    setQuestions(buildExam());
    setIndex(0);
    setAnswers([]);
    setSecondsLeft(EXAM_SECONDS);
    setPicked(null);
    setPhase('playing');
  };

  const choose = (id: string) => {
    if (picked !== null) return; // one answer per question
    const q = questions[index];
    recordEvent({ type: 'answer', signId: q.sign.id, correct: id === q.sign.id });
    setPicked(id);
    pickTimer.current = setTimeout(() => {
      setPicked(null);
      setAnswers(a => [...a, id]);
      if (index + 1 >= questions.length) setPhase('result');
      else setIndex(i => i + 1);
    }, PICK_FLASH_MS);
  };

  const nameOf = (s: TrafficSign) => (lang === 'ar' ? s.nameAr : lang === 'en' ? s.nameEn : s.name);

  /* ── Intro ─────────────────────────────────────────────────────── */
  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-6 w-20 h-20 rounded-full bg-lime-400/15 border-2 border-lime-400/40 flex items-center justify-center">
          <ClipboardCheck className="w-9 h-9 text-lime-300" />
        </div>
        <h1 className="text-4xl font-display font-extrabold text-[hsl(var(--foreground))] mb-2">{t(lang, 'modeExam')}</h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm max-w-xs mb-8 leading-relaxed">
          {t(lang, 'examIntro', { n: Math.min(EXAM_QUESTIONS, TRAFFIC_SIGNS.length), m: EXAM_MINUTES, p: PASS_PCT })}
        </p>
        <button
          onClick={start}
          className="w-full max-w-xs py-4 rounded-2xl btn-hue font-display font-extrabold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ '--hue': '84 78% 55%' } as CSSProperties}
        >
          <ClipboardCheck className="w-5 h-5" />
          {t(lang, 'examStart')}
        </button>
        <button onClick={onHome} className="mt-4 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1">
          <Home className="w-3.5 h-3.5" /> {t(lang, 'home')}
        </button>
      </div>
    );
  }

  /* ── Playing ───────────────────────────────────────────────────── */
  if (phase === 'playing') {
    const q = questions[index];
    if (!q) return null;
    const low = secondsLeft <= 180;
    return (
      <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="px-4 pt-6 pb-3 max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onHome}
              className="text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors px-3 py-1.5 rounded-lg glass"
            >
              {t(lang, 'exit')}
            </button>
            <span dir="ltr" className={cn('flex items-center gap-1.5 font-display font-extrabold tabular-nums text-lg', low ? 'text-red-400 animate-pulse' : 'text-[hsl(var(--foreground))]')}>
              <Clock className="w-4 h-4" /> {mmss(secondsLeft)}
            </span>
            <span dir="ltr" className="text-xs font-bold tabular-nums text-[hsl(var(--muted-foreground))]">{index + 1} / {total}</span>
          </div>
          <div className="h-2 rounded-full bg-[hsl(var(--foreground))]/10 overflow-hidden">
            <div className="h-full rounded-full bg-brand-gradient transition-all duration-300" style={{ width: `${(index / total) * 100}%` }} />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center px-4 pb-8 max-w-2xl mx-auto w-full">
          <div className="glass p-6 rounded-[32px] my-4">
            <SignDisplay sign={q.sign} size="lg" />
          </div>
          <p className="font-display text-lg font-bold text-[hsl(var(--foreground))] text-center mb-4">{t(lang, 'question')}</p>
          <AnswerOptions
            key={index}
            options={q.options}
            correctId={q.sign.id}
            selectedId={picked}
            showFeedback={false}
            onSelect={choose}
            lang={lang}
          />
        </div>
      </div>
    );
  }

  /* ── Result ────────────────────────────────────────────────────── */
  const missed = questions
    .map((q, i) => ({ q, chosen: answers[i] as string | undefined }))
    .filter(x => x.chosen !== x.q.sign.id);
  const timeUp = answers.length < total;

  return (
    <div className="min-h-screen px-4 py-8 flex flex-col items-center max-w-2xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      {passed && <Confetti />}
      <div className={cn(
        'w-24 h-24 rounded-full grid place-items-center text-5xl mb-4 border-2',
        passed ? 'bg-emerald-500/15 border-emerald-400/60' : 'bg-rose-500/10 border-rose-400/50',
      )} aria-hidden="true">
        {passed ? '🎓' : '📚'}
      </div>
      <h1 className={cn('font-display text-3xl font-extrabold mb-1', passed ? 'text-brand-gradient' : 'text-[hsl(var(--foreground))]')}>
        {passed ? t(lang, 'examPassed') : t(lang, 'examFailed')}
      </h1>
      {timeUp && <p className="text-sm text-amber-400 font-semibold">{t(lang, 'examTimeUp')}</p>}
      <div className="mt-2 mb-1"><XpChip earned={earned} lang={lang} /></div>

      <div className="grid grid-cols-3 gap-3 w-full mt-6 mb-6">
        <div className="glass flex flex-col items-center p-4 rounded-2xl">
          <span dir="ltr" className="font-display text-2xl font-extrabold text-[hsl(var(--foreground))]">{correctCount}/{total}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'correct')}</span>
        </div>
        <div className="glass flex flex-col items-center p-4 rounded-2xl">
          <span dir="ltr" className={cn('font-display text-2xl font-extrabold', passed ? 'text-emerald-400' : 'text-rose-400')}>{pct}%</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'examPassMark', { p: PASS_PCT })}</span>
        </div>
        <div className="glass flex flex-col items-center p-4 rounded-2xl">
          <span dir="ltr" className="font-display text-2xl font-extrabold text-[hsl(var(--foreground))]">{mmss(EXAM_SECONDS - Math.max(0, secondsLeft))}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'time')}</span>
        </div>
      </div>

      {missed.length > 0 && (
        <div className="w-full mb-8">
          <h2 className="font-display text-[15px] font-bold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2.5">
            <span className="w-1.5 h-4 rounded-full bg-brand-gradient" />
            {t(lang, 'examWrong')} ({missed.length})
          </h2>
          <div className="space-y-2">
            {missed.map(({ q, chosen }, i) => {
              const picked = chosen ? TRAFFIC_SIGNS.find(s => s.id === chosen) : undefined;
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-red-500/30 bg-red-500/5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden glass flex items-center justify-center">
                    <SignDisplay sign={q.sign} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-tight">{nameOf(q.sign)}</p>
                    <p className="text-xs text-red-400 mt-0.5 truncate">
                      {picked ? `${t(lang, 'yourAnswer')} ${nameOf(picked)}` : t(lang, 'examUnanswered')}
                    </p>
                  </div>
                  <XCircle className="flex-shrink-0 w-5 h-5 text-red-500" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="w-full grid grid-cols-2 gap-3">
        <button onClick={onHome} className="glass flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[hsl(var(--foreground))] font-display font-bold active:scale-[0.98] transition-all">
          <Home className="w-4 h-4" /> {t(lang, 'home')}
        </button>
        <button onClick={start} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-gradient text-[hsl(var(--primary-foreground))] font-display font-bold shadow-glow hover:brightness-110 active:scale-[0.98] transition-all">
          <RotateCcw className="w-4 h-4" /> {t(lang, 'playAgain')}
        </button>
      </div>
    </div>
  );
}
