import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import type { SignCategory } from '@/types/game';

const SIGNS_DIR = resolve(process.cwd(), 'public/signs');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ARABIC = /[؀-ۿ]/;
const imageFile = (id: string) => resolve(SIGNS_DIR, `${id.toLowerCase()}.png`);

/** Section letter of a sign code → the category that section must carry. */
const CATEGORY_BY_SECTION: Record<string, SignCategory> = {
  A: 'warning',
  B: 'priority',
  C: 'prohibition',
  D: 'mandatory',
  E: 'information',
  T: 'additional',
};

const isFilled = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;

describe('TRAFFIC_SIGNS data integrity', () => {
  it('has signs at all', () => {
    expect(TRAFFIC_SIGNS.length).toBeGreaterThan(0);
  });

  it('has unique ids, and unique codes', () => {
    const dupes = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
    expect(dupes(TRAFFIC_SIGNS.map((s) => s.id))).toEqual([]);
    expect(dupes(TRAFFIC_SIGNS.map((s) => s.code))).toEqual([]);
  });

  it('uses ids of the form <section letter><number>[-<variant>], in a known section', () => {
    const bad = TRAFFIC_SIGNS.filter(
      (s) => !/^[A-Z]\d+(-\d+)?$/.test(s.id) || !(s.id[0] in CATEGORY_BY_SECTION),
    ).map((s) => s.id);
    expect(bad).toEqual([]);
  });

  it('has a code identical to its id', () => {
    const bad = TRAFFIC_SIGNS.filter((s) => s.code !== s.id).map((s) => `${s.id} (code ${s.code})`);
    expect(bad).toEqual([]);
  });

  it('keeps each sign in the category of its section letter', () => {
    const bad = TRAFFIC_SIGNS.filter((s) => s.category !== CATEGORY_BY_SECTION[s.id[0]]).map(
      (s) => `${s.id}: ${s.category}`,
    );
    expect(bad).toEqual([]);
  });

  it('has the three names (Swedish, English, Arabic) on every sign', () => {
    const bad = TRAFFIC_SIGNS.filter((s) => !isFilled(s.name) || !isFilled(s.nameEn) || !isFilled(s.nameAr)).map(
      (s) => s.id,
    );
    expect(bad).toEqual([]);
  });

  it('has an Arabic name that really contains Arabic letters', () => {
    expect(TRAFFIC_SIGNS.filter((s) => !ARABIC.test(s.nameAr)).map((s) => s.id)).toEqual([]);
  });

  it('has the mandatory descriptions (Swedish and Arabic), and no blank English one', () => {
    const missing = TRAFFIC_SIGNS.filter((s) => !isFilled(s.description) || !isFilled(s.descriptionAr)).map((s) => s.id);
    expect(missing).toEqual([]);
    expect(TRAFFIC_SIGNS.filter((s) => s.descriptionEn !== undefined && !isFilled(s.descriptionEn)).map((s) => s.id)).toEqual([]);
    expect(TRAFFIC_SIGNS.filter((s) => !ARABIC.test(s.descriptionAr)).map((s) => s.id)).toEqual([]);
  });

  it('points imageUrl at public/signs/<id>.png', () => {
    const bad = TRAFFIC_SIGNS.filter((s) => !s.imageUrl || !s.imageUrl.endsWith(`signs/${s.id.toLowerCase()}.png`)).map(
      (s) => `${s.id}: ${s.imageUrl}`,
    );
    expect(bad).toEqual([]);
  });

  it('has an existing image file for every sign', () => {
    expect(TRAFFIC_SIGNS.filter((s) => !existsSync(imageFile(s.id))).map((s) => s.id)).toEqual([]);
  });

  it('has image files that are real, non-empty PNGs', () => {
    const bad = TRAFFIC_SIGNS.filter((s) => {
      const file = imageFile(s.id);
      if (!existsSync(file)) return false; // reported by the test above
      return statSync(file).size < 100 || !readFileSync(file).subarray(0, 8).equals(PNG_MAGIC);
    }).map((s) => s.id);
    expect(bad).toEqual([]);
  });

  it('has no image file without a sign (orphan)', () => {
    const wanted = new Set(TRAFFIC_SIGNS.map((s) => `${s.id.toLowerCase()}.png`));
    expect(readdirSync(SIGNS_DIR).filter((f) => !wanted.has(f))).toEqual([]);
  });
});
