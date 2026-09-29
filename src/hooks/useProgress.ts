import { useEffect, useSyncExternalStore } from 'react';
import { getMistakes, subscribeMistakes } from '@/lib/mistakes';
import { getProgress, refreshMissions, subscribeProgress } from '@/lib/progress';

/** Live badges / missions / stats. Rolls missions over if the day changed. */
export function useProgress() {
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getProgress);
  useEffect(() => {
    refreshMissions();
    const onVisible = () => { if (document.visibilityState === 'visible') refreshMissions(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return progress;
}

/** Signs currently on the "review your mistakes" list. */
export function useMistakes() {
  const mistakes = useSyncExternalStore(subscribeMistakes, getMistakes, getMistakes);
  const ids = Object.keys(mistakes);
  return { ids, count: ids.length };
}
