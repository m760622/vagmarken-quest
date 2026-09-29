import { describe, expect, it } from 'vitest';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import { buildClassifyRounds, buildTwinRounds, CLASSIFY_ORDER, lookAlikes, lookFact } from '@/lib/gameLogic';
import { seeded } from './rng';

const all = TRAFFIC_SIGNS;

describe('lookAlikes', () => {
  it('lists signs with the same shape and colour first, and never the sign itself or a same-named sign', () => {
    for (const sign of all) {
      const list = lookAlikes(sign, all, seeded(7));
      expect(list.map(s => s.id)).not.toContain(sign.id);
      expect(list.every(s => s.name !== sign.name)).toBe(true);
      const closeCount = all.filter(s => s.id !== sign.id && s.name !== sign.name && s.shape === sign.shape && s.color === sign.color).length;
      expect(list.slice(0, closeCount).every(s => s.shape === sign.shape && s.color === sign.color)).toBe(true);
    }
  });

  it('has no duplicates', () => {
    const list = lookAlikes(all[0], all, seeded(3));
    expect(new Set(list.map(s => s.id)).size).toBe(list.length);
  });

  it('still finds look-alikes for a one-of-a-kind sign (the stop octagon)', () => {
    const stop = all.find(s => s.shape === 'octagon')!;
    expect(lookAlikes(stop, all, seeded(1)).length).toBeGreaterThan(2);
  });
});

describe('buildTwinRounds', () => {
  it('builds 10 rounds with different targets, each containing its target once', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rounds = buildTwinRounds(all, 'all', 10, seeded(seed));
      expect(rounds).toHaveLength(10);
      expect(new Set(rounds.map(r => r.target.id)).size).toBe(10);
      for (const r of rounds) {
        expect(r.options.filter(o => o.id === r.target.id)).toHaveLength(1);
        expect(new Set(r.options.map(o => o.name)).size).toBe(r.options.length);
      }
    }
  });

  it('starts with two options and moves to three from round 5', () => {
    const rounds = buildTwinRounds(all, 'all', 10, seeded(5));
    expect(rounds.map(r => r.options.length)).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 3, 3]);
  });

  it('almost always uses look-alikes with the target shape and colour', () => {
    let rounds = 0, alike = 0;
    for (let seed = 1; seed <= 100; seed++) {
      for (const r of buildTwinRounds(all, 'all', 10, seeded(seed))) { rounds++; if (r.lookAlike) alike++; }
    }
    expect(alike / rounds).toBeGreaterThan(0.9);
  });

  it('takes the targets from the chosen category', () => {
    const rounds = buildTwinRounds(all, 'prohibition', 10, seeded(9));
    expect(rounds.every(r => r.target.category === 'prohibition')).toBe(true);
    // and the foils are other red circles
    expect(rounds.every(r => r.options.every(o => o.shape === 'circle' && o.color === 'red'))).toBe(true);
  });

  it('tops a small category up so there are still 10 rounds', () => {
    expect(buildTwinRounds(all, 'additional', 10, seeded(2))).toHaveLength(10);
  });
});

describe('buildClassifyRounds', () => {
  it('builds 10 rounds whose answer is the sign category', () => {
    const rounds = buildClassifyRounds(all, 10, seeded(1));
    expect(rounds).toHaveLength(10);
    expect(rounds.every(r => r.answer === r.sign.category)).toBe(true);
  });

  it('shows every one of the 6 categories in a 10-round game (200 seeds)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const cats = new Set(buildClassifyRounds(all, 10, seeded(seed)).map(r => r.answer));
      expect([...cats].sort()).toEqual([...CLASSIFY_ORDER].sort());
    }
  });

  it('does not repeat a sign inside a game', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const ids = buildClassifyRounds(all, 10, seeded(seed)).map(r => r.sign.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('can run longer than the smallest category without failing', () => {
    expect(buildClassifyRounds(all, 30, seeded(4))).toHaveLength(30);
  });
});

describe('lookFact', () => {
  it('counts how many signs with the same shape and colour share the category', () => {
    const warning = all.find(s => s.category === 'warning')!;
    expect(lookFact(all, warning)).toEqual({ total: 35, inCategory: 34, exception: false });
    const prohibition = all.find(s => s.category === 'prohibition')!;
    expect(lookFact(all, prohibition)).toEqual({ total: 27, inCategory: 27, exception: false });
  });

  it('flags the rare exceptions: the give-way triangle is one of 35 red triangles', () => {
    const giveWay = all.find(s => s.category === 'priority' && s.shape === 'triangle')!;
    expect(lookFact(all, giveWay)).toEqual({ total: 35, inCategory: 1, exception: true });
  });

  it('a one-of-a-kind sign is not called an exception', () => {
    const stop = all.find(s => s.shape === 'octagon')!;
    expect(lookFact(all, stop)).toEqual({ total: 1, inCategory: 1, exception: false });
  });

  it('agrees with the data for every sign (the counts never exceed the totals)', () => {
    for (const s of all) {
      const f = lookFact(all, s);
      expect(f.inCategory).toBeGreaterThanOrEqual(1);
      expect(f.inCategory).toBeLessThanOrEqual(f.total);
    }
  });
});

