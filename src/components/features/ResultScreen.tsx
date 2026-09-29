
import { GameState, Language, SignCategory } from '@/types/game';
import CategoryBreakdown from './CategoryBreakdown';
import SignDisplay from './SignDisplay';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { CATEGORY_LABELS_I18N, t } from '@/constants/i18n';
import { Trophy, Flame, RotateCcw, Home, CheckCircle, XCircle, Lock, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import Confetti from './Confetti';
import XpChip from './XpChip';
import { useFinishGame } from '@/hooks/usePlayer';

interface ResultScreenProps {
  state: GameState;
  lang: Language;
  onPlayAgain: () => void;
  onHome: () => void;
  onSaveScore: (
    score: number,
    correct: number,
    total: number,
    category: SignCategory | 'all',
    difficulty: 'easy' | 'medium' | 'hard',
  ) => void;
  onRecordMedium?: (correct: number, total: number) => void;
  justUnlocked?: boolean;
  onDismissUnlock?: () => void;
  /** Review-mistakes run: reported separately from normal quizzes. */
  isReview?: boolean;
}

/** Rating is based on accuracy, so a perfect game earns top stars on any difficulty. */
function getRating(pct: number, lang: Language) {
  if (pct >= 90) return { stars: 5, label: t(lang, 'ratingMaster') };
  if (pct >= 70) return { stars: 4, label: t(lang, 'ratingExcellent') };
  if (pct >= 50) return { stars: 3, label: t(lang, 'ratingGood') };
  if (pct >= 30) return { stars: 2, label: t(lang, 'ratingKeepTrying') };
  return            { stars: 1, label: t(lang, 'ratingTryAgain') };
}

/** Floating emoji particle for the unlock celebration */
function Particle({ emoji, style }: { emoji: string; style: React.CSSProperties }) {
  return (
    <span
      className="absolute text-2xl select-none pointer-events-none animate-bounce"
      style={style}
    >
      {emoji}
    </span>
  );
}

/** Accuracy ring: fills from empty on mount */
function ScoreRing({ pct, label }: { pct: number; label: string }) {
  const SIZE = 176;
  const R = 74;
  const C = 2 * Math.PI * R;
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFilled(true), 120);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="relative grid place-items-center" style={{ width: SIZE, height: SIZE }}>
      <div
        className="glow-breathe absolute inset-2 rounded-full blur-2xl"
        style={{ background: 'radial-gradient(closest-side, hsl(var(--brand) / 0.5), hsl(var(--accent-2) / 0.2) 65%, transparent)' }}
      />
      <svg className="absolute inset-0 -rotate-90" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--brand-light))' }} />
            <stop offset="55%" style={{ stopColor: 'hsl(190 95% 60%)' }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--accent-2))' }} />
          </linearGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="hsl(var(--foreground) / 0.1)" strokeWidth="12" />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={filled ? C * (1 - pct / 100) : C}
          style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="relative text-center">
        <div className="font-display text-5xl font-extrabold text-brand-gradient tabular-nums leading-none">{pct}<span className="text-2xl">%</span></div>
        <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mt-1.5">{label}</div>
      </div>
    </div>
  );
}

const PARTICLES = ['⚠️', '🛑', '⛔', '🔵', '◆', '🟦', '🏆', '🔓', '⭐', '🚦'];

