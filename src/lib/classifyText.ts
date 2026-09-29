/**
 * The line shown after a Classify round: how reliably "this shape and colour" points to a category,
 * counted over the signs in the app. Nothing here is a rule written by hand; the numbers come from the data.
 */
import type { Language, TrafficSign } from '@/types/game';
import { lookFact } from '@/lib/gameLogic';

/** "Red triangles", as the subject of a sentence, per shape and colour that occur in the data. */
const LOOK_LABELS: Record<string, Record<Language, string>> = {
  'triangle/red':  { en: 'Red triangles',               sv: 'Röda trianglar',  ar: 'المثلثات الحمراء' },
  'circle/red':    { en: 'Red circles',                 sv: 'Röda cirklar',    ar: 'الدوائر الحمراء' },
  'circle/blue':   { en: 'Blue circles',                sv: 'Blå cirklar',     ar: 'الدوائر الزرقاء' },
  'square/blue':   { en: 'Blue squares and rectangles', sv: 'Blå fyrkanter',   ar: 'المربعات والمستطيلات الزرقاء' },
  'square/white':  { en: 'White squares and rectangles', sv: 'Vita fyrkanter', ar: 'المربعات والمستطيلات البيضاء' },
  'diamond/yellow': { en: 'Yellow diamonds',            sv: 'Gula romber',     ar: 'المعيّنات الصفراء' },
  'octagon/red':   { en: 'Red octagons',                sv: 'Röda åttkanter',  ar: 'المثمّنات الحمراء' },
};

export const lookLabel = (sign: TrafficSign, lang: Language): string | undefined =>
  LOOK_LABELS[`${sign.shape}/${sign.color}`]?.[lang];

/** e.g. "Red triangles: 34 of 35 are “Warning signs”." Undefined for a shape and colour without a label. */
export function lookSentence(all: readonly TrafficSign[], sign: TrafficSign, lang: Language, categoryLabel: string): string | undefined {
  const subject = lookLabel(sign, lang);
  if (!subject) return undefined;
  const { total, inCategory } = lookFact(all, sign);
  if (total === 1) {
    return lang === 'en' ? `${subject}: this is the only one (“${categoryLabel}”).`
      : lang === 'sv' ? `${subject}: den här är den enda (“${categoryLabel}”).`
      : `${subject}: هذه هي الوحيدة («${categoryLabel}»).`;
  }
  return lang === 'en' ? `${subject}: ${inCategory} of ${total} are “${categoryLabel}”.`
    : lang === 'sv' ? `${subject}: ${inCategory} av ${total} är “${categoryLabel}”.`
    : `${subject}: ${inCategory} من ${total} ضمن «${categoryLabel}».`;
}

export const EXCEPTION_NOTE: Record<Language, string> = {
  en: 'A rare exception, worth remembering.',
  sv: 'Ett sällsynt undantag, värt att komma ihåg.',
  ar: 'استثناء نادر يستحق التذكّر.',
};
