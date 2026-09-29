/**
 * The player's own mix-ups between signs ("asked X, picked Y"), kept on the device. The rules live in
 * confusionMap.ts; this file only loads and saves. Filled from recordEvent() when a game reports
 * which sign was picked, and read by Twins to build rounds from the pairs the player really confuses.
 */
import { addConfusion, easeConfusion, sanitizeConfusions, type ConfusionMap } from '@/lib/confusionMap';

const STORAGE_KEY = 'vq-confusions';

function load(): ConfusionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeConfusions(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

let state: ConfusionMap = load();

function commit(next: ConfusionMap) {
  if (next === state) return;
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage unavailable */ }
}

export const getConfusions = (): ConfusionMap => state;

/** The player was asked about `asked` and picked `picked`. */
export const recordConfusion = (asked: string, picked: string): void => commit(addConfusion(state, asked, picked));

/** `asked` was answered right with `others` on screen: those pairs count for less. */
export const resolveConfusions = (asked: string, others: readonly string[]): void => commit(easeConfusion(state, asked, others));
