import { TrafficSign, Language } from '@/types/game';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle } from 'lucide-react';
import type { CSSProperties } from 'react';

interface AnswerOptionsProps {
  options: TrafficSign[];
  correctId: string;
  selectedId: string | null;
  showFeedback: boolean;
  onSelect: (id: string) => void;
  lang?: Language;
  /** Options removed by the 50/50 lifeline (kept in layout, faded out). */
  hiddenIds?: string[];
}

export default function AnswerOptions({ options, correctId, selectedId, showFeedback, onSelect, lang, hiddenIds = [] }: AnswerOptionsProps) {
  const isRtl = lang === 'ar';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mx-auto">
      {options.map((opt, idx) => {
        const isRemoved = hiddenIds.includes(opt.id) && !showFeedback;
        const isSelected = selectedId === opt.id;
        const isCorrect = opt.id === correctId;
        const isWrong = showFeedback && isSelected && !isCorrect;
        const isRight = showFeedback && isCorrect;
        // Show code badge + localised name
        const displayName = lang === 'ar'
          ? opt.nameAr
          : lang === 'en'
          ? (opt.nameEn || opt.name)
          : opt.name;
        const subName = lang === 'ar' ? opt.name : lang === 'en' ? opt.name : opt.nameEn;

        return (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            disabled={showFeedback || isRemoved}
            tabIndex={isRemoved ? -1 : undefined}
            aria-hidden={isRemoved || undefined}
            style={{ '--rise-delay': `${idx * 0.06}s` } as CSSProperties}
            className={cn(
              'rise-in relative flex items-center gap-3 p-4 rounded-[20px] border-2 text-start transition-all duration-300',
              isRemoved && 'opacity-0 scale-90 pointer-events-none',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
              'min-h-[72px]',
              !showFeedback && 'glass hover:border-[hsl(var(--option-hover-border))] hover:shadow-[0_10px_28px_-14px_hsl(var(--brand)/0.7)] hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer',
              isRight && 'border-emerald-500 bg-emerald-500/10 scale-[1.02]',
              isWrong && 'border-red-500 bg-red-500/10',
              showFeedback && !isSelected && !isCorrect && 'opacity-40 glass',
            )}
          >
            {/* Code badge */}
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[hsl(var(--option-icon-bg))] border border-[hsl(var(--option-border))] flex items-center justify-center">
              <span className={cn(
                'text-[11px] font-black font-mono',
                isRight ? 'text-emerald-400' : isWrong ? 'text-red-400' : 'text-[hsl(var(--muted-foreground))]',
              )}>{opt.code}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight text-[hsl(var(--foreground))]">{displayName}</p>
              <p dir={lang === 'ar' ? 'ltr' : undefined} className={cn('text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate', lang === 'ar' && 'text-end')}>{subName}</p>
            </div>
            {showFeedback && isRight && (
              <CheckCircle className="flex-shrink-0 w-5 h-5 text-emerald-500" />
            )}
            {isWrong && (
              <XCircle className="flex-shrink-0 w-5 h-5 text-red-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}
