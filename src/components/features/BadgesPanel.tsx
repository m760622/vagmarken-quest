import { useState } from 'react';
import { Award, ChevronDown, ChevronUp } from 'lucide-react';
import { Language } from '@/types/game';
import { t } from '@/constants/i18n';
import { useProgress } from '@/hooks/useProgress';
import { BADGES, badgeProgress } from '@/lib/progress';
import { cn } from '@/lib/utils';

/** Collapsible badge collection: unlocked ones glow, locked ones show progress. */
export default function BadgesPanel({ lang }: { lang: Language }) {
  const [open, setOpen] = useState(false);
  const progress = useProgress();
  const unlocked = BADGES.filter(b => progress.badges[b.id]).length;

  return (
    <div className="glass w-full rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-[hsl(var(--foreground))]">{t(lang, 'badgesTitle')}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 font-semibold tabular-nums">
            {unlocked}/{BADGES.length}
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
      </button>

      {open && (
        <div className="grid grid-cols-3 gap-2.5 p-3 border-t border-[hsl(var(--option-border))]">
          {BADGES.map(b => {
            const got = !!progress.badges[b.id];
            const value = badgeProgress(b, progress);
            return (
              <div
                key={b.id}
                className={cn(
                  'rounded-2xl p-2.5 text-center flex flex-col items-center gap-1 border',
                  got ? 'border-amber-400/50 bg-amber-400/10' : 'border-[hsl(var(--option-border))] bg-[hsl(var(--foreground))]/[0.03]',
                )}
              >
                <span className={cn('text-[26px] leading-none', !got && 'grayscale opacity-40')} aria-hidden="true">{b.icon}</span>
                <span className="text-[11px] font-bold leading-tight text-[hsl(var(--foreground))]">{b.name[lang]}</span>
                <span className="text-[10px] leading-tight text-[hsl(var(--muted-foreground))]">{b.desc[lang]}</span>
                {!got && b.target > 1 && (
                  <span className="text-[10px] font-extrabold tabular-nums text-[hsl(var(--brand-light))]">{value}/{b.target}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
