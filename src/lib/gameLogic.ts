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
