import { useCallback, useEffect, useState } from 'react';

/**
 * Global persistent mute state for feed videos.
 * Default: muted (required by browsers for autoplay).
 * Single source of truth in localStorage; all video instances stay in sync
 * via a custom event bus.
 */

const STORAGE_KEY = 'video.muted';
const EVENT = 'video-mute-change';

const readInitial = (): boolean => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return JSON.parse(raw) === true;
  } catch {
    return true;
  }
};

export function useVideoMute(): [boolean, (next?: boolean) => void] {
  const [muted, setMuted] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : readInitial()
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setMuted(detail);
    };
    window.addEventListener(EVENT, handler as EventListener);
    return () => window.removeEventListener(EVENT, handler as EventListener);
  }, []);

  const toggle = useCallback((next?: boolean) => {
    const value = typeof next === 'boolean' ? next : !readInitial();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
  }, []);

  return [muted, toggle];
}
