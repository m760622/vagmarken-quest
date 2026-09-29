import { useState } from 'react';
import { HighScore, Language } from '@/types/game';
import { t, CATEGORY_LABELS_I18N } from '@/constants/i18n';
import { Trophy, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HighScorePanelProps {
  scores: HighScore[];
  onClear: () => void;
  lang: Language;
}

const diffColors = {
  easy: 'text-emerald-400',
  medium: 'text-yellow-400',
  hard: 'text-red-400',
};

const diffLabels: Record<Language, Record<string, string>> = {
  sv: { easy: 'Lätt', medium: 'Medel', hard: 'Svår' },
  ar: { easy: 'سهل', medium: 'متوسط', hard: 'صعب' },
  en: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
};

function formatDate(iso: string, lang: Language): string {
  try {
    return new Date(iso).toLocaleDateString(
      lang === 'ar' ? 'ar-EG' : lang === 'en' ? 'en-GB' : 'sv-SE',
      { day: '2-digit', month: '2-digit', year: '2-digit' },
    );
  } catch {
    return iso.slice(0, 10);
  }
}

export default function HighScorePanel({ scores, onClear, lang }: HighScorePanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass w-full rounded-2xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-[hsl(var(--foreground))]">{t(lang, 'bestScores')}</span>
          {scores.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 font-semibold">
              {scores.length}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        )}
      </button>

      {/* Content */}
      {open && (
        <div className="px-4 py-3 space-y-2 border-t border-[hsl(var(--option-border))]">
          {scores.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">{t(lang, 'noScores')}</p>
          ) : (
            <>
              {/* Column headers */}
              <div className={cn(
                'grid gap-2 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] pb-1 border-b border-[hsl(var(--option-border))]',
                'grid-cols-[1.5rem_1fr_auto_auto_auto]'
              )}>
                <span>#</span>
                <span>{t(lang, 'category')}</span>
                <span>{t(lang, 'correct')}</span>
                <span>{t(lang, 'score')}</span>
                <span>{t(lang, 'date')}</span>
              </div>

              {scores.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    'grid gap-2 items-center py-2 border-b border-[hsl(var(--option-border))]/40 last:border-0',
                    'grid-cols-[1.5rem_1fr_auto_auto_auto]'
                  )}
                >
                  {/* Rank */}
                  <span className={cn(
                    'text-xs font-black',
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-[hsl(var(--muted-foreground))]'
                  )}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </span>

                  {/* Category + difficulty */}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[hsl(var(--foreground))] truncate">
                      {CATEGORY_LABELS_I18N[lang][s.category]}
                    </p>
                    <p className={cn('text-[10px]', diffColors[s.difficulty])}>
                      {diffLabels[lang][s.difficulty]}
                    </p>
                  </div>

                  {/* Correct */}
                  <span className="text-xs font-bold text-emerald-400">{s.correct}/{s.total}</span>

                  {/* Score */}
                  <span className="text-xs font-black text-[hsl(var(--brand-light))]">{s.score}</span>

                  {/* Date */}
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{formatDate(s.date, lang)}</span>
                </div>
              ))}

              {/* Clear button */}
              <button
                onClick={onClear}
                className="flex items-center gap-1 text-[10px] text-red-400/60 hover:text-red-400 transition-colors mt-1"
              >
                <Trash2 className="w-3 h-3" />
                {lang === 'en' ? 'Clear all' : lang === 'ar' ? 'مسح الكل' : 'Rensa allt'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
