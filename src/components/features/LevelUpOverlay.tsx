import { useEffect, useState } from 'react';
import { Language } from '@/types/game';
import { t } from '@/constants/i18n';
import { onLevelUp, rankFor } from '@/lib/player';
import { useAudio } from '@/hooks/useAudio';
import { readLang, readMuted } from '@/lib/prefs';
import Confetti from './Confetti';

interface LevelUpEvent {
  level: number;
  rankChanged: boolean;
  lang: Language;
  muted: boolean;
}

/** Full-screen celebration when the player reaches a new level. */
export default function LevelUpOverlay() {
  const [ev, setEv] = useState<LevelUpEvent | null>(null);
  const { playLevelUp } = useAudio(ev?.muted ?? false);

  // Listen for level-ups; delay so the finished game's result screen shows first.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = onLevelUp((level, rankChanged) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setEv({ level, rankChanged, lang: readLang(), muted: readMuted() }), 1000);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (ev) playLevelUp();
  }, [ev, playLevelUp]);

  if (!ev) return null;
  const rank = rankFor(ev.level);
  const isRtl = ev.lang === 'ar';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md px-6"
      dir={isRtl ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      onClick={() => setEv(null)}
    >
      <Confetti count={60} />
      <div
        className="pop-in relative w-full max-w-xs rounded-[32px] p-8 text-center glass shadow-glow"
        style={{ border: '1px solid hsl(var(--brand) / 0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="glow-breathe absolute inset-4 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(closest-side, hsl(var(--brand) / 0.45), hsl(var(--accent-2) / 0.2) 65%, transparent)' }}
        />
        <div className="relative">
          <div className="text-7xl mb-2" aria-hidden="true">{rank.icon}</div>
          <p className="font-display text-sm font-bold tracking-widest uppercase text-[hsl(var(--brand-light))]">
            {t(ev.lang, 'levelUpTitle')}
          </p>
          <p className="font-display text-6xl font-extrabold text-brand-gradient leading-tight mt-1">
            {ev.level}
          </p>
          <p className="font-display text-xl font-bold text-[hsl(var(--foreground))] mt-1">
            {rank.names[ev.lang]}
          </p>
          {ev.rankChanged && (
            <p className="text-xs font-semibold text-amber-400 mt-2">✨ {t(ev.lang, 'newRankTitle')}</p>
          )}
          <button
            onClick={() => setEv(null)}
            className="mt-6 w-full py-3.5 rounded-2xl bg-brand-gradient text-[hsl(var(--primary-foreground))] font-display font-bold text-base shadow-glow transition-all hover:brightness-110 active:scale-[0.98]"
          >
            {t(ev.lang, 'continueBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
