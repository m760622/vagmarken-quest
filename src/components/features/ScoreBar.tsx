import { Flame, Trophy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreBarProps {
  score: number;
  streak: number;
  currentQuestion: number;
  totalQuestions: number;
  correctCount?: number;
  /** Questions already answered (includes the one whose feedback is showing). */
  answeredCount?: number;
}

export default function ScoreBar({ score, streak, currentQuestion, totalQuestions, correctCount, answeredCount }: ScoreBarProps) {
  const progress = (currentQuestion / totalQuestions) * 100;
  const answered = answeredCount ?? currentQuestion;
  const accuracy = answered > 0 && correctCount !== undefined
    ? Math.min(100, Math.round((correctCount / answered) * 100))
    : null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2.5">
      {/* Stats row */}
      <div className="flex items-center justify-between gap-2">
        {/* Score */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--option-bg))] border border-[hsl(var(--option-border))]">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          <span className="font-black text-sm text-yellow-400 tabular-nums">{score}</span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">pts</span>
        </div>

        {/* Question counter */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i < currentQuestion ? 'bg-[hsl(var(--brand))] w-2' : i === currentQuestion ? 'bg-[hsl(var(--brand-light))] w-3' : 'bg-slate-700 w-2',
              )}
            />
          ))}
        </div>

        {/* Streak / accuracy */}
        <div className="flex items-center gap-1.5">
          {accuracy !== null && (
            <div className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-bold transition-all',
              accuracy >= 80 ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : accuracy >= 60 ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))] text-[hsl(var(--muted-foreground))]',
            )}>
              <Target className="w-3 h-3" />
              <span className="tabular-nums">{accuracy}%</span>
            </div>
          )}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all',
            streak >= 3 ? 'bg-orange-500/20 border-orange-500/50' : 'bg-[hsl(var(--option-bg))] border-[hsl(var(--option-border))]',
          )}>
            <Flame className={cn('w-3.5 h-3.5', streak >= 3 ? 'text-orange-400' : 'text-[hsl(var(--muted-foreground))]')} />
            <span className={cn('font-black text-sm tabular-nums', streak >= 3 ? 'text-orange-400' : 'text-[hsl(var(--muted-foreground))]')}>{streak}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-[hsl(var(--option-bg))] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand))] to-[hsl(var(--brand-light))] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
