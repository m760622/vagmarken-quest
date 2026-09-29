/**
 * Screens shared by the timed round games (Twins, Classify): the intro, the header with score and
 * clock, the points pill and the result. The games bring their own colour and texts.
 */

import type { ReactNode } from 'react';
import { Home, RotateCcw, Flame, type LucideIcon } from 'lucide-react';
import { Language, TrafficSign } from '@/types/game';
import { t } from '@/constants/i18n';
import { cn } from '@/lib/utils';
import { l3 } from '@/lib/l3';
import SignDisplay from './SignDisplay';
import Confetti from './Confetti';
import XpChip from './XpChip';

/* ── Intro ───────────────────────────────────────────────────────── */
interface IntroProps {
  lang: Language;
  /** e.g. 'hsl(186 90% 50%)' */
  accent: string;
  /** btn-hue colour class, e.g. 'hue-cyan' */
  hueClass: string;
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  /** A few signs shown as a preview */
  sample: TrafficSign[];
  onStart: () => void;
  onHome: () => void;
}

export function RoundIntro({ lang, accent, hueClass, icon: Icon, title, description, meta, sample, onStart, onHome }: IntroProps) {
  const L = l3(lang);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mb-6 w-20 h-20 rounded-full flex items-center justify-center border-2" style={{ background: `${accent.replace(')', ' / 0.16)')}`, borderColor: accent.replace(')', ' / 0.4)') }}>
        <Icon className="w-10 h-10" style={{ color: accent }} />
      </div>
      <h1 className="text-4xl font-display font-extrabold text-[hsl(var(--foreground))] mb-2">{title}</h1>
      <p className="text-[hsl(var(--muted-foreground))] text-sm mb-2 max-w-xs">{description}</p>
      <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mb-8">{meta}</p>

      <div className="flex justify-center gap-2 mb-8" aria-hidden="true">
        {sample.map((s, i) => (
          <div key={i} className="w-16 h-16 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))] overflow-hidden flex items-center justify-center">
            <div style={{ transform: 'scale(0.5)' }}><SignDisplay sign={s} size="md" /></div>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className={cn('w-full max-w-xs py-4 rounded-2xl btn-hue font-display font-extrabold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2', hueClass)}
      >
        <Icon className="w-5 h-5" />
        {L('Start game!', 'Starta spelet!', 'ابدأ اللعبة!')}
      </button>

      <button onClick={onHome} className="mt-4 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1">
        <Home className="w-3.5 h-3.5" />
        {t(lang, 'home')}
      </button>
    </div>
  );
}

/* ── Header: exit, title, round counter, score, streak, clock ────── */
interface HeaderProps {
  lang: Language;
  accent: string;
  title: string;
  index: number;
  total: number;
  score: number;
  streak: number;
  /** 0..1 of the round time that is left */
  remaining: number;
  answered: boolean;
  seconds: number;
  muted: boolean;
  onToggleMute?: () => void;
  onHome: () => void;
}

export function RoundHeader({ lang, accent, title, index, total, score, streak, remaining, answered, seconds, muted, onToggleMute, onHome }: HeaderProps) {
  return (
    <div className="px-4 pt-5 pb-3 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onHome} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
          {t(lang, 'exit')}
        </button>
        <h1 className="text-sm font-display font-bold text-[hsl(var(--foreground))]">{title}</h1>
        <div className="flex items-center gap-1.5">
          <span dir="ltr" className="text-xs font-bold tabular-nums" style={{ color: accent }}>{index + 1}/{total}</span>
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
          <span className="text-sm font-black tabular-nums" style={{ color: accent }}>{score}</span>
        </div>
        {streak >= 2 && (
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-sm font-black text-orange-400 tabular-nums">{streak}</span>
          </div>
        )}
      </div>

      {/* Time left */}
      <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={seconds} aria-valuenow={Math.ceil(remaining * seconds)}>
        <div
          className={cn('h-full rounded-full', remaining < 0.3 && !answered && 'bg-rose-400')}
          style={{ width: `${remaining * 100}%`, background: remaining < 0.3 && !answered ? undefined : accent }}
        />
      </div>
    </div>
  );
}

/* ── Points won in the round ─────────────────────────────────────── */
export function PointsPill({ answered, wasRight, gained }: { answered: boolean; wasRight: boolean; gained: number }) {
  return (
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
  );
}

/* ── Result ──────────────────────────────────────────────────────── */
interface ResultProps {
  lang: Language;
  accent: string;
  hueClass: string;
  emoji: string;
  headline: string;
  earned: { gained: number; bonus: number } | null;
  newRecord: boolean;
  score: number;
  correct: number;
  total: number;
  best: number;
  onAgain: () => void;
  onHome: () => void;
  children?: ReactNode;
}

export function RoundResult({ lang, accent, hueClass, emoji, headline, earned, newRecord, score, correct, total, best, onAgain, onHome, children }: ResultProps) {
  const L = l3(lang);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="text-6xl mb-4">{emoji}</div>
      <h1 className="text-3xl font-display font-extrabold text-[hsl(var(--foreground))] mb-1">{headline}</h1>
      <div className="mt-2 mb-3"><XpChip earned={earned} lang={lang} /></div>
      {newRecord && (
        <p className="pop-in text-sm font-display font-extrabold text-amber-400 mb-2">
          🏅 {L('New record!', 'Nytt rekord!', 'رقم قياسي جديد!')}
        </p>
      )}
      {correct / total >= 0.6 && <Confetti />}

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs my-5">
        <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
          <span className="text-2xl font-black tabular-nums" style={{ color: accent }}>{score}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'score')}</span>
        </div>
        <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
          <span dir="ltr" className="text-2xl font-black text-sky-400 tabular-nums">{correct}/{total}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{t(lang, 'correct')}</span>
        </div>
        <div className="flex flex-col items-center p-4 rounded-2xl bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
          <span className="text-2xl font-black text-amber-400 tabular-nums">{best}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{L('Best', 'Rekord', 'الأفضل')}</span>
        </div>
      </div>

      {children}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onAgain}
          className={cn('py-3.5 rounded-2xl btn-hue font-display font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2', hueClass)}
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