export default function ResultScreen({
  state, lang, onPlayAgain, onHome, onSaveScore, onRecordMedium, justUnlocked, onDismissUnlock, isReview,
}: ResultScreenProps) {
  const correctCount = state.answers.filter(a => a.correct).length;
  const correctPct   = Math.round((correctCount / state.totalQuestions) * 100);
  const rating       = getRating(correctPct, lang);
  const earned       = useFinishGame(true, {
    mode: isReview ? 'review' : 'quiz',
    xp: Math.round(state.score / 2) + 20,
    correct: correctCount,
    total: state.totalQuestions,
    maxStreak: state.maxStreak,
  });
  const isRtl        = lang === 'ar';
  const savedRef     = useRef(false);

  // Show the unlock overlay with a slight delay so the result screen renders first
  const [showOverlay, setShowOverlay] = useState(false);
  useEffect(() => {
    if (justUnlocked) {
      const id = setTimeout(() => setShowOverlay(true), 600);
      return () => clearTimeout(id);
    }
  }, [justUnlocked]);

  useEffect(() => {
    if (!savedRef.current) {
      savedRef.current = true;
      onSaveScore(state.score, correctCount, state.totalQuestions, state.selectedCategory, state.difficulty);
      if (state.difficulty === 'medium' && onRecordMedium) {
        onRecordMedium(correctCount, state.totalQuestions);
      }
    }
  // The error message "Definition for rule 'react-hooks/exhaustive-deps' was not found"
  // indicates that a comment to disable the rule // eslint-disable-line react-hooks/exhaustive-deps
  // is trying to refer to a rule that isn't defined or available in the linter configuration.
  // Removing this comment will resolve the specific error, assuming the intent was to disable
  // the rule in a context where it's not actually present.
  // If the rule *should* be present, the fix would be to correctly configure ESLint.
  // Since the request is to fix syntax errors while preserving as much as possible,
  // and the error is about a missing linter rule definition, removing the linter directive is the most direct fix.
  }, [onSaveScore, correctCount, state.score, state.totalQuestions, state.selectedCategory, state.difficulty, onRecordMedium]);

  const handleDismissOverlay = () => {
    setShowOverlay(false);
    onDismissUnlock?.();
  };

  return (
    <div
      className="min-h-screen px-4 py-8 flex flex-col items-center max-w-2xl mx-auto"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Hard-unlock celebration overlay */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm cursor-pointer"
          onClick={handleDismissOverlay}
        >
          {/* Floating particles */}
          {PARTICLES.map((emoji, i) => (
            <Particle
              key={i}
              emoji={emoji}
              style={{
                top:  `${10 + (i * 8) % 75}%`,
                left: `${5  + (i * 11) % 88}%`,
                animationDelay: `${i * 0.12}s`,
                animationDuration: `${0.9 + (i % 3) * 0.3}s`,
                opacity: 0.7,
              }}
            />
          ))}

          {/* Card */}
          <div
            className="relative flex flex-col items-center gap-5 p-8 rounded-3xl max-w-xs w-full mx-4 text-center shadow-2xl border-2 border-yellow-400/60 bg-gradient-to-br from-slate-900 via-yellow-950/60 to-slate-900 animate-in zoom-in duration-500"
            onClick={e => e.stopPropagation()}
          >
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-3xl bg-yellow-400/5 blur-xl pointer-events-none" />

            {/* Icon */}
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/30 to-amber-600/20 border-2 border-yellow-400/50">
              <Lock className="w-8 h-8 text-yellow-400" strokeWidth={1.5} />
              <span className="absolute -top-1 -right-1 text-2xl">🔓</span>
            </div>

            <div>
              <h2 className="text-2xl font-black text-yellow-400 leading-tight">
                {t(lang, 'hardUnlockedTitle')}
              </h2>
              <p className="text-sm text-yellow-200/80 mt-2 leading-relaxed">
                {t(lang, 'hardUnlockedBody', { pct: correctPct })}
              </p>
            </div>

            {/* Stars row */}
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={cn('text-xl', i < rating.stars ? 'opacity-100' : 'opacity-20')}>⭐</span>
              ))}
            </div>

            <button
              onClick={handleDismissOverlay}
              className="w-full py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t(lang, 'hardUnlockedCta')}
            </button>
          </div>
        </div>
      )}

      {correctPct >= 70 && <Confetti />}

      {/* ── Result content ── */}
      <div className="w-full flex flex-col items-center text-center mb-7 pt-2">
        <ScoreRing
          pct={correctPct}
          label={lang === 'ar' ? 'دقة' : lang === 'en' ? 'Accuracy' : 'Träffsäkerhet'}
        />
        <div className="flex gap-1.5 mt-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn('w-6 h-6', i < rating.stars ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-[hsl(var(--foreground))]/15')}
            />
          ))}
        </div>
        <h1 className="font-display text-3xl font-extrabold text-brand-gradient mt-3 pb-1">{rating.label}</h1>
        <div className="mt-2 mb-1"><XpChip earned={earned} lang={lang} /></div>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">{t(lang, 'quizFinished')}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]/80 mt-1">
          {CATEGORY_LABELS_I18N[lang][state.selectedCategory]}
          {/* A review run has no difficulty choice, so don't show one */}
          {!isReview && ` · ${t(lang, `diff${state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1)}`)}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full mb-6">
        <div className="glass flex flex-col items-center p-4 rounded-2xl">
          <Trophy className="w-5 h-5 text-yellow-400 mb-1" />
          <span className="font-display text-2xl font-extrabold text-[hsl(var(--foreground))]">{state.score}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'score')}</span>
        </div>
        <div className="glass flex flex-col items-center p-4 rounded-2xl">
          <CheckCircle className="w-5 h-5 text-emerald-400 mb-1" />
          <span className="font-display text-2xl font-extrabold text-[hsl(var(--foreground))]">{correctCount}/{state.totalQuestions}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'correct')}</span>
        </div>
        <div className="glass flex flex-col items-center p-4 rounded-2xl">
          <Flame className="w-5 h-5 text-orange-400 mb-1" />
          <span className="font-display text-2xl font-extrabold text-[hsl(var(--foreground))]">{state.maxStreak}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'streak')}</span>
        </div>
      </div>

      {/* Medium progress hint when still locked (review runs never count toward unlocking) */}
      {!isReview && state.difficulty === 'medium' && correctPct < 80 && !justUnlocked && !showOverlay && (
        <div className="w-full mb-5 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-400">{t(lang, 'unlockProgress')}</span>
            </div>
            <span className="text-xs font-black text-amber-300 tabular-nums">
              {correctPct}% / 80%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-700"
              style={{ width: `${Math.min(100, (correctPct / 80) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">
            {t(lang, 'hardLockedHint')}
          </p>
        </div>
      )}

      {/* Category Breakdown */}
      <CategoryBreakdown answers={state.answers} lang={lang} />

      {/* Answers review */}
      <div className="w-full mb-8">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
          {t(lang, 'yourAnswers')}
        </h2>
        <div className="space-y-2">
          {state.answers.map((answer, idx) => {
            const sign   = TRAFFIC_SIGNS.find(s => s.id === answer.signId);
            const chosen = TRAFFIC_SIGNS.find(s => s.id === answer.chosenId);
            if (!sign) return null;
            const timedOut = !answer.chosenId;
            return (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border',
                  answer.correct     ? 'border-emerald-500/30 bg-emerald-500/5'
                  : timedOut         ? 'border-orange-500/30 bg-orange-500/5'
                  :                    'border-red-500/30 bg-red-500/5',
                )}
              >
                {/* Mini sign image */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center">
                  <SignDisplay sign={sign} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{lang === 'ar' ? sign.nameAr : sign.name}</p>
                  {!answer.correct && (
                    <p className={cn('text-xs truncate', timedOut ? 'text-orange-400' : 'text-red-400')}>
                      {timedOut ? t(lang, 'timeUp') : `${t(lang, 'yourAnswer')} ${(lang === 'ar' ? chosen?.nameAr : chosen?.name) ?? '—'}`}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {answer.correct  ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                  : timedOut       ? <span className="text-lg">⏱</span>
                  :                  <XCircle className="w-5 h-5 text-red-500" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="w-full grid grid-cols-2 gap-3">
        <button
          onClick={onHome}
          className="glass flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[hsl(var(--foreground))] font-display font-bold hover:border-[hsl(var(--option-hover-border))] active:scale-[0.98] transition-all"
        >
          <Home className="w-4 h-4" /> {t(lang, 'home')}
        </button>
        <button
          onClick={onPlayAgain}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-gradient text-[hsl(var(--primary-foreground))] font-display font-bold shadow-glow transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <RotateCcw className="w-4 h-4" /> {t(lang, 'playAgain')}
        </button>
      </div>
    </div>
  );
}
