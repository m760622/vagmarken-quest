/**
 * "My collection": every sign is a card that climbs five levels (a Leitner box).
 * A correct answer on a due card moves it up and pushes its next review further
 * away; a wrong answer drops it two levels. Level 5 counts as mastered.
 * The scheduling functions are pure (store and clock are parameters); only the
 * bottom half touches localStorage.
 */
import type { TrafficSign } from '@/types/game';
import { shuffle, type Rng } from '@/lib/gameLogic';

export interface CardState {
  level: number;   // 1..MAX_LEVEL; a sign that is not in the store is "not collected"
  due: number;     // epoch ms of the next review
  seen: number;    // answers given
  lapses: number;  // wrong answers
}
export type CollectionStore = Record<string, CardState>;

export const MAX_LEVEL = 5;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** Wait after reaching each level (index = level). */
export const INTERVAL_MS = [0, 10 * MIN, DAY, 3 * DAY, 7 * DAY, 21 * DAY];
export const SESSION_SIZE = 10;
export const MAX_NEW = 5;
/** A session is topped up with early reviews until it has at least this many cards. */
export const MIN_SESSION = 5;

export const levelOf = (store: CollectionStore, id: string): number => store[id]?.level ?? 0;

export function applyAnswer(store: CollectionStore, id: string, correct: boolean, now: number): CollectionStore {
  const prev = store[id];
  if (!prev) {
    // First meeting. A miss keeps it due right away so it comes back next session.
    return {
      ...store,
      [id]: { level: 1, due: correct ? now + INTERVAL_MS[1] : now, seen: 1, lapses: correct ? 0 : 1 },
    };
  }
  if (correct) {
    // Answering early proves nothing about the long gap, so only a due card moves up.
    if (prev.due > now) return { ...store, [id]: { ...prev, seen: prev.seen + 1 } };
    const level = Math.min(MAX_LEVEL, prev.level + 1);
    return { ...store, [id]: { ...prev, level, due: now + INTERVAL_MS[level], seen: prev.seen + 1 } };
  }
  const level = Math.max(1, prev.level - 2);
  return { ...store, [id]: { level, due: now + INTERVAL_MS[level], seen: prev.seen + 1, lapses: prev.lapses + 1 } };
}

export interface CollectionStats { total: number; unseen: number; learning: number; known: number; mastered: number }

export function collectionStats(store: CollectionStore, ids: readonly string[]): CollectionStats {
  const s: CollectionStats = { total: ids.length, unseen: 0, learning: 0, known: 0, mastered: 0 };
  for (const id of ids) {
    const l = levelOf(store, id);
    if (l === 0) s.unseen++;
    else if (l <= 2) s.learning++;
    else if (l < MAX_LEVEL) s.known++;
    else s.mastered++;
  }
  return s;
}

export interface SessionPlan {
  ids: string[];        // shuffled
  dueCount: number;     // reviews that are due
  newCount: number;     // signs met for the first time
  earlyCount: number;   // reviews brought forward to fill a short session
}

/**
 * Due cards first (the ones the player got wrong most often before the rest), then up to
 * `maxNew` new signs, and early reviews only if the session would be very short.
 */
export function planSession(
  store: CollectionStore,
  pool: readonly TrafficSign[],
  mistakes: Record<string, number>,
  now: number,
  rng: Rng = Math.random,
  size = SESSION_SIZE,
  maxNew = MAX_NEW,
): SessionPlan {
  const due = pool
    .filter(s => store[s.id] && store[s.id].due <= now)
    .sort((a, b) => (mistakes[b.id] ?? 0) - (mistakes[a.id] ?? 0) || store[a.id].due - store[b.id].due)
    .slice(0, size);
  const fresh = shuffle(pool.filter(s => !store[s.id]), rng).slice(0, Math.max(0, Math.min(maxNew, size - due.length)));
  let early: TrafficSign[] = [];
  if (due.length + fresh.length < MIN_SESSION) {
    early = pool
      .filter(s => store[s.id] && store[s.id].due > now)
      .sort((a, b) => store[a.id].due - store[b.id].due)
      .slice(0, MIN_SESSION - due.length - fresh.length);
  }
  return {
    ids: shuffle([...due, ...fresh, ...early].map(s => s.id), rng),
    dueCount: due.length,
    newCount: fresh.length,
    earlyCount: early.length,
  };
}

/** Earliest review still in the future (ms from now), or null. */
export function nextDueIn(store: CollectionStore, ids: readonly string[], now: number): number | null {
  let best: number | null = null;
  for (const id of ids) {
    const c = store[id];
    if (c && c.due > now && (best === null || c.due - now < best)) best = c.due - now;
  }
  return best;
}

/** Reviews due now or within `withinMs`. */
export function dueWithin(store: CollectionStore, ids: readonly string[], now: number, withinMs = 0): number {
  return ids.filter(id => store[id] && store[id].due <= now + withinMs).length;
}

/* ── Storage ─────────────────────────────────────────────────────── */

const STORAGE_KEY = 'vq-collection';

function load(): CollectionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<CardState>>;
    const clean: CollectionStore = {};
    for (const [id, c] of Object.entries(parsed)) {
      if (!c || !Number.isInteger(c.level) || (c.level as number) < 1 || (c.level as number) > MAX_LEVEL || !Number.isFinite(c.due)) continue;
      clean[id] = { level: c.level as number, due: c.due as number, seen: Number(c.seen) || 0, lapses: Number(c.lapses) || 0 };
    }
    return clean;
  } catch {
    return {};
  }
}

let state: CollectionStore = load();
const listeners = new Set<() => void>();

function commit(next: CollectionStore) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage unavailable */ }
  listeners.forEach(l => l());
}

export const getCollection = () => state;

export function subscribeCollection(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Record one answer; returns the card's level before and after. */
export function recordCollectionAnswer(id: string, correct: boolean, now = Date.now()): { before: number; after: number } {
  const before = levelOf(state, id);
  const next = applyAnswer(state, id, correct, now);
  commit(next);
  return { before, after: levelOf(next, id) };
}

/** Human-friendly wait, e.g. 10 minutes, 3 hours, 2 days. */
export function waitParts(ms: number): { n: number; unit: 'min' | 'h' | 'd' } {
  if (ms < 60 * MIN) return { n: Math.max(1, Math.round(ms / MIN)), unit: 'min' };
  if (ms < 2 * DAY) return { n: Math.max(1, Math.round(ms / (60 * MIN))), unit: 'h' };
  return { n: Math.round(ms / DAY), unit: 'd' };
}
