import { describe, expect, it } from 'vitest';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { buildChoices, buildOddRounds, pickDistractors, revealLook, revealPoints, signPool } from '@/lib/gameLogic';
import { seeded } from './rng';

const all = TRAFFIC_SIGNS;

describe('buildChoices / pickDistractors', () => {
  it('always gives 4 distinct signs that include the answer (300 seeds)', () => {
    for (let i = 0; i < 300; i++) {
      const rng = seeded(i + 1);
      const sign = all[Math.floor(rng() * all.length)];
      const choices = buildChoices(sign, all, rng);
      expect(choices).toHaveLength(4);
      expect(new Set(choices.map(c => c.id)).size).toBe(4);
      expect(new Set(choices.map(c => c.name)).size).toBe(4);
      expect(choices.map(c => c.id)).toContain(sign.id);
    }
  });

  it('takes distractors from the same category when it has enough signs', () => {
    let same = 0, total = 0;
    for (let i = 0; i < 300; i++) {
      const rng = seeded(i + 1);
      const sign = all[Math.floor(rng() * all.length)];
      const d = pickDistractors(sign, all, 3, rng);
      total += d.length;
      same += d.filter(x => x.category === sign.category).length;
    }
    expect(same / total).toBeGreaterThan(0.7);
  });
});

describe('signPool', () => {
  it('tops a small category up to the minimum with other signs', () => {
    const own = all.filter(s => s.category === 'additional').length;   // a small category: the additional plates
    expect(own).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThan(own);
    const pool = signPool(all, 'additional', own + 1, seeded(3));
    expect(pool).toHaveLength(own + 1);
    expect(pool.filter(s => s.category === 'additional')).toHaveLength(own);
  });

  it('returns every sign for "all"', () => {
    expect(signPool(all, 'all', 6)).toHaveLength(all.length);
  });
});

describe('reveal scoring and look', () => {
  it('pays 100 at the start, 10 at the end and never less than 10', () => {
    expect(revealPoints(0)).toBe(100);
    expect(revealPoints(8000)).toBe(10);
    expect(revealPoints(99999)).toBe(10);
    expect(revealPoints(-5)).toBe(100);
  });

  it('pays less the longer the player waits', () => {
    const points = [0, 1000, 2000, 4000, 6000, 8000].map(ms => revealPoints(ms));
    points.forEach((p, i) => { if (i > 0) expect(p).toBeLessThanOrEqual(points[i - 1]); });
  });

  it('is heavily blurred and zoomed at the start and sharp at the end', () => {
    expect(revealLook(0)).toMatchObject({ blur: 22, scale: 1.6 });
    expect(revealLook(8000)).toMatchObject({ blur: 0, scale: 1 });
  });
});

describe('buildOddRounds', () => {
  it('builds valid rounds: 4 distinct signs, exactly 3 in one category, 1 odd (2000 rounds)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rounds = buildOddRounds(all, 'all', 10, seeded(seed));
      expect(rounds).toHaveLength(10);
      for (const r of rounds) {
        expect(r.tiles).toHaveLength(4);
        expect(new Set(r.tiles.map(t => t.id)).size).toBe(4);
        expect(new Set(r.tiles.map(t => t.name)).size).toBe(4);
        expect(r.tiles.filter(t => t.category === r.groupCategory)).toHaveLength(3);
        expect(r.odd.category).not.toBe(r.groupCategory);
        expect(r.tiles.map(t => t.id)).toContain(r.odd.id);
      }
    }
  });

  it('makes the early rounds easy and the later rounds hard (odd sign shares the shape)', () => {
    let easy = 0, easyOk = 0, hard = 0, hardOk = 0;
    for (let seed = 1; seed <= 200; seed++) {
      buildOddRounds(all, 'all', 10, seeded(seed)).forEach((r, i) => {
        if (i >= 4) { hard++; if (r.hard) hardOk++; } else { easy++; if (!r.hard) easyOk++; }
      });
    }
    expect(hardOk / hard).toBeGreaterThan(0.9);
    expect(easyOk / easy).toBeGreaterThan(0.9);
  });

  it('takes every group from the chosen category', () => {
    const rounds = buildOddRounds(all, 'mandatory', 10, seeded(9));
    expect(rounds.every(r => r.groupCategory === 'mandatory' && r.odd.category !== 'mandatory')).toBe(true);
  });

  it('still works for a 5-sign category', () => {
    const rounds = buildOddRounds(all, 'additional', 10, seeded(4));
    expect(rounds).toHaveLength(10);
    expect(rounds.every(r => r.groupCategory === 'additional')).toBe(true);
  });

  it('uses a different odd sign in every round', () => {
    const ids = buildOddRounds(all, 'all', 10, seeded(5)).map(r => r.odd.id);
    expect(new Set(ids)).toHaveProperty('size', 10);
  });
});
