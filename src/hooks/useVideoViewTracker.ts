import { useEffect, RefObject } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ANON_KEY = 'cg_anon_session_id';
const MIN_WATCH_MS = 2500;

function getAnonSessionId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

interface Options {
  videoRef: RefObject<HTMLVideoElement>;
  source?: 'post' | 'review' | 'entity';
  sourceId?: string;
  mediaPath: string;
  autoplayRef: RefObject<boolean>;
}

/**
 * Tracks a "real" video view (≥ 2.5s of visible playback) and POSTs once
 * per mount to the `track-media-view` edge function. No-ops silently when
 * `sourceId` is missing.
 */
export function useVideoViewTracker({
  videoRef,
  source = 'post',
  sourceId,
  mediaPath,
  autoplayRef,
}: Options) {
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !sourceId || !mediaPath) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let visible = false;
    let playing = !el.paused;
    let watchMs = 0;
    let lastTick = 0;
    let raf = 0;
    let sent = false;
    let cancelled = false;

    const tick = (ts: number) => {
      if (cancelled || sent) return;
      if (lastTick && visible && playing && !document.hidden) {
        watchMs += ts - lastTick;
        if (watchMs >= MIN_WATCH_MS) {
          sent = true;
          send();
          return;
        }
      }
      lastTick = ts;
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf || sent) return;
      lastTick = 0;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTick = 0;
    };

    const send = () => {
      stop();
      const payload = {
        source,
        sourceId,
        mediaPath,
        wasAutoplay: autoplayRef.current ?? false,
        watchMs: Math.round(watchMs),
        anonSessionId: getAnonSessionId(),
        trackerVersion: 'v1',
      };
      // Fire-and-forget; silent on failure.
      supabase.functions.invoke('track-media-view', { body: payload }).catch(() => {});
    };

    const onPlay = () => {
      playing = true;
      if (visible) start();
    };
    const onPause = () => {
      playing = false;
      stop();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else if (visible && playing) start();
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting && e.intersectionRatio >= 0.5;
          if (visible && playing && !document.hidden) start();
          else stop();
        }
      },
      { threshold: [0, 0.5, 1] }
    );

    io.observe(el);
    el.addEventListener('play', onPlay);
    el.addEventListener('playing', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onPause);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      stop();
      io.disconnect();
      el.removeEventListener('play', onPlay);
      el.removeEventListener('playing', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onPause);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [videoRef, source, sourceId, mediaPath, autoplayRef]);
}
