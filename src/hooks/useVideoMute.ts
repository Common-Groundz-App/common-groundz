import { useCallback, useEffect, useState } from 'react';

/**
 * Global persistent mute state for feed videos.
 * Default: muted (required by browsers for autoplay).
 * Single source of truth in localStorage; all video instances stay in sync
 * via a custom event bus.
 *
 * Phase 3.1 v2.4 — in-memory feed-session sound unlock.
 * The persisted store still tracks the user's raw global mute preference,
 * but cold-open autoplay safety requires the icon and managed autoplay
 * to ignore a stale persisted `muted = false` until the user explicitly
 * unmutes during this page session. This module adds a non-persisted
 * `feedSessionSoundEnabled` flag and exposes an effective muted value
 * derived as `persistedMuted || !feedSessionSoundEnabled`.
 */

const STORAGE_KEY = 'video.muted';
const EVENT = 'video-mute-change';
const SESSION_EVENT = 'video-session-sound-change';

let feedSessionSoundEnabled = false;

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

/** In-memory: did the user explicitly unmute the feed during this session? */
export function isFeedSessionSoundEnabled(): boolean {
  return feedSessionSoundEnabled;
}

export function markFeedSessionSoundEnabled(): void {
  if (feedSessionSoundEnabled) return;
  feedSessionSoundEnabled = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: true }));
  }
}

export function markFeedSessionSoundDisabled(): void {
  if (!feedSessionSoundEnabled) return;
  feedSessionSoundEnabled = false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: false }));
  }
}

export function useVideoMute(): [boolean, (next?: boolean) => void] {
  const [persistedMuted, setPersistedMuted] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : readInitial()
  );
  const [sessionEnabled, setSessionEnabled] = useState<boolean>(() =>
    feedSessionSoundEnabled
  );

  useEffect(() => {
    const muteHandler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setPersistedMuted(detail);
    };
    const sessionHandler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setSessionEnabled(detail);
    };
    window.addEventListener(EVENT, muteHandler as EventListener);
    window.addEventListener(SESSION_EVENT, sessionHandler as EventListener);
    return () => {
      window.removeEventListener(EVENT, muteHandler as EventListener);
      window.removeEventListener(SESSION_EVENT, sessionHandler as EventListener);
    };
  }, []);

  const effectiveMuted = persistedMuted || !sessionEnabled;

  const toggle = useCallback((next?: boolean) => {
    // Operate on the effective value so cold-open toggles behave as the
    // user expects (icon shows muted → tap → unmuted), regardless of any
    // stale persisted `false` left in localStorage.
    const currentEffective = readInitial() || !isFeedSessionSoundEnabled();
    const value = typeof next === 'boolean' ? next : !currentEffective;
    if (value) {
      markFeedSessionSoundDisabled();
      setGlobalVideoMuted(true);
    } else {
      markFeedSessionSoundEnabled();
      setGlobalVideoMuted(false);
    }
  }, []);

  return [effectiveMuted, toggle];
}
