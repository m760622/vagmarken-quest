import { Sparkles } from 'lucide-react';
import { Language } from '@/types/game';
import { t } from '@/constants/i18n';

/** "+87 XP" reward chip shown on result screens. */
export default function XpChip({ earned, lang }: { earned: { gained: number; bonus: number } | null; lang: Language }) {
  if (!earned) return null;
  return (
    <div className="pop-in inline-flex flex-col items-center">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-gradient text-[hsl(var(--primary-foreground))] font-display font-extrabold text-sm shadow-glow">
        <Sparkles className="w-4 h-4" />
        +{earned.gained} {t(lang, 'xpUnit')}
      </div>
      {earned.bonus > 0 && (
        <span className="text-[11px] text-[hsl(var(--brand-light))] font-semibold mt-1.5">
          {t(lang, 'dailyBonus')} +{earned.bonus}
        </span>
      )}
    </div>
  );
}
