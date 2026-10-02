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
  // The expected counts are counted here from the data with a plain filter, so they hold as signs are added.
  const lookCounts = (sign: (typeof all)[number]) => {
    const sameLook = all.filter(s => s.shape === sign.shape && s.color === sign.color);
    return { total: sameLook.length, inCategory: sameLook.filter(s => s.category === sign.category).length };
  };

  it('counts how many signs with the same shape and colour share the category', () => {
    const warning = all.find(s => s.category === 'warning')!;
    expect(lookFact(all, warning)).toEqual({ ...lookCounts(warning), exception: false });
    const prohibition = all.find(s => s.category === 'prohibition')!;
    expect(lookFact(all, prohibition)).toEqual({ ...lookCounts(prohibition), exception: false });
  });

  it('flags the rare exceptions: the give-way triangle is one of the many red triangles', () => {
    const giveWay = all.find(s => s.category === 'priority' && s.shape === 'triangle')!;
    const { total, inCategory } = lookCounts(giveWay);
    expect(inCategory).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThan(5 * inCategory);   // rare enough to be called an exception (under 20%)
    expect(lookFact(all, giveWay)).toEqual({ total, inCategory, exception: true });
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


describe('buildTwinRounds with the player\'s own mistakes', () => {
  const ids = (list: { id: string }[]) => list.map(s => s.id);
  const warning = all.filter(s => s.category === 'warning');

  it('is the same as before without personal data: nothing is marked personal', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(buildTwinRounds(all, 'all', 10, seeded(seed)).every(r => r.personal === false)).toBe(true);
    }
    // and empty personal data changes nothing either
    const plain = buildTwinRounds(all, 'all', 10, seeded(8));
    const empty = buildTwinRounds(all, 'all', 10, seeded(8), undefined, { mistakes: {}, confusions: {} });
    expect(ids(empty.map(r => r.target))).toEqual(ids(plain.map(r => r.target)));
    expect(empty.every(r => r.personal === false)).toBe(true);
  });

  it('takes 6 of 10 targets from the weak signs when there are enough of them', () => {
    const weakIds = warning.slice(0, 12).map(s => s.id);
    const mistakes = Object.fromEntries(weakIds.map(id => [id, 2]));
    for (let seed = 1; seed <= 50; seed++) {
      const rounds = buildTwinRounds(all, 'all', 10, seeded(seed), undefined, { mistakes, confusions: {} });
      expect(rounds.filter(r => weakIds.includes(r.target.id))).toHaveLength(6);
      expect(new Set(rounds.map(r => r.target.id)).size).toBe(10);
    }
  });

  it('takes all of the weak signs when there are fewer than 6, and marks exactly those rounds personal', () => {
    const mistakes = { [warning[0].id]: 3, [warning[1].id]: 1 };
    for (let seed = 1; seed <= 50; seed++) {
      const rounds = buildTwinRounds(all, 'all', 10, seeded(seed), undefined, { mistakes, confusions: {} });
      const targets = ids(rounds.map(r => r.target));
      expect(targets).toContain(warning[0].id);
      expect(targets).toContain(warning[1].id);
      expect(rounds.filter(r => r.personal).map(r => r.target.id).sort()).toEqual([warning[0].id, warning[1].id].sort());
    }
  });

  it('the more mistakes a sign has, the likelier it is a target when there is a choice', () => {
    const many = warning.slice(0, 20);
    const mistakes = Object.fromEntries(many.map((s, i) => [s.id, i === 0 ? 4 : 1]));
    let heavy = 0, light = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const targets = ids(buildTwinRounds(all, 'all', 10, seeded(seed), undefined, { mistakes, confusions: {} }).map(r => r.target));
      if (targets.includes(many[0].id)) heavy++;
      if (targets.includes(many[1].id)) light++;
    }
    expect(heavy).toBeGreaterThan(light);
  });

  it('offers the sign the player really mixed up with the target, every time that target comes up', () => {
    const a = warning[0], b = warning[5];
    const personal = { mistakes: {}, confusions: { [a.id]: { [b.id]: 3 } } };
    for (let seed = 1; seed <= 100; seed++) {
      const rounds = buildTwinRounds(all, 'all', 10, seeded(seed), undefined, personal);
      const round = rounds.find(r => r.target.id === a.id)!;          // a is the only weak sign, so it is always a target
      expect(round).toBeTruthy();
      expect(ids(round.options)).toContain(b.id);
      expect(round.personal).toBe(true);
    }
  });

  it('also offers the mixed-up sign the other way round (asked B, picked A: A is a foil for B)', () => {
    const a = warning[0], b = warning[5];
    const personal = { mistakes: { [b.id]: 2 }, confusions: { [a.id]: { [b.id]: 3 } } };   // b is weak, so it is a target; a was asked and b was picked... a is b's partner
    for (let seed = 1; seed <= 60; seed++) {
      const round = buildTwinRounds(all, 'all', 10, seeded(seed), undefined, personal).find(r => r.target.id === b.id)!;
      expect(ids(round.options)).toContain(a.id);
    }
  });

  it('marks a round personal when a real mix-up was used as a foil, even if the target was not weak', () => {
    // A is weak (asked, wrong pick B). When B comes up as a random target, A is offered next to it.
    const a = warning[0], b = warning[5];
    const personal = { mistakes: {}, confusions: { [a.id]: { [b.id]: 2 } } };
    let seen = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const round = buildTwinRounds(all, 'all', 10, seeded(seed), undefined, personal).find(r => r.target.id === b.id);
      if (!round) continue;
      seen++;
      expect(ids(round.options)).toContain(a.id);
      expect(round.personal).toBe(true);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('keeps to the chosen category for the targets: a weak sign from another category is not asked about', () => {
    const warningSign = warning[0];
    const rounds = buildTwinRounds(all, 'prohibition', 10, seeded(3), undefined, { mistakes: { [warningSign.id]: 4 }, confusions: {} });
    expect(rounds.every(r => r.target.category === 'prohibition')).toBe(true);
  });

  it('still builds valid rounds: each target once, distinct names, 2 then 3 options', () => {
    const mistakes = Object.fromEntries(warning.map(s => [s.id, 1]));
    const confusions = { [warning[0].id]: { [warning[1].id]: 2, [all.find(s => s.category === 'prohibition')!.id]: 1 } };
    for (let seed = 1; seed <= 100; seed++) {
      const rounds = buildTwinRounds(all, 'all', 10, seeded(seed), undefined, { mistakes, confusions });
      expect(rounds.map(r => r.options.length)).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 3, 3]);
      for (const r of rounds) {
        expect(r.options.filter(o => o.id === r.target.id)).toHaveLength(1);
        expect(new Set(r.options.map(o => o.name)).size).toBe(r.options.length);
      }
    }
  });
});
