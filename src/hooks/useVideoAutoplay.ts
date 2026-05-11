import { useEffect, RefObject } from 'react';

/**
 * Autoplay a video when at least `threshold` of it is in the viewport.
 * Pauses on exit. Suppressed when the user prefers reduced motion or is on
 * data-saver / 2G connections. Falls back gracefully if autoplay rejects.
 *
 * Phase 1.5 polish:
 *  - Pauses on tab hidden (visibilitychange)
 *  - Hard-stops on unmount to prevent late play() resolving on a detached element
 *  - Re-observes if videoRef.current changes between renders
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

    let isVisible = false;
    let cancelled = false;

    const safePlay = () => {
      if (cancelled) return;
      el.muted = true;
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          /* autoplay rejected — leave paused, tap-to-play still works */
        });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isVisible = entry.isIntersecting;
          if (cancelled) return;
          if (isVisible && !document.hidden) {
            safePlay();
          } else if (!el.paused) {
            el.pause();
          }
        }
      },
      { threshold }
    );

    const onVisibilityChange = () => {
      if (cancelled) return;
      if (document.hidden) {
        if (!el.paused) el.pause();
      } else if (isVisible) {
        safePlay();
      }
    };

    observer.observe(el);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Hard-stop the element on unmount so a late-resolving play() doesn't warn.
      try {
        if (!el.paused) el.pause();
      } catch {
        /* ignore */
      }
    };
    // videoRef.current is intentionally tracked via the .current read at effect-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, videoRef.current, threshold, enabled]);
}
