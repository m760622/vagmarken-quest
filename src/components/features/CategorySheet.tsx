import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Language, SignCategory, TrafficSign } from '@/types/game';
import { CATEGORY_LABELS_I18N, t } from '@/constants/i18n';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { CATEGORY_HUE } from '@/constants/categories';
import { CategoryIcon } from './CategoryIcon';

type Choice = SignCategory | 'all';

const CHOICES = Object.keys(CATEGORY_HUE) as Choice[];
/** Fewer signs than this: some games top the set up with signs from other categories. */
const SMALL_SET = 8;
/** Signs previewed for "all" (stop, speed limit, children). */
const ALL_PREVIEW_IDS = ['B2', 'C31', 'A15'];

const signsIn = (c: Choice) => (c === 'all' ? TRAFFIC_SIGNS : TRAFFIC_SIGNS.filter(s => s.category === c));
const COUNTS = Object.fromEntries(CHOICES.map(c => [c, signsIn(c).length])) as Record<Choice, number>;

function previewSigns(c: Choice): TrafficSign[] {
  if (c === 'all') {
    return ALL_PREVIEW_IDS.map(id => TRAFFIC_SIGNS.find(s => s.id === id)).filter((s): s is TrafficSign => !!s);
  }
  return signsIn(c).slice(0, 3);
}

function signCountLabel(lang: Language, n: number): string {
  if (lang === 'sv') return `${n} skyltar`;
  if (lang === 'en') return `${n} signs`;
  return n <= 10 ? `${n} إشارات` : `${n} إشارة`;
}

function Thumb({ sign }: { sign: TrafficSign }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="w-9 h-9 rounded-lg bg-white/90 grid place-items-center overflow-hidden shrink-0" aria-hidden="true">
      {sign.imageUrl && !failed ? (
        <img src={sign.imageUrl} alt="" loading="lazy" className="w-full h-full object-contain p-0.5" onError={() => setFailed(true)} />
      ) : (
        <span className="text-base leading-none">{sign.symbol}</span>
      )}
    </span>
  );
}

interface CategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Language;
  selected: Choice;
  onSelect: (category: Choice) => void;
}

/** Bottom sheet for picking the sign category, with the size of each set and a preview of its signs. */
export default function CategorySheet({ open, onOpenChange, lang, selected, onSelect }: CategorySheetProps) {
  const isRtl = lang === 'ar';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Rendered in a portal, outside the screen's own dir wrapper, so the direction is set here */}
      <SheetContent
        side="bottom"
        dir={isRtl ? 'rtl' : 'ltr'}
        className="p-0 border-0 rounded-t-3xl max-h-[88vh] overflow-y-auto [&>button:last-child]:hidden"
      >
        <div className="px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 max-w-2xl mx-auto">
          <div className="mx-auto h-1 w-10 rounded-full bg-[hsl(var(--foreground))]/20" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="font-display text-xl font-extrabold text-[hsl(var(--foreground))]">
              {t(lang, 'chooseCategory')}
            </SheetTitle>
            <SheetClose
              aria-label={t(lang, 'sheetClose')}
              className="glass w-10 h-10 rounded-2xl grid place-items-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <X className="w-5 h-5" />
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">{t(lang, 'chooseCategory')}</SheetDescription>

          <div role="radiogroup" aria-label={t(lang, 'chooseCategory')} className="space-y-2.5">
            {CHOICES.map(c => {
              const isSelected = selected === c;
              const hue = CATEGORY_HUE[c];
              const count = COUNTS[c];
              return (
                <button
                  key={c}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => { onSelect(c); onOpenChange(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-2xl p-3 text-start transition-all active:scale-[0.98]',
                    !isSelected && 'glass',
                  )}
                  style={isSelected ? {
                    background: `hsl(${hue} / 0.16)`,
                    border: `1px solid hsl(${hue} / 0.8)`,
                  } : undefined}
                >
                  <span className="w-11 h-11 rounded-xl grid place-items-center bg-white/90 shadow-sm shrink-0">
                    <CategoryIcon category={c} className="w-6 h-6 text-slate-700" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-bold text-[hsl(var(--foreground))] leading-tight">
                      {CATEGORY_LABELS_I18N[lang][c]}
                    </span>
                    <span className="block text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {signCountLabel(lang, count)}
                    </span>
                    {c !== 'all' && count < SMALL_SET && (
                      <span className="block text-[11px] text-amber-400/90 mt-0.5 leading-snug">
                        {t(lang, 'categoryTopUp')}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {previewSigns(c).map(s => <Thumb key={s.id} sign={s} />)}
                  </span>
                  <span
                    className={cn('w-5 h-5 rounded-full grid place-items-center shrink-0', !isSelected && 'opacity-0')}
                    style={{ background: `hsl(${hue})` }}
                    aria-hidden="true"
                  >
                    <Check className="w-3 h-3 text-[hsl(var(--primary-foreground))]" strokeWidth={3.5} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
