import { describe, expect, it } from 'vitest';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { CATEGORY_LABELS_I18N } from '@/constants/i18n';
import { EXCEPTION_NOTE, lookLabel, lookSentence } from '@/lib/classifyText';
import type { Language } from '@/types/game';

const all = TRAFFIC_SIGNS;
const langs: Language[] = ['en', 'sv', 'ar'];

describe('classify texts', () => {
  it('has a label in every language for every shape and colour that occurs in the data', () => {
    for (const s of all) for (const lang of langs) {
      const label = lookLabel(s, lang);
      expect(label, `${s.shape}/${s.color} in ${lang}`).toBeTruthy();
    }
  });

  it('writes the real counts for a warning sign (counted here from the data, so it holds as signs are added)', () => {
    const warning = all.find(s => s.category === 'warning')!;
    const sameLook = all.filter(s => s.shape === warning.shape && s.color === warning.color);
    const total = sameLook.length;
    const inCategory = sameLook.filter(s => s.category === 'warning').length;
    expect(inCategory).toBeLessThan(total);   // the give-way triangle shares the look but is not a warning sign
    expect(lookSentence(all, warning, 'en', CATEGORY_LABELS_I18N.en.warning)).toBe(`Red triangles: ${inCategory} of ${total} are “Warning signs”.`);
    expect(lookSentence(all, warning, 'sv', CATEGORY_LABELS_I18N.sv.warning)).toContain(`${inCategory} av ${total}`);
    expect(lookSentence(all, warning, 'ar', CATEGORY_LABELS_I18N.ar.warning)).toContain(`${inCategory} من ${total}`);
  });

  it('says "the only one" for a shape and colour that has a single sign (the stop octagon)', () => {
    const stop = all.find(s => s.shape === 'octagon')!;
    expect(lookSentence(all, stop, 'en', CATEGORY_LABELS_I18N.en.priority)).toContain('the only one');
    expect(lookSentence(all, stop, 'ar', CATEGORY_LABELS_I18N.ar.priority)).toContain('الوحيدة');
  });

  it('mentions the category of the sign itself, so a rare exception reads correctly', () => {
    const giveWay = all.find(s => s.category === 'priority' && s.shape === 'triangle')!;
    const sameLook = all.filter(s => s.shape === giveWay.shape && s.color === giveWay.color);
    const inCategory = sameLook.filter(s => s.category === 'priority').length;
    const line = lookSentence(all, giveWay, 'en', CATEGORY_LABELS_I18N.en.priority)!;
    expect(line).toBe(`Red triangles: ${inCategory} of ${sameLook.length} are “Priority signs”.`);
  });

  it('has an exception note in every language', () => {
    for (const lang of langs) expect(EXCEPTION_NOTE[lang].length).toBeGreaterThan(10);
  });
});
