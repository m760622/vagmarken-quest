import type { Language } from '@/types/game';

/** Picks the text for the current language: `L('English', 'Svenska', 'العربية')`. */
export const l3 = (lang: Language) => (en: string, sv: string, ar: string): string =>
  lang === 'en' ? en : lang === 'sv' ? sv : ar;
