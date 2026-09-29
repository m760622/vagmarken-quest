import { describe, expect, it } from 'vitest';
import {
  addConfusion, confusedWith, confusionWeight, easeConfusion, MAX_COUNT, MAX_PARTNERS, sanitizeConfusions, type ConfusionMap,
} from '@/lib/confusionMap';

describe('addConfusion', () => {
  it('counts "asked X, picked Y" and does not change the map it was given', () => {
    const before: ConfusionMap = { A1: { A2: 1 } };
    const snapshot = JSON.stringify(before);
    const after = addConfusion(addConfusion(before, 'A1', 'A2'), 'A1', 'A3');
    expect(after).toEqual({ A1: { A2: 2, A3: 1 } });
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('ignores picking the sign that was asked', () => {
    const map: ConfusionMap = {};
    expect(addConfusion(map, 'A1', 'A1')).toBe(map);
  });

  it('caps a pair at MAX_COUNT so an old mix-up does not pile up for ever', () => {
    let map: ConfusionMap = {};
    for (let i = 0; i < 20; i++) map = addConfusion(map, 'A1', 'A2');
    expect(map.A1.A2).toBe(MAX_COUNT);
  });

  it('remembers at most MAX_PARTNERS wrong picks per sign, and a new one always gets in (the weakest goes)', () => {
    let map: ConfusionMap = {};
    for (let i = 0; i < MAX_PARTNERS; i++) map = addConfusion(map, 'A1', `P${i}`);
    map = addConfusion(map, 'A1', 'P0');           // P0 is now stronger than the others
    map = addConfusion(map, 'A1', 'NEW');
    expect(Object.keys(map.A1)).toHaveLength(MAX_PARTNERS);
    expect(map.A1.NEW).toBe(1);
    expect(map.A1.P0).toBe(2);
    expect(map.A1.P1).toBeUndefined();              // the oldest of the weakest was dropped
  });
});

describe('easeConfusion', () => {
  it('lowers the pairs of the asked sign with the options that were shown, and removes a pair at zero', () => {
    const map: ConfusionMap = { A1: { A2: 2, A3: 1 } };
    const once = easeConfusion(map, 'A1', ['A2', 'A3']);
    expect(once).toEqual({ A1: { A2: 1 } });
    expect(easeConfusion(once, 'A1', ['A2'])).toEqual({});
  });

  it('leaves pairs alone that were not on screen, and other signs', () => {
    const map: ConfusionMap = { A1: { A2: 2 }, B1: { B2: 3 } };
    expect(easeConfusion(map, 'A1', ['A9'])).toBe(map);
    expect(easeConfusion(map, 'A1', ['A2']).B1).toEqual({ B2: 3 });
  });

  it('does nothing for a sign without confusions', () => {
    const map: ConfusionMap = { A1: { A2: 1 } };
    expect(easeConfusion(map, 'Z9', ['A2'])).toBe(map);
  });
});

describe('confusedWith / confusionWeight', () => {
  const map: ConfusionMap = { A1: { A2: 3, A3: 1 }, A4: { A1: 2 } };

  it('lists partners in both directions, strongest first', () => {
    expect(confusedWith(map, 'A1')).toEqual([{ id: 'A2', weight: 3 }, { id: 'A4', weight: 2 }, { id: 'A3', weight: 1 }]);
  });

  it('finds the asked sign when only the picked side is known', () => {
    expect(confusedWith(map, 'A2')).toEqual([{ id: 'A1', weight: 3 }]);
    expect(confusedWith(map, 'Z9')).toEqual([]);
  });

  it('weighs a sign by how often something else was picked when it was asked', () => {
    expect(confusionWeight(map, 'A1')).toBe(4);
    expect(confusionWeight(map, 'A2')).toBe(0);       // being picked wrongly does not make A2 a weak sign
  });
});

describe('sanitizeConfusions', () => {
  it('keeps good entries and drops junk', () => {
    const clean = sanitizeConfusions({
      A1: { A2: 2, A3: 0, A4: -1, A5: 1.5, A6: 'x', A1: 3, A7: 99 },
      B1: 'no', B2: [1, 2], B3: {}, B4: null,
    });
    expect(clean).toEqual({ A1: { A7: MAX_COUNT, A2: 2 } });
  });

  it('survives non-objects', () => {
    expect(sanitizeConfusions(null)).toEqual({});
    expect(sanitizeConfusions('x')).toEqual({});
    expect(sanitizeConfusions([1])).toEqual({});
  });
});
