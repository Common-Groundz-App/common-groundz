import { useEffect, useState, RefObject } from 'react';
import { readGlobalVideoMuted, setGlobalVideoMuted } from './useVideoMute';

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

/**
 * Returns true when autoplay should be suppressed for the current user/device:
 * reduced motion, save-data, or 2g/slow-2g connection. Exported so the
 * single-active-video manager (Phase 1) can apply the same gating without
 * duplicating play/pause ownership.
 */
export const shouldSuppressAutoplay = (): boolean => {
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

/**
 * Reactive version of `shouldSuppressAutoplay()`. Subscribes to
 * `prefers-reduced-motion` and `navigator.connection` changes so consumers
 * (e.g. the single-active feed video manager) re-evaluate suppression
 * without needing a remount. Does NOT subscribe to `visibilitychange` —
 * the manager handles tab visibility separately.
 */
export const useAutoplaySuppressed = (): boolean => {
  const [suppressed, setSuppressed] = useState<boolean>(() => shouldSuppressAutoplay());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setSuppressed(shouldSuppressAutoplay());

    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    } catch {
      mql = null;
    }
    mql?.addEventListener?.('change', update);

    const conn = (navigator as any).connection;
    conn?.addEventListener?.('change', update);

    // Sync once on mount in case state changed before subscription attached.
    update();

    return () => {
      mql?.removeEventListener?.('change', update);
      conn?.removeEventListener?.('change', update);
    };
  }, []);

  return suppressed;
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
      // Sync the global mute state so the UI icon reflects reality.
      // Browsers force-mute autoplaying videos, so any persisted "unmuted"
      // value from a prior session would otherwise show a wrong sound icon.
      if (!readGlobalVideoMuted()) {
        setGlobalVideoMuted(true);
      }
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
