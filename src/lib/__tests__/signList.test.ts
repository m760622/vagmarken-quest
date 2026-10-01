import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_SIGNS, TRAFFIC_SIGNS } from '@/constants/signs';
import { splitSigns } from '@/lib/signList';
import type { TrafficSign } from '@/types/game';

const sign = (id: string, extra: Partial<TrafficSign> = {}): TrafficSign => ({
  id,
  code: id,
  name: id,
  nameEn: id,
  nameAr: 'إشارة',
  category: 'warning',
  shape: 'triangle',
  color: 'red',
  symbol: '!',
  description: id,
  descriptionAr: 'وصف',
  ...extra,
});

describe('splitSigns', () => {
  it('keeps every sign without the flag, in order, and sets the flagged ones aside', () => {
    const list = [sign('A1'), sign('A2', { placeholder: true }), sign('A3'), sign('A4', { placeholder: true }), sign('A5')];
    const { playable, pending } = splitSigns(list);
    expect(playable.map((s) => s.id)).toEqual(['A1', 'A3', 'A5']);
    expect(pending.map((s) => s.id)).toEqual(['A2', 'A4']);
  });

  it('treats placeholder: false like no flag at all', () => {
    expect(splitSigns([sign('A1', { placeholder: false })]).playable.map((s) => s.id)).toEqual(['A1']);
  });

  it('handles an empty list and a list that is all placeholders', () => {
    expect(splitSigns([])).toEqual({ playable: [], pending: [] });
    const only = [sign('B1', { placeholder: true })];
    expect(splitSigns(only)).toEqual({ playable: [], pending: only });
  });

  it('does not change the list it is given', () => {
    const list = [sign('A1'), sign('A2', { placeholder: true })];
    const copy = [...list];
    splitSigns(list);
    expect(list).toEqual(copy);
  });
});

describe('TRAFFIC_SIGNS (what the app shows)', () => {
  it('is ALL_SIGNS without the placeholders', () => {
    expect(TRAFFIC_SIGNS).toEqual(ALL_SIGNS.filter((s) => !s.placeholder));
    expect(TRAFFIC_SIGNS.some((s) => s.placeholder)).toBe(false);
  });
});

/**
 * The guarantee "a placeholder never reaches a screen, a quiz or a count" holds only while the app reads
 * TRAFFIC_SIGNS. ALL_SIGNS is for the data-integrity test; no source file may import it.
 */
describe('placeholder signs stay out of the app', () => {
  const srcDir = resolve(process.cwd(), 'src');
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it('has no source file besides constants/signs.ts that mentions ALL_SIGNS', () => {
    const offenders = sourceFiles(srcDir)
      .map((f) => relative(srcDir, f))
      .filter((f) => f !== join('constants', 'signs.ts'))
      .filter((f) => readFileSync(join(srcDir, f), 'utf8').includes('ALL_SIGNS'));
    expect(offenders).toEqual([]);
  });
});
