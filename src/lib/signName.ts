import type { Language, TrafficSign } from '@/types/game';

/** Sign name in the UI language: the Arabic UI shows the Arabic name. */
export function signName(sign: TrafficSign, lang: Language): string {
  return lang === 'ar' ? sign.nameAr : lang === 'en' ? (sign.nameEn || sign.name) : sign.name;
}

/** Swedish name shown under the Arabic one, so learners also see the name used in Swedish. */
export function signNameSecondary(sign: TrafficSign, lang: Language): string | null {
  return lang === 'ar' ? sign.name : null;
}

export function signDescription(sign: TrafficSign, lang: Language): string {
  return lang === 'ar' ? sign.descriptionAr : lang === 'en' ? (sign.descriptionEn || sign.description) : sign.description;
}
