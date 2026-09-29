import { useEffect, useRef } from 'react';

/**
 * Small phones: every round starts from the top of the page, and after an answer the explanation
 * card (with its Next button) is scrolled into view. Attach the returned ref to that card.
 */
export function useRoundScroll(active: boolean, index: number, answered: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    if (answered) {
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      ref.current?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [active, index, answered]);
  return ref;
}
