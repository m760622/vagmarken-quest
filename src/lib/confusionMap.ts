/**
 * Which sign the player picked when another was asked ("asked X, picked Y"), as plain data with pure
 * functions (no storage; see confusions.ts). Counts are capped, so an old mix-up does not pile up
 * for ever, and a right answer eases the pairs it disproves.
 */

/** asked sign -> picked sign -> times it happened */
export type ConfusionMap = Record<string, Record<string, number>>;

export const MAX_COUNT = 4;
/** At most this many different wrong picks are remembered per asked sign. */
export const MAX_PARTNERS = 8;

/** The player was asked about `asked` and picked `picked`. */
export function addConfusion(map: ConfusionMap, asked: string, picked: string): ConfusionMap {
  if (asked === picked) return map;
  const row: Record<string, number> = { ...(map[asked] ?? {}) };
  row[picked] = Math.min(MAX_COUNT, (row[picked] ?? 0) + 1);
  const keys = Object.keys(row);
  if (keys.length > MAX_PARTNERS) {
    // make room by dropping the weakest other pair (the oldest of the weakest)
    const weakest = keys.filter(k => k !== picked).reduce((a, b) => (row[b] < row[a] ? b : a));
    delete row[weakest];
  }
  return { ...map, [asked]: row };
}

/** `asked` was answered right while `others` were on screen too: those pairs count for less now. */
export function easeConfusion(map: ConfusionMap, asked: string, others: readonly string[]): ConfusionMap {
  const row = map[asked];
  if (!row) return map;
  const next = { ...row };
  let changed = false;
  for (const o of others) {
    if (!next[o]) continue;
    changed = true;
    if (next[o] <= 1) delete next[o]; else next[o] -= 1;
  }
  if (!changed) return map;
  const out = { ...map };
  if (Object.keys(next).length > 0) out[asked] = next; else delete out[asked];
  return out;
}

export interface Partner { id: string; weight: number }

/** Signs mixed up with `id`, in either direction, strongest first. */
export function confusedWith(map: ConfusionMap, id: string): Partner[] {
  const weight = new Map<string, number>();
  for (const [picked, n] of Object.entries(map[id] ?? {})) weight.set(picked, (weight.get(picked) ?? 0) + n);
  for (const [asked, row] of Object.entries(map)) {
    if (asked !== id && row[id]) weight.set(asked, (weight.get(asked) ?? 0) + row[id]);
  }
  return [...weight].map(([partner, w]) => ({ id: partner, weight: w })).sort((a, b) => b.weight - a.weight);
}

/** How often the player picked something else when asked about `id`. */
export const confusionWeight = (map: ConfusionMap, id: string): number =>
  Object.values(map[id] ?? {}).reduce((sum, n) => sum + n, 0);

/** Keeps only well-formed entries: string ids, whole counts from 1 up, capped; no self pairs. */
export function sanitizeConfusions(raw: unknown): ConfusionMap {
  const clean: ConfusionMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
  for (const [asked, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const entries = Object.entries(row as Record<string, unknown>)
      .filter(([picked, n]) => picked !== asked && typeof n === 'number' && Number.isInteger(n) && n >= 1)
      .map(([picked, n]) => [picked, Math.min(MAX_COUNT, n as number)] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_PARTNERS);
    if (entries.length > 0) clean[asked] = Object.fromEntries(entries);
  }
  return clean;
}
