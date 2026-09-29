/**
 * Pure helpers for the Reveal and Odd-one-out games (no React, no storage),
 * so they can be checked on their own.
 */
import type { SignCategory, TrafficSign } from '@/types/game';

export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wrong choices for a sign, preferring the same category: closer to what a real driver confuses. */
export function pickDistractors(sign: TrafficSign, all: readonly TrafficSign[], count = 3, rng: Rng = Math.random): TrafficSign[] {
  const others = all.filter(s => s.id !== sign.id && s.name !== sign.name);
  const same = shuffle(others.filter(s => s.category === sign.category), rng);
  const rest = shuffle(others.filter(s => s.category !== sign.category), rng);
  return [...same, ...rest].slice(0, count);
}

/** The sign plus three distractors, shuffled. */
export function buildChoices(sign: TrafficSign, all: readonly TrafficSign[], rng: Rng = Math.random): TrafficSign[] {
  return shuffle([sign, ...pickDistractors(sign, all, 3, rng)], rng);
}

/** Signs for a game from a category, topped up from all signs when the category is small. */
export function signPool(all: readonly TrafficSign[], category: SignCategory | 'all', minSize: number, rng: Rng = Math.random): TrafficSign[] {
  const pool = category === 'all' ? [...all] : all.filter(s => s.category === category);
  if (pool.length < minSize) {
    const extra = shuffle(all.filter(s => !pool.includes(s)), rng);
    pool.push(...extra.slice(0, minSize - pool.length));
  }
  return pool;
}

/* ── Reveal ──────────────────────────────────────────────────────── */

export const REVEAL_MS = 8000;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** 100 points the instant a round starts, falling to 10 when the sign is fully clear. */
export function revealPoints(elapsedMs: number, totalMs = REVEAL_MS): number {
  return 10 + Math.round(90 * (1 - clamp01(elapsedMs / totalMs)));
}

/** How blurred and zoomed the sign is: heavy at the start, sharp and full size at the end. */
export function revealLook(elapsedMs: number, totalMs = REVEAL_MS): { blur: number; scale: number } {
  const c = clamp01(elapsedMs / totalMs);
  return { blur: Math.round(22 * (1 - c) * 10) / 10, scale: Math.round((1.6 - 0.6 * c) * 1000) / 1000 };
}

/* ── Odd one out ─────────────────────────────────────────────────── */

export interface OddRound {
  tiles: TrafficSign[];          // four signs, shuffled
  odd: TrafficSign;              // the one from another category
  group: TrafficSign[];          // the three from the same category
  groupCategory: SignCategory;
  hard: boolean;                 // the odd sign shares its shape with the group
}

function commonShape(signs: TrafficSign[]): TrafficSign['shape'] {
  const n: Record<string, number> = {};
  for (const s of signs) n[s.shape] = (n[s.shape] ?? 0) + 1;
  return signs.reduce((best, s) => (n[s.shape] > n[best] ? s.shape : best), signs[0].shape);
}

/**
 * `count` rounds. Early rounds use an odd sign with a clearly different shape; from
 * `hardFrom` on the odd sign has the same shape as the others, so the category
 * (the meaning) is what tells it apart. With a category chosen, the group comes from it.
 */
export function buildOddRounds(
  all: readonly TrafficSign[],
  category: SignCategory | 'all',
  count = 10,
  rng: Rng = Math.random,
  hardFrom = Math.ceil(count * 0.4),
): OddRound[] {
  const byCat = new Map<SignCategory, TrafficSign[]>();
  for (const s of all) byCat.set(s.category, [...(byCat.get(s.category) ?? []), s]);
  const usable = [...byCat.entries()].filter(([, list]) => list.length >= 3).map(([c]) => c);
  const groupCats = category !== 'all' && usable.includes(category) ? [category] : usable;

  const usedOdd = new Set<string>();
  const rounds: OddRound[] = [];
  for (let i = 0; i < count; i++) {
    const wantHard = i >= hardFrom;
    // Some groups have no odd sign of the wanted kind left (e.g. few other triangles): try another group.
    let groupCategory = groupCats[0];
    let group: TrafficSign[] = [];
    let shape: TrafficSign['shape'] = 'circle';
    let candidates: TrafficSign[] = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      groupCategory = groupCats[Math.floor(rng() * groupCats.length)];
      group = shuffle(byCat.get(groupCategory)!, rng).slice(0, 3);
      shape = commonShape(group);
      const names = new Set(group.map(s => s.name));
      const others = all.filter(s => s.category !== groupCategory && !names.has(s.name));
      const fresh = others.filter(s => !usedOdd.has(s.id));
      const pool = fresh.length > 0 ? fresh : others;
      const matching = pool.filter(s => (s.shape === shape) === wantHard);
      candidates = matching.length > 0 ? matching : pool;
      if (matching.length > 0) break;
    }
    const odd = shuffle(candidates, rng)[0];
    usedOdd.add(odd.id);
    rounds.push({ tiles: shuffle([...group, odd], rng), odd, group, groupCategory, hard: odd.shape === shape });
  }
  return rounds;
}

