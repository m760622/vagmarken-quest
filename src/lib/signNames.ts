import { Language, TrafficSign } from '@/types/game';

/** Sentence-friendly name: Arabic UI shows "Arabic (Swedish)", others the Swedish name. */
export function nameWithAr(sign: TrafficSign, lang: Language): string {
  return lang === 'ar' ? `${sign.nameAr} (${sign.name})` : sign.name;
}
