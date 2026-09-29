import { describe, expect, it } from 'vitest';
import { TRAFFIC_SIGNS } from '@/constants/signs';
import {
  applyAnswer, arrangeSession, collectionStats, dueWithin, INTERVAL_MS, MAX_LEVEL, MEET_GROUP, nextDueIn, planSession,
  recordCollectionAnswer, waitParts, type CollectionStore,
} from '@/lib/collection';
import { seeded } from './rng';

const all = TRAFFIC_SIGNS;
const ids = all.map(s => s.id);
const NOW = 1_700_000_000_000;
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const card = (level: number, due: number, seen = 1, lapses = 0) => ({ level, due, seen, lapses });

describe('review schedule', () => {
  // Written out on purpose: changing the schedule should be a conscious edit of this test too.
  it('waits 10 min, 1 day, 3 days, 7 days and 21 days after reaching levels 1 to 5', () => {
    expect(INTERVAL_MS.slice(1)).toEqual([10 * MIN, DAY, 3 * DAY, 7 * DAY, 21 * DAY]);
    expect(MAX_LEVEL).toBe(5);
  });
});

describe('applyAnswer', () => {
  it('collects a new sign answered right at level 1, due in 10 minutes', () => {
    const s = applyAnswer({}, 'A1', true, NOW);
    expect(s.A1).toEqual({ level: 1, due: NOW + 10 * MIN, seen: 1, lapses: 0 });
  });

  it('collects a new sign answered wrong too, and keeps it due at once', () => {
    const s = applyAnswer({}, 'A2', false, NOW);
    expect(s.A2).toEqual({ level: 1, due: NOW, seen: 1, lapses: 1 });
  });

  it('moves a due card up one level and schedules the next review', () => {
    const s = applyAnswer({ A1: card(1, NOW + 10 * MIN) }, 'A1', true, NOW + 11 * MIN);
    expect(s.A1.level).toBe(2);
    expect(s.A1.due).toBe(NOW + 11 * MIN + DAY);
  });

  it('does not move a card up when it is answered before it is due (only "seen" grows)', () => {
    const before = { A1: card(1, NOW + 10 * MIN) };
    const s = applyAnswer(before, 'A1', true, NOW + 1000);
    expect(s.A1).toEqual({ ...before.A1, seen: 2 });
  });

  it('takes level 4 to 5 (mastered) with a 21-day wait, and never beyond', () => {
    let s: CollectionStore = { A1: card(4, NOW, 5) };
    s = applyAnswer(s, 'A1', true, NOW);
    expect(s.A1.level).toBe(5);
    expect(s.A1.due).toBe(NOW + 21 * DAY);
    s = applyAnswer(s, 'A1', true, NOW + 21 * DAY);
    expect(s.A1.level).toBe(5);
  });

  it('drops two levels on a miss (5 to 3), counts a lapse and reschedules', () => {
    const s = applyAnswer({ A1: card(5, NOW, 9) }, 'A1', false, NOW);
    expect(s.A1).toEqual({ level: 3, due: NOW + 3 * DAY, seen: 10, lapses: 1 });
  });

  it('never drops below level 1', () => {
    expect(applyAnswer({ A1: card(2, NOW, 3) }, 'A1', false, NOW).A1.level).toBe(1);
    expect(applyAnswer({ A1: card(1, NOW, 3) }, 'A1', false, NOW).A1.level).toBe(1);
  });

  it('a miss on a card that is not due yet still costs levels (forgetting is real)', () => {
    const s = applyAnswer({ A1: card(4, NOW + 2 * DAY) }, 'A1', false, NOW);
    expect(s.A1.level).toBe(2);
  });

  it('does not change the store it was given', () => {
    const before: CollectionStore = { A1: card(2, NOW) };
    const snapshot = JSON.stringify(before);
    applyAnswer(before, 'A1', true, NOW);
    applyAnswer(before, 'A2', false, NOW);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('collectionStats', () => {
  it('splits the album into unseen, learning (1-2), known (3-4) and mastered (5)', () => {
    const store: CollectionStore = {
      [ids[0]]: card(1, 0), [ids[1]]: card(2, 0), [ids[2]]: card(3, 0), [ids[3]]: card(4, 0), [ids[4]]: card(5, 0),
    };
    expect(collectionStats(store, ids)).toEqual({ total: ids.length, unseen: ids.length - 5, learning: 2, known: 2, mastered: 1 });
  });
});

describe('planSession', () => {
  it('makes a first session of 5 new signs', () => {
    const plan = planSession({}, all, {}, NOW, seeded(1));
    expect(plan).toMatchObject({ newCount: 5, dueCount: 0, earlyCount: 0 });
    expect(new Set(plan.ids)).toHaveProperty('size', 5);
  });

  it('adds up to 5 new signs after the due cards', () => {
    const store: CollectionStore = {};
    ['A1', 'A2', 'A3'].forEach((id, i) => { store[id] = card(2, NOW - (i + 1) * 1000, 2); });
    const plan = planSession(store, all, { A3: 3 }, NOW, seeded(2));
    expect(plan).toMatchObject({ dueCount: 3, newCount: 5, earlyCount: 0 });
    expect(plan.ids).toHaveLength(8);
    expect(new Set(plan.ids)).toHaveProperty('size', 8);
  });

  it('fills a session with 10 reviews and no new signs when 30 are due, most-missed first', () => {
    const store: CollectionStore = {};
    all.slice(0, 30).forEach((s, i) => { store[s.id] = card(2, NOW - 1000 * (i + 1), 2); });
    const missed = all[29].id;   // the least overdue, so only the mistake weight can put it in
    const plan = planSession(store, all, { [missed]: 4 }, NOW, seeded(3));
    expect(plan).toMatchObject({ dueCount: 10, newCount: 0 });
    expect(plan.ids).toHaveLength(10);
    expect(plan.ids).toContain(missed);
  });

  it('never picks a card that is not due while due cards fill the session', () => {
    const store: CollectionStore = {};
    all.slice(0, 12).forEach(s => { store[s.id] = card(2, NOW - 1000, 2); });
    const later = all[40].id;
    store[later] = card(3, NOW + DAY, 2);
    const plan = planSession(store, all, {}, NOW, seeded(8));
    expect(plan.ids).not.toContain(later);
  });

  it('offers 5 early reviews, the soonest-due ones, when everything is up to date', () => {
    const store: CollectionStore = {};
    all.forEach((s, i) => { store[s.id] = card(3, NOW + (i + 1) * HOUR, 3); });
    const plan = planSession(store, all, {}, NOW, seeded(4));
    expect(plan).toMatchObject({ dueCount: 0, newCount: 0, earlyCount: 5 });
    expect([...plan.ids].sort()).toEqual(all.slice(0, 5).map(s => s.id).sort());
  });

  it('does not offer early reviews while there are enough new signs', () => {
    const store: CollectionStore = { A1: card(1, NOW + 10 * MIN) };
    const plan = planSession(store, all, {}, NOW, seeded(5));
    expect(plan.earlyCount).toBe(0);
    expect(plan.newCount).toBe(5);
  });

  it('only uses signs from the pool it is given', () => {
    const warning = all.filter(s => s.category === 'warning');
    const plan = planSession({}, warning, {}, NOW, seeded(6));
    expect(plan.ids.every(id => warning.some(w => w.id === id))).toBe(true);
  });
});

describe('arrangeSession', () => {
  const store: CollectionStore = { A1: card(2, NOW - 1000), A2: card(3, NOW - 2000) };

  it('puts the reviews first and introduces the new signs in groups of 3', () => {
    const { order, meetAt } = arrangeSession(store, ['N1', 'A1', 'N2', 'N3', 'A2', 'N4', 'N5']);
    expect(order).toEqual(['A1', 'A2', 'N1', 'N2', 'N3', 'N4', 'N5']);
    expect(meetAt).toEqual({ 2: ['N1', 'N2', 'N3'], 5: ['N4', 'N5'] });
  });

  it('introduces 5 new signs of a first session as 3 + 2', () => {
    const { order, meetAt } = arrangeSession({}, ['N1', 'N2', 'N3', 'N4', 'N5']);
    expect(order).toHaveLength(5);
    expect(Object.keys(meetAt).map(Number)).toEqual([0, 3]);
    expect(meetAt[0]).toHaveLength(3);
    expect(meetAt[3]).toHaveLength(2);
  });

  it('has no introduction when every sign is a review', () => {
    const { order, meetAt } = arrangeSession(store, ['A1', 'A2']);
    expect(order).toEqual(['A1', 'A2']);
    expect(meetAt).toEqual({});
  });

  it('shows a lone new sign on its own', () => {
    expect(arrangeSession(store, ['A1', 'N1']).meetAt).toEqual({ 1: ['N1'] });
  });

  it('keeps every sign exactly once and every new sign in exactly one group', () => {
    const plan = planSession({ A1: card(2, NOW - 1000) }, all, {}, NOW, seeded(11));
    const { order, meetAt } = arrangeSession({ A1: card(2, NOW - 1000) }, plan.ids);
    expect(new Set(order)).toHaveProperty('size', plan.ids.length);
    expect([...order].sort()).toEqual([...plan.ids].sort());
    const met = Object.values(meetAt).flat();
    expect(new Set(met)).toHaveProperty('size', met.length);
    expect(met.length).toBe(plan.newCount);
    Object.entries(meetAt).forEach(([at, group]) => {
      expect(group.length).toBeLessThanOrEqual(MEET_GROUP);
      expect(order.slice(Number(at), Number(at) + group.length)).toEqual(group);   // asked right after the introduction
    });
  });
});

describe('due helpers', () => {
  const store: CollectionStore = {};
  all.forEach((s, i) => { store[s.id] = card(3, NOW + (i + 1) * HOUR, 3); });

  it('dueWithin counts the cards due by then', () => {
    expect(dueWithin(store, ids, NOW, 5 * HOUR)).toBe(5);
    expect(dueWithin(store, ids, NOW)).toBe(0);
  });

  it('nextDueIn is the soonest future review, or null', () => {
    expect(nextDueIn(store, ids, NOW)).toBe(HOUR);
    expect(nextDueIn({}, ids, NOW)).toBeNull();
  });
});

describe('waitParts', () => {
  it('reports minutes under an hour, hours under two days, otherwise days', () => {
    expect(waitParts(10 * MIN)).toEqual({ n: 10, unit: 'min' });
    expect(waitParts(30_000)).toEqual({ n: 1, unit: 'min' });
    expect(waitParts(3 * HOUR)).toEqual({ n: 3, unit: 'h' });
    expect(waitParts(3 * DAY)).toEqual({ n: 3, unit: 'd' });
  });
});

describe('recordCollectionAnswer', () => {
  it('returns the level before and after (module store; localStorage is unavailable in node)', () => {
    const id = 'ZZ-test-sign';
    expect(recordCollectionAnswer(id, true, NOW)).toEqual({ before: 0, after: 1 });
    expect(recordCollectionAnswer(id, true, NOW + 11 * MIN)).toEqual({ before: 1, after: 2 });
    expect(recordCollectionAnswer(id, false, NOW + 12 * MIN)).toEqual({ before: 2, after: 1 });
  });
});
