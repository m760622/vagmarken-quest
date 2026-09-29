import { useState, useCallback } from 'react';

const STORAGE_KEY = 'vagmarken_progression';
export const UNLOCK_THRESHOLD = 80; // % correct on Medium to unlock Hard

interface ProgressionState {
  hardUnlocked: boolean;
  bestMediumPct: number; // 0–100
}

function load(): ProgressionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hardUnlocked: false, bestMediumPct: 0 };
    return JSON.parse(raw) as ProgressionState;
  } catch {
    return { hardUnlocked: false, bestMediumPct: 0 };
  }
}

function persist(state: ProgressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function useProgression() {
  const [progression, setProgression] = useState<ProgressionState>(load);
  const [justUnlocked, setJustUnlocked] = useState(false);

  /**
   * Call after a Medium quiz finishes.
   * Sets justUnlocked=true the first time Hard gets unlocked.
   */
  const recordMediumResult = useCallback((correct: number, total: number) => {
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    setProgression(prev => {
      const newBest = Math.max(prev.bestMediumPct, pct);
      const willUnlock = newBest >= UNLOCK_THRESHOLD;
      if (!prev.hardUnlocked && willUnlock) {
        setJustUnlocked(true);
      }
      const updated: ProgressionState = {
        hardUnlocked: willUnlock,
        bestMediumPct: newBest,
      };
      persist(updated);
      return updated;
    });
  }, []);

  const clearJustUnlocked = useCallback(() => setJustUnlocked(false), []);

  /** Dev helper — reset progression */
  const resetProgression = useCallback(() => {
    const reset: ProgressionState = { hardUnlocked: false, bestMediumPct: 0 };
    persist(reset);
    setProgression(reset);
    setJustUnlocked(false);
  }, []);

  return {
    progression,
    recordMediumResult,
    justUnlocked,
    clearJustUnlocked,
    resetProgression,
    UNLOCK_THRESHOLD,
  };
}
