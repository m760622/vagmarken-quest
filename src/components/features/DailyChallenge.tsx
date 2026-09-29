/**
 * DAILY CHALLENGE
 * 10 signs seeded from today's ISO date — same for all players on the same day.
 * Seeded PRNG: mulberry32 initialized from the date string's hash.
 */

import { useState, useMemo } from 'react';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { TrafficSign, Language } from '@/types/game';
import { t } from '@/constants/i18n';
import SignDisplay from './SignDisplay';
import { Home, Calendar, Share2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import AnswerName from './AnswerName';
import Confetti from './Confetti';
import XpChip from './XpChip';
import { useFinishGame } from '@/hooks/usePlayer';
import { recordEvent } from '@/lib/progress';
import { useAudio } from '@/hooks/useAudio';
import { useMute } from '@/hooks/useMute';

const DAILY_QUESTIONS = 10;

/* ── Seeded PRNG ─────────────────────────────────────────────────── */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildDailyQuestions(): { sign: TrafficSign; options: TrafficSign[] }[] {
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const rand = mulberry32(hashStr(dateKey));

  // Fisher-Yates with seeded PRNG
  const pool = [...TRAFFIC_SIGNS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = pool.slice(0, DAILY_QUESTIONS);

  return selected.map(sign => {
    const wrongPool = TRAFFIC_SIGNS.filter(s => s.id !== sign.id);
    // Shuffle wrong pool with seeded PRNG
    const wp = [...wrongPool];
    for (let i = wp.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [wp[i], wp[j]] = [wp[j], wp[i]];
    }
    const opts = [sign, ...wp.slice(0, 3)];
    // Shuffle options
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return { sign, options: opts };
  });
}

interface DailyChallengeProps {
  lang: Language;
  onHome: () => void;
}

type Phase = 'intro' | 'playing' | 'result';

export default function DailyChallenge({ lang, onHome }: DailyChallengeProps) {
  const { muted, toggleMute } = useMute();
  const { playCorrect, playWrong } = useAudio(muted);

  const questions = useMemo(() => buildDailyQuestions(), []);
  const [phase, setPhase] = useState<Phase>('intro');
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [copied, setCopied] = useState(false);

  const isRtl = lang === 'ar';
  const dateKey = new Date().toISOString().slice(0, 10);

  const handleAnswer = (chosenId: string) => {
    if (showFeedback) return;
    const correct = chosenId === questions[current].sign.id;
    recordEvent({ type: 'answer', signId: questions[current].sign.id, correct });
    setSelected(chosenId);
    setShowFeedback(true);
    if (correct) playCorrect(); else playWrong();
    const newAnswers = [...answers, correct];

    setTimeout(() => {
      if (current + 1 >= DAILY_QUESTIONS) {
        setAnswers(newAnswers);
        setPhase('result');
      } else {
        setAnswers(newAnswers);
        setCurrent(c => c + 1);
        setSelected(null);
        setShowFeedback(false);
      }
    }, 1400);
  };

  const correctCount = answers.filter(Boolean).length;
  const earned = useFinishGame(phase === 'result', { mode: 'daily', xp: 20 + correctCount * 8, correct: correctCount, total: DAILY_QUESTIONS });

  const handleShare = async () => {
    const emojiRow = answers.map(a => a ? '🟩' : '🟥').join('');
    const text =
      lang === 'sv'
        ? `Vägmärken Quest — Daglig utmaning ${dateKey}\n${emojiRow}\n${correctCount}/${DAILY_QUESTIONS} rätt`
        : lang === 'en'
        ? `Vägmärken Quest — Daily Challenge ${dateKey}\n${emojiRow}\n${correctCount}/${DAILY_QUESTIONS} correct`
        : `إشارات المرور — التحدي اليومي ${dateKey}\n${emojiRow}\n${correctCount}/${DAILY_QUESTIONS} صحيح`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  if (phase === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-6 w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center">
          <Calendar className="w-10 h-10 text-amber-400" />
        </div>
        <h1 className="text-4xl font-display font-extrabold text-[hsl(var(--foreground))] mb-2">
          {lang === 'sv' ? 'Daglig utmaning' : lang === 'en' ? 'Daily Challenge' : 'التحدي اليومي'}
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-2 max-w-xs">
          {lang === 'en'
            ? 'Same 10 signs for all players today. Can you get them all right?'
            : lang === 'sv'
            ? 'Samma 10 skyltar för alla spelare idag. Kan du klara alla?'
            : '10 إشارات متطابقة لجميع اللاعبين اليوم. هل يمكنك إتقانها جميعاً؟'}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mb-8 font-mono">{dateKey}</p>

        <div className="flex gap-1 mb-8">
          {Array.from({ length: DAILY_QUESTIONS }).map((_, i) => (
            <div key={i} className="w-5 h-5 rounded bg-slate-700 border border-slate-600" />
          ))}
        </div>

        <button
          onClick={() => setPhase('playing')}
          className="w-full max-w-xs py-4 rounded-2xl btn-hue hue-amber font-display font-extrabold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Calendar className="w-5 h-5" />
          {lang === 'sv' ? 'Starta utmaningen!' : lang === 'en' ? 'Start challenge!' : 'ابدأ التحدي!'}
        </button>

        <button onClick={onHome} className="mt-4 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1">
          <Home className="w-3.5 h-3.5" />
          {t(lang, 'home')}
        </button>
      </div>
    );
  }

  if (phase === 'result') {
    const pct = Math.round((correctCount / DAILY_QUESTIONS) * 100);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-6xl mb-4">{pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : '📚'}</div>
        <h1 className="text-3xl font-display font-extrabold text-[hsl(var(--foreground))] mb-1">
          {pct >= 90
            ? (lang === 'sv' ? 'Perfekt dag!' : lang === 'en' ? 'Perfect day!' : 'يوم مثالي!')
            : pct >= 70
            ? (lang === 'sv' ? 'Bra resultat!' : lang === 'en' ? 'Great result!' : 'نتيجة رائعة!')
            : (lang === 'sv' ? 'Fortsätt öva!' : lang === 'en' ? 'Keep practising!' : 'استمر في التدريب!')}
        </h1>
        <div className="mt-3 mb-1"><XpChip earned={earned} lang={lang} /></div>
        {pct >= 70 && <Confetti />}
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-6 font-mono">{dateKey}</p>

        {/* Emoji grid */}
        <div className="flex gap-1.5 mb-6 flex-wrap justify-center max-w-xs">
          {answers.map((a, i) => (
            <div key={i} className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-sm',
              a ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-red-500/20 border border-red-500/40 text-red-400',
            )}>
              {a ? '✓' : '✗'}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-8">
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span dir="ltr" className="text-3xl font-black text-amber-400">{correctCount}/{DAILY_QUESTIONS}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'correct')}</span>
          </div>
          <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
            <span className="text-3xl font-black text-[hsl(var(--brand-light))]">{pct}%</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {lang === 'sv' ? 'Rätt' : lang === 'en' ? 'Accuracy' : 'دقة'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleShare}
            className="py-3.5 rounded-2xl btn-hue hue-amber font-display font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {copied
              ? (lang === 'sv' ? 'Kopierat!' : lang === 'en' ? 'Copied!' : 'تم النسخ!')
              : (lang === 'sv' ? 'Dela resultat' : lang === 'en' ? 'Share result' : 'شارك النتيجة')}
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
  const q = questions[current];
  const progressPct = (current / DAILY_QUESTIONS) * 100;

  return (
    <div className="min-h-screen flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onHome} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            {t(lang, 'exit')}
          </button>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-400">{dateKey}</span>
          </div>
          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-lg bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center hover:border-[hsl(var(--option-hover-border))] transition-colors text-sm"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 mb-3 justify-center">
          {Array.from({ length: DAILY_QUESTIONS }).map((_, i) => (
            <div key={i} className={cn(
              'h-2 rounded-full flex-1 transition-all duration-300',
              i < answers.length
                ? answers[i] ? 'bg-emerald-500' : 'bg-red-500'
                : i === current ? 'bg-amber-400' : 'bg-slate-700',
            )} />
          ))}
        </div>

        <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center px-4 pb-8 max-w-2xl mx-auto w-full">
        <div className={cn(
          'p-6 rounded-3xl border-2 mb-5 bg-[hsl(var(--option-bg))] transition-all duration-300 mt-4',
          !showFeedback && 'border-[hsl(var(--option-border))]',
          showFeedback && selected === q.sign.id && 'border-emerald-500/50 bg-emerald-500/10',
          showFeedback && selected !== q.sign.id && 'border-red-500/30 bg-red-500/5',
        )}>
          <SignDisplay sign={q.sign} size="lg" />
        </div>

        {showFeedback && (
          <div className={cn(
            'mb-4 px-4 py-2 rounded-full text-sm font-bold',
            selected === q.sign.id
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-red-400 bg-red-500/10',
          )}>
            {selected === q.sign.id
              ? t(lang, 'correctAnswer')
              : <>{t(lang, 'wrongAnswer')} <AnswerName sign={q.sign} lang={lang} /></>}
          </div>
        )}

        <p className="text-base font-bold text-[hsl(var(--foreground))] text-center mb-5">
          {t(lang, 'question')}
        </p>

        <div className="grid grid-cols-2 gap-3 w-full">
          {q.options.map(opt => {
            const isSelected = selected === opt.id;
            const isCorrect = opt.id === q.sign.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleAnswer(opt.id)}
                disabled={showFeedback}
                className={cn(
                  'p-3 rounded-2xl border-2 text-start transition-all text-sm font-semibold leading-snug min-h-[44px]',
                  !showFeedback && 'border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] hover:border-[hsl(var(--brand))]/60 hover:bg-[hsl(var(--brand))]/5 active:scale-[0.98]',
                  showFeedback && isCorrect && 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
                  showFeedback && isSelected && !isCorrect && 'border-red-500/50 bg-red-500/10 text-red-300',
                  showFeedback && !isSelected && !isCorrect && 'border-[hsl(var(--option-border))] bg-[hsl(var(--option-bg))] opacity-50',
                )}
              >
                <span className="text-xs text-[hsl(var(--muted-foreground))] block">{opt.code}</span>
                {lang === 'ar' ? (
                  <>
                    {opt.nameAr}
                    <span dir="ltr" className="block text-end text-[11px] font-normal text-[hsl(var(--muted-foreground))] mt-0.5">{opt.name}</span>
                  </>
                ) : opt.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
