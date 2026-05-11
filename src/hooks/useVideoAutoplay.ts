import { useEffect, RefObject } from 'react';

/**
 * Autoplay a video when at least `threshold` of it is in the viewport.
 * Pauses on exit. Suppressed when the user prefers reduced motion or is on
 * data-saver / 2G connections. Falls back gracefully if autoplay rejects.
 */

interface Options {
  threshold?: number;
  enabled?: boolean;
}

const shouldSuppressAutoplay = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  } catch {
    /* ignore */
  }
  const conn = (navigator as any).connection;
  if (conn) {
    if (conn.saveData) return true;
    const effective = conn.effectiveType as string | undefined;
    if (effective === '2g' || effective === 'slow-2g') return true;
  }
  return false;
};

export function useVideoAutoplay(
  videoRef: RefObject<HTMLVideoElement>,
  { threshold = 0.5, enabled = true }: Options = {}
) {
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !enabled) return;
    if (shouldSuppressAutoplay()) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Autoplay requires muted in most browsers.
            el.muted = true;
            const playPromise = el.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {
                /* autoplay rejected — leave paused, tap-to-play still works */
              });
            }
          } else {
            if (!el.paused) el.pause();
          }
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [videoRef, threshold, enabled]);
}
