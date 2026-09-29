import { SignCategory } from '@/types/game';

/* ── Accent colours (HSL triples so they can take an alpha) ───────── */
export const CATEGORY_HUE: Record<SignCategory | 'all', string> = {
  all: 'var(--brand)',
  warning: '38 95% 56%',
  prohibition: '0 84% 62%',
  mandatory: '217 91% 64%',
  priority: '48 96% 55%',
  information: '199 92% 58%',
  additional: '250 70% 72%',
};
