import type { TrafficSign } from '@/types/game';

/**
 * Splits the full sign list into what the app may show and what still waits for its official image.
 * A sign flagged `placeholder` keeps its texts in the data but must never reach a screen, a quiz or a
 * count: without the real picture the only thing to draw is a generic glyph, which would teach a wrong sign.
 * Order is kept in both lists.
 */
export function splitSigns(all: readonly TrafficSign[]): { playable: TrafficSign[]; pending: TrafficSign[] } {
  const playable: TrafficSign[] = [];
  const pending: TrafficSign[] = [];
  for (const sign of all) (sign.placeholder ? pending : playable).push(sign);
  return { playable, pending };
}
