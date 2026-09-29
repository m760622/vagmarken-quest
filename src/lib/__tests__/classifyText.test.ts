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

  it('writes the real counts for a warning sign (34 of 35 red triangles)', () => {
    const warning = all.find(s => s.category === 'warning')!;
    expect(lookSentence(all, warning, 'en', CATEGORY_LABELS_I18N.en.warning)).toBe('Red triangles: 34 of 35 are “Warning signs”.');
    expect(lookSentence(all, warning, 'sv', CATEGORY_LABELS_I18N.sv.warning)).toContain('34 av 35');
    expect(lookSentence(all, warning, 'ar', CATEGORY_LABELS_I18N.ar.warning)).toContain('34 من 35');
  });

  it('says "the only one" for a shape and colour that has a single sign (the stop octagon)', () => {
    const stop = all.find(s => s.shape === 'octagon')!;
    expect(lookSentence(all, stop, 'en', CATEGORY_LABELS_I18N.en.priority)).toContain('the only one');
    expect(lookSentence(all, stop, 'ar', CATEGORY_LABELS_I18N.ar.priority)).toContain('الوحيدة');
  });

  it('mentions the category of the sign itself, so a rare exception reads correctly', () => {
    const giveWay = all.find(s => s.category === 'priority' && s.shape === 'triangle')!;
    const line = lookSentence(all, giveWay, 'en', CATEGORY_LABELS_I18N.en.priority)!;
    expect(line).toBe('Red triangles: 1 of 35 are “Priority signs”.');
  });

  it('has an exception note in every language', () => {
    for (const lang of langs) expect(EXCEPTION_NOTE[lang].length).toBeGreaterThan(10);
  });
});
