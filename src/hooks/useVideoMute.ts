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

/** Read the persisted global mute value. Safe in non-DOM environments. */
export function readGlobalVideoMuted(): boolean {
  if (typeof window === 'undefined') return true;
  return readInitial();
}

/**
 * Set the global mute state and broadcast it to all subscribers.
 * Used by `useVideoMute().toggle` and by `useVideoAutoplay` when autoplay
 * forces the underlying <video> element to muted.
 */
export function setGlobalVideoMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(muted));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: muted }));
}

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
    setGlobalVideoMuted(value);
  }, []);

  return [muted, toggle];
}
