import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { awardXp, getPlayer, levelFromXp, rankFor, subscribePlayer } from '@/lib/player';
import { recordEvent, type GameMode } from '@/lib/progress';

/** Live player profile with derived level / rank information. */
export function usePlayer() {
  const player = useSyncExternalStore(subscribePlayer, getPlayer, getPlayer);
  const progress = levelFromXp(player.xp);
  return { player, ...progress, rank: rankFor(progress.level) };
}

export interface FinishPayload {
  mode: GameMode;
  xp: number;
  correct?: number;
  total?: number;
  maxStreak?: number;
  seconds?: number;
}

/**
 * Call once per finished game: awards XP and reports the game to the
 * missions/badges tracker exactly once when `done` flips to true.
 * Returns what was earned so the screen can show a "+XP" chip.
 */
export function useFinishGame(done: boolean, payload: FinishPayload): { gained: number; bonus: number } | null {
  const [earned, setEarned] = useState<{ gained: number; bonus: number } | null>(null);
  const awarded = useRef(false);
  const latest = useRef(payload);
  latest.current = payload;

  useEffect(() => {
    if (done && !awarded.current) {
      awarded.current = true;
      const p = latest.current;
      const r = awardXp(p.xp);
      setEarned({ gained: r.gained, bonus: r.bonus });
      recordEvent({ type: 'game', mode: p.mode, correct: p.correct, total: p.total, maxStreak: p.maxStreak, seconds: p.seconds });
    }
    if (!done && awarded.current) {
      awarded.current = false;
      setEarned(null);
    }
  }, [done]);

  return earned;
}
