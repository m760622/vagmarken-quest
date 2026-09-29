import { TrafficSign, Language } from '@/types/game';
import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';

interface ExplanationCardProps {
  sign: TrafficSign;
  isCorrect: boolean;
  timedOut: boolean;
  lang: Language;
}

const CATEGORY_BADGE: Record<string, { label: string; cls: string }> = {
  warning:     { label: 'A',  cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  prohibition: { label: 'C',  cls: 'bg-red-500/20 text-red-400 border-red-500/40' },
  mandatory:   { label: 'D',  cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  priority:    { label: 'B',  cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  information: { label: 'E',  cls: 'bg-sky-500/20 text-sky-400 border-sky-500/40' },
  additional: { label: 'T',  cls: 'bg-slate-500/20 text-slate-400 border-slate-500/40' },
};

export default function ExplanationCard({ sign, isCorrect, timedOut, lang }: ExplanationCardProps) {
  const badge = CATEGORY_BADGE[sign.category];
  const description = lang === 'ar'
    ? (sign.descriptionAr ?? sign.description)
    : lang === 'en'
    ? (sign.descriptionEn ?? sign.description)
    : sign.description;

  const borderColor = isCorrect
    ? 'border-emerald-500/30'
    : timedOut
    ? 'border-orange-500/30'
    : 'border-red-500/30';

  return (
    <div
      className={cn(
        'w-full rounded-2xl border p-4 bg-[hsl(var(--option-bg))] mt-3',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        borderColor,
      )}
    >
      <div className="flex items-start gap-3">
        <BookOpen className="w-4 h-4 text-[hsl(var(--muted-foreground))] mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {/* Sign code badge */}
            <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border font-mono', badge?.cls)}>
              {sign.code}
            </span>
            <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{lang === 'ar' ? sign.nameAr : sign.name}</span>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{description}</p>
          {lang === 'ar' && (
            <p dir="ltr" className="text-[10px] text-[hsl(var(--muted-foreground))]/70 mt-1 italic">{sign.name}</p>
          )}
          {lang === 'en' && sign.nameEn && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]/60 mt-1 italic">{sign.nameEn}</p>
          )}
          {lang === 'sv' && sign.nameEn && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]/60 mt-1 italic">{sign.nameEn}</p>
          )}
        </div>
      </div>
    </div>
  );
}
