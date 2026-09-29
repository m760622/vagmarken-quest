import type { ReactNode } from 'react';
import { X, Sun, Moon, Volume2, VolumeX, type LucideIcon } from 'lucide-react';
import { HighScore, Language } from '@/types/game';
import { t } from '@/constants/i18n';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { Theme } from '@/hooks/useTheme';
import PlayerCard from './PlayerCard';
import HighScorePanel from './HighScorePanel';
import BadgesPanel from './BadgesPanel';
import { versionLabel } from '@/lib/version';

interface MenuScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Language;
  scores: HighScore[];
  onClearScores: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-[15px] font-bold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2.5">
      <span className="w-1.5 h-4 rounded-full bg-brand-gradient" />
      {children}
    </h2>
  );
}

function SettingRow({ icon: Icon, label, value, checked, onClick }: {
  icon: LucideIcon; label: string; value: string; checked: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={checked}
      className="glass w-full rounded-2xl px-4 h-14 flex items-center gap-3 text-start transition-all active:scale-[0.98]"
    >
      <span className="w-9 h-9 rounded-xl grid place-items-center bg-[hsl(var(--foreground))]/5 shrink-0">
        <Icon className="w-[18px] h-[18px] text-[hsl(var(--brand-light))]" />
      </span>
      <span className="flex-1 font-display text-sm font-bold text-[hsl(var(--foreground))]">{label}</span>
      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{value}</span>
    </button>
  );
}

/** Full-height panel with the player's progress, records and settings, opened from the top bar. */
export default function MenuScreen({
  open, onOpenChange, lang, scores, onClearScores, theme, onToggleTheme, muted, onToggleMute,
}: MenuScreenProps) {
  const isRtl = lang === 'ar';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Rendered in a portal, outside the screen's own dir wrapper, so the direction is set here */}
      <SheetContent
        side="right"
        dir={isRtl ? 'rtl' : 'ltr'}
        className="w-full sm:max-w-md p-0 border-0 overflow-y-auto [&>button:last-child]:hidden"
      >
        <div className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-6">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="font-display text-xl font-extrabold text-[hsl(var(--foreground))]">
              {t(lang, 'menu')}
            </SheetTitle>
            <SheetClose
              aria-label={t(lang, 'menuClose')}
              className="glass w-10 h-10 rounded-2xl grid place-items-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <X className="w-5 h-5" />
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">{t(lang, 'menuDesc')}</SheetDescription>

          <PlayerCard lang={lang} />

          <section className="space-y-3">
            <Heading>{t(lang, 'menuRecords')}</Heading>
            <HighScorePanel scores={scores} onClear={onClearScores} lang={lang} />
            <BadgesPanel lang={lang} />
          </section>

          <section className="space-y-3">
            <Heading>{t(lang, 'menuSettings')}</Heading>
            <SettingRow
              icon={muted ? VolumeX : Volume2}
              label={t(lang, 'soundLabel')}
              value={t(lang, muted ? 'soundOff' : 'soundOn')}
              checked={!muted}
              onClick={onToggleMute}
            />
            <SettingRow
              icon={theme === 'dark' ? Moon : Sun}
              label={t(lang, 'themeLabel')}
              value={t(lang, theme === 'dark' ? 'themeDark' : 'themeLight')}
              checked={theme === 'dark'}
              onClick={onToggleTheme}
            />
          </section>

          <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
            {t(lang, 'menuVersion')} <bdi dir="ltr" className="font-semibold tabular-nums">{versionLabel()}</bdi>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
