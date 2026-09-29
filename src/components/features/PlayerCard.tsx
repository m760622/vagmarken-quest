import { useState } from 'react';
import { Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { Language } from '@/types/game';
import { t } from '@/constants/i18n';
import { usePlayer } from '@/hooks/usePlayer';
import { displayStreak, streakAtRisk } from '@/lib/player';
import { cn } from '@/lib/utils';
import { useProgress } from '@/hooks/useProgress';
import { missionDef } from '@/lib/progress';

const RING = 64;
const R = 27;
const C = 2 * Math.PI * R;

/** Level ring + rank title + XP bar + day streak, shown on the home screen. */
export default function PlayerCard({ lang }: { lang: Language }) {
  const { player, level, into, needed, pct, rank } = usePlayer();
  const streak = displayStreak(player);
  const { missions } = useProgress();
  const missionsDone = missions.filter(m => m.done).length;
  const allDone = missions.length > 0 && missionsDone === missions.length;
  // Open while there is something left to do; folds away once everything is done
  const [openPref, setOpenPref] = useState<boolean | null>(null);
  const missionsOpen = openPref ?? !allDone;
  const atRisk = streakAtRisk(player) && streak > 0;

  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-center gap-4">
        {/* Level ring */}
        <div className="relative shrink-0 grid place-items-center" style={{ width: RING, height: RING }}>
          <svg className="absolute inset-0 -rotate-90" width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
            <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="hsl(var(--foreground) / 0.12)" strokeWidth="6" />
            <circle
              cx={RING / 2} cy={RING / 2} r={R}
              fill="none"
              stroke="hsl(var(--brand))"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)', filter: 'drop-shadow(0 0 6px hsl(var(--brand) / 0.7))' }}
            />
          </svg>
          <span className="text-[28px] leading-none" aria-hidden="true">{rank.icon}</span>
        </div>

        {/* Title + XP */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[17px] font-bold text-[hsl(var(--foreground))] truncate">
              {rank.names[lang]}
            </span>
            <span className="text-xs font-bold text-[hsl(var(--brand-light))] shrink-0">
              {t(lang, 'level')} {level}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[hsl(var(--foreground))]/10 overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-700"
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5 tabular-nums">
            {into} / {needed} {t(lang, 'xpUnit')}
          </p>
        </div>

        {/* Day streak */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <div
            className={cn(
              'w-12 h-12 rounded-2xl grid place-items-center',
              streak > 0 ? 'bg-orange-500/20 border border-orange-400/50' : 'bg-[hsl(var(--foreground))]/5 border border-[hsl(var(--option-border))]',
            )}
          >
            <Flame
              className={cn('w-6 h-6', streak > 0 ? 'text-orange-400 fill-orange-400/40' : 'text-[hsl(var(--muted-foreground))]')}
            />
          </div>
          <span className={cn('font-display text-sm font-extrabold tabular-nums', streak > 0 ? 'text-orange-400' : 'text-[hsl(var(--muted-foreground))]')}>
            {streak}
          </span>
        </div>
      </div>

      {streak > 0 && (
        <p className={cn('text-xs mt-3 flex items-center gap-1.5', atRisk ? 'text-amber-400' : 'text-[hsl(var(--brand-light))]')}>
          <span className={cn('w-1.5 h-1.5 rounded-full', atRisk ? 'bg-amber-400 animate-pulse' : 'bg-[hsl(var(--brand))]')} />
          {atRisk ? t(lang, 'playToKeep') : t(lang, 'streakToday')} · {streak} {t(lang, 'dayStreak')}
        </p>
      )}
      {/* Today's missions */}
      <div className="mt-4 pt-4 border-t border-[hsl(var(--option-border))]">
        <button
          onClick={() => setOpenPref(!missionsOpen)}
          className={cn('w-full flex items-center justify-between', missionsOpen && 'mb-3')}
          aria-expanded={missionsOpen}
        >
          <span className="font-display text-[13px] font-bold text-[hsl(var(--foreground))]">
            {allDone ? '✅ ' : ''}{t(lang, 'missionsToday')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn('text-xs font-extrabold tabular-nums', allDone ? 'text-emerald-400' : 'text-[hsl(var(--brand-light))]')}>{missionsDone}/{missions.length}</span>
            {missionsOpen
              ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
          </span>
        </button>
        {missionsOpen && (
        <div className="space-y-3">
          {missions.map(m => {
            const def = missionDef(m.id);
            return (
              <div key={m.id} className="flex items-center gap-3">
                <span className={cn('w-9 h-9 rounded-xl grid place-items-center text-lg shrink-0', m.done ? 'bg-emerald-500/20' : 'bg-[hsl(var(--foreground))]/5')} aria-hidden="true">
                  {m.done ? '✅' : def.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-[12.5px] font-semibold leading-tight', m.done ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]')}>
                      {def.text[lang]}
                    </span>
                    <span className="text-[11px] font-extrabold text-amber-400 shrink-0 tabular-nums">+{def.xp}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--foreground))]/10 mt-1.5 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', m.done ? 'bg-emerald-400' : 'bg-brand-gradient')}
                      style={{ width: `${Math.min(100, (m.progress / def.target) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))] w-9 text-end shrink-0">{m.progress}/{def.target}</span>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