/* ── Twins ───────────────────────────────────────────────────────── */

export interface TwinRound {
  target: TrafficSign;       // the sign that is named in the question
  options: TrafficSign[];    // the target and its look-alikes, shuffled (2 or 3)
  lookAlike: boolean;        // every option has the target's shape and colour
}

/**
 * Signs that can be mistaken for `sign`, best first: same shape and colour, then same
 * category, then same shape. Signs with the same name are never listed.
 */
export function lookAlikes(sign: TrafficSign, all: readonly TrafficSign[], rng: Rng = Math.random): TrafficSign[] {
  const others = all.filter(s => s.id !== sign.id && s.name !== sign.name);
  const close = shuffle(others.filter(s => s.shape === sign.shape && s.color === sign.color), rng);
  const sameCategory = shuffle(others.filter(s => s.category === sign.category && !close.includes(s)), rng);
  const sameShape = shuffle(others.filter(s => s.shape === sign.shape && !close.includes(s) && !sameCategory.includes(s)), rng);
  return [...close, ...sameCategory, ...sameShape];
}

/**
 * `count` rounds, each with a different target. Early rounds have two signs to choose from,
 * from `threeFrom` on there are three. The foils are look-alikes of the target.
 */
export function buildTwinRounds(
  all: readonly TrafficSign[],
  category: SignCategory | 'all',
  count = 10,
  rng: Rng = Math.random,
  threeFrom = Math.ceil(count * 0.4),
): TwinRound[] {
  const targets = shuffle(signPool(all, category, count, rng), rng).slice(0, count);
  return targets.map((target, i) => {
    const size = i >= threeFrom ? 3 : 2;
    const foils: TrafficSign[] = [];
    for (const s of lookAlikes(target, all, rng)) {
      if (foils.length === size - 1) break;
      if (!foils.some(f => f.name === s.name)) foils.push(s);
    }
    return {
      target,
      options: shuffle([target, ...foils], rng),
      lookAlike: foils.every(f => f.shape === target.shape && f.color === target.color),
    };
  });
}

/* ── Classify ────────────────────────────────────────────────────── */

/** The order the categories are offered in. */
export const CLASSIFY_ORDER: SignCategory[] = ['warning', 'prohibition', 'mandatory', 'information', 'priority', 'additional'];

export interface ClassifyRound {
  sign: TrafficSign;
  answer: SignCategory;
}

/**
 * `count` rounds. The categories take turns (in a shuffled order, again and again), so the small
 * ones (7 priority signs, 5 plates) come up as often as the big ones instead of almost never.
 */
export function buildClassifyRounds(all: readonly TrafficSign[], count = 10, rng: Rng = Math.random): ClassifyRound[] {
  const byCat = new Map<SignCategory, TrafficSign[]>();
  for (const s of all) byCat.set(s.category, [...(byCat.get(s.category) ?? []), s]);
  const cats = CLASSIFY_ORDER.filter(c => (byCat.get(c) ?? []).length > 0);
  const queues = new Map(cats.map(c => [c, shuffle(byCat.get(c)!, rng)] as const));

  const rounds: ClassifyRound[] = [];
  let turn: SignCategory[] = [];
  while (rounds.length < count && cats.length > 0) {
    if (turn.length === 0) turn = shuffle(cats, rng);
    const c = turn.pop()!;
    const queue = queues.get(c)!;
    if (queue.length === 0) queue.push(...shuffle(byCat.get(c)!, rng));   // small category used up: start over
    rounds.push({ sign: queue.pop()!, answer: c });
  }
  return shuffle(rounds, rng);
}

export interface LookFact {
  total: number;        // signs with this shape and colour
  inCategory: number;   // of those, how many are in the sign's own category
  exception: boolean;   // the sign is a rare one for its shape and colour
}

/** How reliably "this shape and colour" points to the sign's category, counted over the signs in the app. */
export function lookFact(all: readonly TrafficSign[], sign: TrafficSign): LookFact {
  const same = all.filter(s => s.shape === sign.shape && s.color === sign.color);
  const inCategory = same.filter(s => s.category === sign.category).length;
  return { total: same.length, inCategory, exception: same.length > 1 && inCategory / same.length < 0.2 };
}
