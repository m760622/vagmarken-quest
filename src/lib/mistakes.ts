/**
 * Signs the player got wrong, weighted by how often. A correct answer lowers the
 * weight; at zero the sign leaves the list ("fixed"). Powers the review mode.
 */
const STORAGE_KEY = 'vq-mistakes';
const MAX_WEIGHT = 4;

type Mistakes = Record<string, number>;

function load(): Mistakes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Mistakes;
    const clean: Mistakes = {};
    for (const [id, n] of Object.entries(p)) if (Number.isFinite(n) && n > 0) clean[id] = Math.min(MAX_WEIGHT, n);
    return clean;
  } catch {
    return {};
  }
}

let state: Mistakes = load();
const listeners = new Set<() => void>();

function commit(next: Mistakes) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage unavailable */ }
  listeners.forEach(l => l());
}

export const getMistakes = () => state;

export function subscribeMistakes(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function recordMistake(signId: string): void {
  commit({ ...state, [signId]: Math.min(MAX_WEIGHT, (state[signId] ?? 0) + 1) });
}

/** Lower the weight after a correct answer. Returns true when the sign is fully fixed. */
export function resolveMistake(signId: string): boolean {
  const weight = state[signId];
  if (!weight) return false;
  const next = { ...state };
  if (weight <= 1) delete next[signId]; else next[signId] = weight - 1;
  commit(next);
  return weight <= 1;
}

export const mistakeIds = (): string[] => Object.keys(state);
