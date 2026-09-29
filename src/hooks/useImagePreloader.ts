/**
 * useImagePreloader
 * Preloads all official sign PNG images into the browser cache on mount,
 * so signs appear instantly during gameplay without any loading flash.
 */

import { useEffect, useRef } from 'react';
import { TRAFFIC_SIGNS } from '@/constants/signs';

export function useImagePreloader() {
  const preloadedRef = useRef(false);

  useEffect(() => {
    // Only run once per app session
    if (preloadedRef.current) return;
    preloadedRef.current = true;

    const urls = TRAFFIC_SIGNS
      .map(sign => sign.imageUrl)
      .filter((url): url is string => Boolean(url));

    // Stagger loads in small batches to avoid flooding the network
    const BATCH_SIZE = 6;
    const BATCH_DELAY_MS = 120;

    let batchIndex = 0;

    function loadBatch() {
      const start = batchIndex * BATCH_SIZE;
      const batch = urls.slice(start, start + BATCH_SIZE);

      if (batch.length === 0) return;

      batch.forEach(url => {
        const img = new Image();
        // No crossOrigin: the CDN sends no CORS headers, so requesting in
        // CORS mode would block every image (and never match <img> cache).
        img.src = url;
        // No error handler needed — failures are silently ignored
        // (SignDisplay has its own SVG fallback)
      });

      batchIndex++;

      if (batchIndex * BATCH_SIZE < urls.length) {
        setTimeout(loadBatch, BATCH_DELAY_MS);
      }
    }

    // Delay first batch slightly so the initial render completes first
    const timer = setTimeout(loadBatch, 300);
    return () => clearTimeout(timer);
  }, []);
}
