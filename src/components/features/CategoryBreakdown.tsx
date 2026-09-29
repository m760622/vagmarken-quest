import { SignCategory, Language, AnswerRecord } from '@/types/game';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { CATEGORY_LABELS_I18N } from '@/constants/i18n';
import { cn } from '@/lib/utils';

interface CategoryBreakdownProps {
  answers: AnswerRecord[];
  lang: Language;
}

const CATEGORY_CONFIG: Record<SignCategory, { emoji: string; bar: string; bg: string; border: string }> = {
  warning:     { emoji: '⚠️', bar: 'from-amber-500 to-orange-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  prohibition: { emoji: '⛔', bar: 'from-red-500 to-rose-400',      bg: 'bg-red-500/10',    border: 'border-red-500/30'   },
  mandatory:   { emoji: '🔵', bar: 'from-blue-500 to-sky-400',      bg: 'bg-blue-500/10',   border: 'border-blue-500/30'  },
  priority:    { emoji: '◆',  bar: 'from-yellow-500 to-amber-300',  bg: 'bg-yellow-500/10', border: 'border-yellow-500/30'},
  information: { emoji: '🟦', bar: 'from-sky-500 to-cyan-400',      bg: 'bg-sky-500/10',    border: 'border-sky-500/30'   },
};

export default function CategoryBreakdown({ answers, lang }: CategoryBreakdownProps) {
  // Build per-category stats
  const stats = new Map<SignCategory, { correct: number; total: number }>();

  answers.forEach(answer => {
    const sign = TRAFFIC_SIGNS.find(s => s.id === answer.signId);
    if (!sign) return;
    const cat = sign.category;
    const prev = stats.get(cat) ?? { correct: 0, total: 0 };
    stats.set(cat, {
      correct: prev.correct + (answer.correct ? 1 : 0),
      total: prev.total + 1,
    });
  });

  const entries = Array.from(stats.entries()).sort((a, b) => {
    // Sort by pct ascending so weakest areas come first
    const pctA = a[1].total > 0 ? a[1].correct / a[1].total : 0;
    const pctB = b[1].total > 0 ? b[1].correct / b[1].total : 0;
    return pctA - pctB;
  });

  if (entries.length === 0) return null;

  const isRtl = lang === 'ar';

  return (
    <div className="w-full mb-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
        {lang === 'sv' ? 'Per kategori' : lang === 'en' ? 'By category' : 'حسب الفئة'}
      </h2>
      <div className="space-y-2.5">
        {entries.map(([cat, { correct, total }]) => {
          const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
          const cfg = CATEGORY_CONFIG[cat];
          const label = CATEGORY_LABELS_I18N[lang][cat];
          const needsWork = pct < 60;
          const excellent = pct >= 80;

          return (
            <div
              key={cat}
              className={cn(
                'flex items-center gap-3 p-3 rounded-2xl border',
                cfg.bg, cfg.border,
              )}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              {/* Emoji icon */}
              <span className="text-xl flex-shrink-0 w-7 text-center">{cfg.emoji}</span>

              {/* Label + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[hsl(var(--foreground))] truncate leading-none">
                    {label}
                  </span>
                  <span className={cn(
                    'text-xs font-black tabular-nums ml-2 flex-shrink-0',
                    excellent ? 'text-emerald-400' : needsWork ? 'text-red-400' : 'text-amber-400',
                  )}>
                    {correct}/{total}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full bg-gradient-to-r transition-all duration-700',
                      cfg.bar,
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Pct badge */}
              <div className={cn(
                'flex-shrink-0 w-10 text-center',
              )}>
                <span className={cn(
                  'text-sm font-black tabular-nums',
                  excellent ? 'text-emerald-400' : needsWork ? 'text-red-400' : 'text-amber-400',
                )}>
                  {pct}%
                </span>
                {needsWork && (
                  <p className="text-[9px] text-red-400/80 leading-none mt-0.5">
                    {lang === 'sv' ? 'Öva mer' : lang === 'en' ? 'Practise' : 'تدرّب'}
                  </p>
                )}
                {excellent && (
                  <p className="text-[9px] text-emerald-400/80 leading-none mt-0.5">
                    {lang === 'sv' ? 'Utmärkt!' : lang === 'en' ? 'Excellent!' : 'ممتاز!'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
