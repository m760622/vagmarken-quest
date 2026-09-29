import { Volume2 } from 'lucide-react';
import type { Language } from '@/types/game';
import { cn } from '@/lib/utils';
import { l3 } from '@/lib/l3';
import { speakSwedish } from '@/lib/speech';
import { useSwedishVoice } from '@/hooks/useSwedishVoice';

/** A small speaker that says a Swedish name aloud. Renders nothing when the device has no Swedish voice. */
export default function SpeakButton({ text, lang, className }: { text: string; lang: Language; className?: string }) {
  const available = useSwedishVoice();
  if (!available) return null;
  const label = l3(lang)('Listen to the Swedish name', 'Lyssna på det svenska namnet', 'استمع إلى الاسم السويدي');
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); speakSwedish(text); }}
      aria-label={label}
      title={label}
      className={cn(
        'shrink-0 inline-grid place-items-center w-9 h-9 rounded-full border border-[hsl(var(--option-border))] bg-[hsl(var(--background))]/60 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--option-hover-border))] active:scale-95 transition-all',
        className,
      )}
    >
      <Volume2 className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
