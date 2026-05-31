import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, Film, AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useVideoMute, readGlobalVideoMuted, setGlobalVideoMuted } from '@/hooks/useVideoMute';
import { useVideoAutoplay, useAutoplaySuppressed } from '@/hooks/useVideoAutoplay';
import { useFeedVideoSlot } from '@/hooks/useFeedVideoManager';
import { useVideoMilestones } from '@/hooks/useVideoMilestones';
import { useVideoViewTracker } from '@/hooks/useVideoViewTracker';
import { formatDuration } from '@/utils/videoPoster';
import { extractMediaPath } from '@/utils/mediaPath';
import { analytics } from '@/services/analytics';
import { MediaItem, VideoHandoff, VideoExitHandoff } from '@/types/media';
import { isMuxPreparing, isMuxErroredOrBroken, resolveVideoSrc, maybeEmitBrokenReady, muxPosterUrl, isMuxPlayable } from '@/utils/muxMedia';
import { prewarmMuxHls } from '@/utils/prewarmMuxHls';
import { attachHls, type AttachToken } from '@/utils/hlsAttach';
import { MuxPreparingPoster } from '@/components/media/MuxPreparingPoster';
import { captureVideoFrame } from '@/utils/captureVideoFrame';
import { isCorsSafeVideoHost } from '@/utils/corsSafeHosts';
import type { LightboxEntryExtras } from '@/components/media/lightboxTypes';
import {
  saveFeedVideoResume,
  readFeedVideoResume,
  clearFeedVideoResume,
  FEED_VIDEO_RESUME_MIN,
} from '@/hooks/useFeedVideoResumeStore';
import {
  readFeedVideoUserPaused,
  writeFeedVideoUserPaused,
  clearFeedVideoUserPaused,
} from '@/hooks/useFeedVideoPauseStore';

// Phase 3 v5.1 — SSR-safe layout effect. Vite app is client-only today,
// but this degrades cleanly to useEffect in any Node/test/SSG path.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Phase 3 — system pause/play event guard timeout. Default tolerates
// Safari/iOS/HLS media-event scheduling. Per-site overrides for slower
// paths (source attach/detach: 1000ms, lightbox handoff: 750ms).
const SYSTEM_EVENT_TIMEOUT_DEFAULT_MS = 500;

interface FeedVideoProps {
  item: MediaItem;
  className?: string;
  onTap?: (handoff?: VideoHandoff, extras?: LightboxEntryExtras) => void;
  showBadge?: boolean;
  objectFit?: 'contain' | 'cover';
  source?: 'post' | 'review' | 'entity';
  sourceId?: string;
  /**
   * Composer-only: when set, bypasses Mux status branching and uses this
   * URL as a plain (non-HLS) <video> source. Used for local blob previews
   * before Mux finishes transcoding.
   */
  srcOverride?: string;
  /**
   * Reverse handoff from the lightbox: when present, this video applies
   * the carried mute/timestamp/play state once and then calls
   * `onResumeConsumed`. Only the originally-opened tile receives this.
   */
  resumeState?: VideoExitHandoff;
  onResumeConsumed?: () => void;
}

type Status = 'loading' | 'ready' | 'error' | 'unsupported';

interface VideoProgressBarProps {
  currentTime: number;
  duration: number;
  isActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  onSeek: (time: number) => void;
}

function VideoProgressBar({
  currentTime,
  duration,
  isActive,
  videoRef,
  onScrubStart,
  onScrubEnd,
  onSeek,
}: VideoProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const wasPlayingRef = useRef(false);
  const scrubbingRef = useRef(false);

  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      const v = videoRef.current;
      if (!bar || !v || !duration) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const t = ratio * duration;
      try {
        v.currentTime = t;
      } catch {
        /* ignore */
      }
      onSeek(t);
    },
    [duration, onSeek, videoRef]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const v = videoRef.current;
    if (!v) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    wasPlayingRef.current = !v.paused;
    scrubbingRef.current = true;
    onScrubStart();
    try {
      v.pause();
    } catch {
      /* ignore */
    }
    seekFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return;
    e.stopPropagation();
    seekFromClientX(e.clientX);
  };

  const endScrub = (e: React.PointerEvent) => {
    if (!scrubbingRef.current) return;
    e.stopPropagation();
    scrubbingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const v = videoRef.current;
    if (v && wasPlayingRef.current) {
      v.play().catch(() => {});
    }
    onScrubEnd();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.stopPropagation();
    e.preventDefault();
    const v = videoRef.current;
    if (!v) return;
    const delta = e.key === 'ArrowRight' ? 5 : -5;
    const next = Math.min(duration, Math.max(0, v.currentTime + delta));
    try {
      v.currentTime = next;
    } catch {
      /* ignore */
    }
    onSeek(next);
  };

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Seek video"
      aria-valuemin={0}
      aria-valuemax={duration || 0}
      aria-valuenow={currentTime}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endScrub}
      onPointerCancel={endScrub}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
      className="relative w-full h-3 flex items-center cursor-pointer touch-none select-none"
    >
      {/* Track */}
      <div
        className={cn(
          'relative w-full rounded-full bg-white/30 overflow-hidden motion-safe:transition-all',
          isActive ? 'h-1' : 'h-0.5'
        )}
      >
        <div
          className="absolute inset-y-0 left-0 bg-white"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Thumb (active only) */}
      {isActive && duration > 0 && (
        <div
          className="absolute h-3 w-3 rounded-full bg-white shadow pointer-events-none"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      )}
    </div>
  );
}

export function FeedVideo(props: FeedVideoProps) {
  // ============================================================================
  // Zero-hook dispatcher. Keeps the locked render branching order while
  // ensuring FeedVideoPlayer's hook count is invariant for its lifetime.
  // See src/utils/renderBranching.ts.
  //   1. errored or broken-ready  → errored poster + one-shot telemetry
  //   2. preparing                → preparing poster
  //   3. otherwise                → FeedVideoPlayer (Mux HLS or legacy)
  // ============================================================================
  const { item, className, objectFit = 'contain', srcOverride } = props;
  // Composer local-preview override short-circuits Mux status branches so
  // the user sees the same custom controls as the legacy (Mux-off) path.
  if (!srcOverride) {
    if (isMuxErroredOrBroken(item)) {
      maybeEmitBrokenReady(item, (e, p) => analytics.track(e, p));
      return (
        <MuxPreparingPoster
          item={item}
          className={cn('rounded-md', className)}
          objectFit={objectFit === 'contain' ? 'contain' : 'cover'}
        />
      );
    }
    if (isMuxPreparing(item)) {
      return (
        <MuxPreparingPoster
          item={item}
          className={cn('rounded-md', className)}
          objectFit={objectFit === 'contain' ? 'contain' : 'cover'}
        />
      );
    }
  }
  return <FeedVideoPlayer {...props} />;
}

function FeedVideoPlayer({
  item,
  className,
  onTap,
  showBadge = true,
  objectFit = 'contain',
  source = 'post',
  sourceId,
  srcOverride,
  resumeState,
  onResumeConsumed,
}: FeedVideoProps) {



  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, toggleMute] = useVideoMute();
  const playedRef = useRef(false);
  const autoplayRef = useRef<boolean>(true);
  const userPausedRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);
  // Tracks whether the current source is HLS-attached (Mux) and whether
  // attachHls already reported an unrecoverable failure. Used so a later
  // native <video onError> (code === 4) cannot downgrade an HLS load
  // failure to a misleading "format unsupported" state.
  const isHlsSourceRef = useRef(false);
  const hlsUnrecoverableRef = useRef(false);

  const [status, setStatus] = useState<Status>('loading');
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setIsPortrait] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  const isActive = isHovered || isFocused || isScrubbing || !isPlaying || forceShow;

  // Phase 1: single-active-video manager. If a FeedVideoManagerProvider is
  // present, `managed` is true and the manager owns play/pause via
  // `slotIsActive`. Otherwise we fall back to the legacy useVideoAutoplay
  // path so unwrapped surfaces (composer previews, etc.) behave as before.
  const stableSlotId = item.id ?? `${sourceId ?? 'anon'}:${item.url}`;
  const { managed, isActive: slotIsActive, registerEl: registerSlotEl } = useFeedVideoSlot(stableSlotId);

  useVideoAutoplay(videoRef, {
    threshold: 0.5,
    enabled: !managed && autoplayEnabled && !isScrubbing,
  });
  useVideoMilestones(videoRef, { src: item.url, autoplayRef });
  useVideoViewTracker({
    videoRef,
    source,
    sourceId,
    mediaPath: extractMediaPath(item.url),
    autoplayRef,
  });

  // Register the <video> element with the manager (and on unmount).
  useEffect(() => {
    if (!managed) return;
    registerSlotEl(videoRef.current);
    return () => registerSlotEl(null);
  }, [managed, registerSlotEl]);

  // Reactive autoplay suppression — re-evaluates when the user toggles
  // reduced-motion / save-data while the feed is open.
  const autoplaySuppressed = useAutoplaySuppressed();

  // Keep an always-fresh ref of slotIsActive so the inactive-play listener
  // below can read the current value without detach/reattach churn.
  const slotIsActiveRef = useRef(slotIsActive);
  useEffect(() => { slotIsActiveRef.current = slotIsActive; }, [slotIsActive]);

  // ===== Phase 2 — saved-time resume LRU =====
  // resumePendingRef: true between "resume seek requested" and "seek done /
  //   timed out". Guards the managed playback effect from calling play()
  //   before the saved time is applied (no visible flash from 0).
  // activationTokenRef: bumped on slot deactivation, source swap (id or
  //   url), and unmount. Captured by every in-flight resume so stale
  //   async callbacks can detect they're out-of-date and skip.
  // prevStableSlotIdRef / prevItemUrlRef: drive Safeguard D — clear the
  //   previous LRU entry whenever EITHER changes (the url-watch is the
  //   v3 fix; stable item.id can mask a real source swap).
  // resumeTick: bumped by finalize() to wake the managed playback effect
  //   once a pending resume completes (or times out).
  const resumePendingRef = useRef(false);
  const activationTokenRef = useRef(0);
  const prevStableSlotIdRef = useRef<string | null>(null);
  const prevItemUrlRef = useRef<string | null>(null);
  const prevSlotIsActiveRef = useRef(slotIsActive);
  const [resumeTick, setResumeTick] = useState(0);
  const stableSlotIdRef = useRef(stableSlotId);
  useEffect(() => { stableSlotIdRef.current = stableSlotId; }, [stableSlotId]);

  // Safeguard D (v3) — source-swap clears the previous key.
  // Tracks BOTH stableSlotId and item.url because when item.id is present,
  // stableSlotId can stay the same across a real url swap (e.g. admin
  // re-encode under the same media id). Either change invalidates any
  // in-flight resume and wipes the old LRU entry.
  useEffect(() => {
    const prevId = prevStableSlotIdRef.current;
    const prevUrl = prevItemUrlRef.current;
    const idChanged = prevId !== null && prevId !== stableSlotId;
    const urlChanged = prevUrl !== null && prevUrl !== item.url;

    if (idChanged || urlChanged) {
      if (prevId !== null) clearFeedVideoResume(prevId);
      activationTokenRef.current++;
      resumePendingRef.current = false;
    }

    prevStableSlotIdRef.current = stableSlotId;
    prevItemUrlRef.current = item.url;
  }, [stableSlotId, item.url]);

  // ===== Capture helpers =====
  // Two distinct paths so HLS-induced spurious `pause` at t=0 cannot
  // destroy a real 12s entry, while *intentional* deactivation with
  // near-zero progress DOES clear the stale old entry.
  const captureResumeFromPause = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    // Safeguard C — pause-capture sanity. Require metadata + finite + >0.
    if (el.readyState < 1) return;
    const t = el.currentTime;
    if (!Number.isFinite(t) || t <= 0) return;
    saveFeedVideoResume(stableSlotIdRef.current, t, el.duration);
  }, []);

  const captureResumeFromIntent = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const t = el.currentTime;
    const id = stableSlotIdRef.current;
    if (!Number.isFinite(t) || t < FEED_VIDEO_RESUME_MIN) {
      // Safeguard E — intentional near-zero capture clears stale entry.
      clearFeedVideoResume(id);
      return;
    }
    saveFeedVideoResume(id, t, el.duration);
  }, []);

  // v3.1 Refinement 2 — ref-based call site for captureResumeFromIntent.
  // Future-proofs the transition + unmount effects against this callback
  // ever growing real deps (right now it's `useCallback([], ...)` reading
  // from refs, but the safety net is cheap).
  const captureResumeFromIntentRef = useRef(captureResumeFromIntent);
  useEffect(() => {
    captureResumeFromIntentRef.current = captureResumeFromIntent;
  }, [captureResumeFromIntent]);

  // Resume-on-activation effect. Declared BEFORE the managed playback
  // effect so React commits resumePendingRef = true in the same pass that
  // the managed effect reads it (the managed effect re-runs when
  // resumeTick changes, ensuring it sees the cleared flag).
  useEffect(() => {
    if (!managed || !slotIsActive) return;
    // Lightbox handoff owns this activation — let it apply the time and
    // write the LRU itself (see apply() below).
    if (resumeState) return;

    const el = videoRef.current;
    if (!el) return;

    const saved = readFeedVideoResume(stableSlotId);
    if (saved === null || saved < FEED_VIDEO_RESUME_MIN) return;

    const myToken = ++activationTokenRef.current;
    const capturedEl = el;
    const capturedUrl = item.url;
    resumePendingRef.current = true;

    let finalized = false;
    let metaTimer: number | null = null;
    let seekTimer: number | null = null;
    let metaListener: (() => void) | null = null;
    let seekedListener: (() => void) | null = null;

    const detachListeners = () => {
      if (metaListener) {
        try { capturedEl.removeEventListener('loadedmetadata', metaListener); } catch { /* ignore */ }
        metaListener = null;
      }
      if (seekedListener) {
        try { capturedEl.removeEventListener('seeked', seekedListener); } catch { /* ignore */ }
        seekedListener = null;
      }
    };

    const clearTimers = () => {
      if (metaTimer !== null) { window.clearTimeout(metaTimer); metaTimer = null; }
      if (seekTimer !== null) { window.clearTimeout(seekTimer); seekTimer = null; }
    };

    // Safeguard A — idempotent finalizer. Always called exactly once via
    // some path: seeked, post-seek timeout, pre-metadata timeout, or
    // effect cleanup. Bumps resumeTick so the managed effect re-runs and
    // can now call play() with the saved time already applied.
    //
    // v3.1 Refinement 1 — accepts { bumpTick }. Cleanup paths pass false
    // so we never schedule a setState during unmount or dep-change tear-
    // down (React's cleanup ordering doesn't guarantee a mount-ref guard
    // would still read `true` here). Listeners/timers/pending flag are
    // always cleared regardless.
    const finalize = (options?: { bumpTick?: boolean }) => {
      if (finalized) return;
      finalized = true;
      detachListeners();
      clearTimers();
      resumePendingRef.current = false;
      if (options?.bumpTick !== false) {
        setResumeTick((t) => t + 1);
      }
    };

    // Safeguard B — every async callback re-checks token / element / url /
    // active. Mismatch → skip without applying the seek.
    const stillCurrent = () =>
      activationTokenRef.current === myToken &&
      slotIsActiveRef.current === true &&
      videoRef.current === capturedEl &&
      item.url === capturedUrl;

    const applySeek = () => {
      if (!stillCurrent()) { finalize(); return; }
      const dur = capturedEl.duration;
      const target = Number.isFinite(dur) && dur > 0
        ? Math.min(saved, Math.max(0, dur - 0.05))
        : saved;
      seekedListener = () => { finalize(); };
      capturedEl.addEventListener('seeked', seekedListener);
      try { capturedEl.currentTime = target; } catch { finalize(); return; }
      // Post-seek timeout — some browsers don't fire seeked reliably.
      seekTimer = window.setTimeout(() => { finalize(); }, 800);
    };

    if (capturedEl.readyState >= 1) {
      applySeek();
    } else {
      metaListener = () => {
        if (!stillCurrent()) { finalize(); return; }
        applySeek();
      };
      capturedEl.addEventListener('loadedmetadata', metaListener);
      // Pre-metadata timeout — finalize as skip so video plays from 0
      // rather than staying paused forever.
      metaTimer = window.setTimeout(() => { finalize(); }, 1500);
    }

    return () => {
      // Effect cleanup (dep change or unmount) → invalidate this attempt
      // and clear pending flag. v3.1 Refinement 1 — never bump resumeTick
      // from cleanup; either the next effect run will fire naturally
      // (dep change) or the component is unmounting.
      activationTokenRef.current++;
      finalize({ bumpTick: false });
    };
  }, [managed, slotIsActive, stableSlotId, item.url, resumeState]);



  // Manager-driven play/pause — the SOLE owner of feed-card transitions
  // when a provider is present. Honors the same suppression rules as
  // useVideoAutoplay and respects manual pause + scrubbing.
  useEffect(() => {
    if (!managed) return;
    const el = videoRef.current;
    if (!el) return;
    // Phase 2 guard — don't start playback while a saved-time resume is
    // still pending. finalize() bumps resumeTick so this effect re-runs
    // once the seek is applied (or has timed out).
    if (resumePendingRef.current) return;
    const tabHidden = typeof document !== 'undefined' && document.hidden;
    const canAutoplay =
      slotIsActive && autoplayEnabled && !isScrubbing && !autoplaySuppressed && !tabHidden;
    if (canAutoplay) {
      // Idempotent: only call play() if currently paused. Respect the
      // user's persisted global mute preference — do NOT force mute on
      // the active video.
      if (el.paused) {
        try { el.muted = readGlobalVideoMuted(); } catch { /* ignore */ }
        const p = el.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err: any) => {
            const name = err?.name;
            if (name === 'AbortError' || name === 'NotAllowedError') return;
            // Other errors fall through silently — surfaced via onError handler.
          });
        }
      }
    } else {
      if (!el.paused) {
        try { el.pause(); } catch { /* ignore */ }
      }
      // Safety: non-active videos must never emit audio. DOM-only mute;
      // global preference untouched.
      if (!slotIsActive) {
        try { el.muted = true; } catch { /* ignore */ }
      }
    }
  }, [managed, slotIsActive, autoplayEnabled, isScrubbing, autoplaySuppressed, resumeTick]);

  // Phase 2 — capture currentTime on slot deactivation (v3.1 Patch 1).
  // Explicit active → inactive transition tracking. Replaces the older
  // cleanup-based pattern (which depended on dep-array identity stability
  // to fire only on real deactivation). Also bumps activationTokenRef so
  // any in-flight resume is invalidated at the same call site that owns
  // the transition. captureResumeFromIntent is invoked via a ref so this
  // effect stays correct even if the callback grows real deps later.
  useEffect(() => {
    const wasActive = prevSlotIsActiveRef.current;
    if (managed && wasActive && !slotIsActive) {
      captureResumeFromIntentRef.current();
      activationTokenRef.current++;
    }
    prevSlotIsActiveRef.current = slotIsActive;
  }, [managed, slotIsActive]);

  // Phase 2 — unmount-only capture (v3.1 Patch 1, Refinement 2).
  // If the component unmounts while the slot is still active, capture
  // intent. Uses the ref form so a stale closure of
  // captureResumeFromIntent can never be invoked from this `[]`-deps
  // cleanup.
  useEffect(() => {
    return () => {
      if (slotIsActiveRef.current) {
        captureResumeFromIntentRef.current();
      }
    };
  }, []);

  // Phase 2 — capture on tab hide. document.visibilitychange while this
  // slot is active counts as intent (user navigated away from the tab).
  useEffect(() => {
    if (!managed || !slotIsActive) return;
    if (typeof document === 'undefined') return;
    const onVis = () => {
      if (document.hidden) captureResumeFromIntent();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [managed, slotIsActive, captureResumeFromIntent]);

  // Phase 2 — capture on element `pause` while active. Pause from
  // user-tap, scrubber, or anything else lands here. Safeguard C blocks
  // spurious 0-time saves from HLS re-attach.
  useEffect(() => {
    if (!managed) return;
    const el = videoRef.current;
    if (!el) return;
    const onPause = () => {
      if (!slotIsActiveRef.current) return;
      captureResumeFromPause();
    };
    el.addEventListener('pause', onPause);
    return () => el.removeEventListener('pause', onPause);
  }, [managed, captureResumeFromPause]);

  // Phase 2 — clear on `ended` so a watched-through video doesn't keep
  // a near-end time around to apply on the next visit.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onEnded = () => {
      clearFeedVideoResume(stableSlotIdRef.current);
    };
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, []);



  // Single-active invariant guard: if a non-active managed video ever
  // starts playing (manual tap, browser quirk, late-resolving play()),
  // pause it immediately. The listener reads `slotIsActiveRef.current`
  // so it survives active-state flips without detach/reattach.
  useEffect(() => {
    if (!managed) return;
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => {
      if (!slotIsActiveRef.current) {
        try { el.pause(); } catch { /* ignore */ }
      }
    };
    el.addEventListener('play', onPlay);
    return () => el.removeEventListener('play', onPlay);
  }, [managed]);


  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  // Reverse handoff from lightbox — apply mute, seek, then optionally play.
  // Defer onResumeConsumed until apply() actually runs (after metadata is
  // ready). Without that, an early consume could drop the resume before
  // currentTime is even seekable.
  useEffect(() => {
    if (!resumeState) return;
    const v = videoRef.current;
    if (!v) return;

    let cleanedUp = false;
    let listenerAttached = false;

    const apply = () => {
      if (cleanedUp) return;
      // Sync global mute BEFORE play() so autoplay paths can't re-mute
      // from a stale global value between seek and play.
      if (resumeState.muted !== readGlobalVideoMuted()) {
        setGlobalVideoMuted(resumeState.muted);
      }
      try { v.muted = resumeState.muted; } catch { /* ignore */ }

      const dur = v.duration;
      const target = Number.isFinite(dur) && dur > 0
        ? Math.min(Math.max(0, resumeState.currentTime), Math.max(0, dur - 0.05))
        : resumeState.currentTime;
      try { v.currentTime = target; } catch { /* pre-metadata seeks can throw */ }

      // Phase 2 — lightbox handoff writes the applied time into the LRU
      // so a fresh save can't overwrite the lightbox-progressed time with
      // a stale older value later. Use the actual target (clamped), not
      // the raw resumeState.currentTime.
      saveFeedVideoResume(stableSlotIdRef.current, target, v.duration);

      if (resumeState.wasPlaying) {
        userPausedRef.current = false;
        setAutoplayEnabled(true);
        const p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => { /* autoplay may block; native UI remains */ });
        }
      }
      onResumeConsumed?.();
    };

    if (v.readyState >= 1) {
      apply();
    } else {
      listenerAttached = true;
      const onMeta = () => {
        v.removeEventListener('loadedmetadata', onMeta);
        apply();
      };
      v.addEventListener('loadedmetadata', onMeta);
      return () => {
        cleanedUp = true;
        if (listenerAttached) v.removeEventListener('loadedmetadata', onMeta);
      };
    }
  }, [resumeState, onResumeConsumed]);

  // Phase 4 — source attachment. Mux-playable items go through attachHls
  // (native HLS on Safari/iOS, lazy hls.js elsewhere). Legacy items get
  // a plain src= assignment. Cancellation token guards against stale
  // attach after unmount or item swap.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Composer local-preview override: treat as a plain legacy source.
    const resolved = srcOverride
      ? { src: srcOverride, isHls: false }
      : resolveVideoSrc(item);
    const { src, isHls } = resolved;
    if (!src) return;
    isHlsSourceRef.current = isHls;
    hlsUnrecoverableRef.current = false;
    const token: AttachToken = { cancelled: false };
    let detach: () => void;
    if (isHls) {
      detach = attachHls(v, src, token, {
        onEvent: (e, p) => analytics.track(e, p),
        onUnrecoverable: () => {
          hlsUnrecoverableRef.current = true;
          setStatus('error');
        },
      });

    } else {
      try { v.src = src; } catch { /* ignore */ }
      detach = () => {
        try { v.removeAttribute('src'); v.load(); } catch { /* ignore */ }
      };
    }
    return () => {
      token.cancelled = true;
      detach();
    };
  }, [item.url, item.mux_playback_id, item.mux_status, item.provider, srcOverride]);


  // Reset userPaused when video leaves viewport, so re-entry can autoplay again.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting && userPausedRef.current) {
            userPausedRef.current = false;
            setAutoplayEnabled(true);
          }
        }
      },
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Cleanup auto-hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setForceShow(false);
      hideTimerRef.current = null;
    }, 2000);
  }, [clearHideTimer]);

  const handlePlay = () => {
    setIsPlaying(true);
    if (!isHovered && !isFocused && !isScrubbing) scheduleHide();
    if (playedRef.current) return;
    playedRef.current = true;
    const wasAutoplay = videoRef.current?.muted ?? true;
    autoplayRef.current = wasAutoplay;
    analytics.trackVideoPlayed({ autoplay: wasAutoplay, src: item.url });
  };

  const handlePause = () => {
    setIsPlaying(false);
    clearHideTimer();
  };

  const handleLoadedData = () => {
    setStatus('ready');
    const v = videoRef.current;
    if (v) {
      if (v.videoHeight > v.videoWidth) setIsPortrait(true);
      if (!Number.isNaN(v.duration) && Number.isFinite(v.duration)) {
        setDuration(v.duration);
      }
    }
  };

  const handleDurationChange = () => {
    const v = videoRef.current;
    if (v && !Number.isNaN(v.duration) && Number.isFinite(v.duration)) {
      setDuration(v.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (isScrubbing) return;
    const v = videoRef.current;
    if (v) setCurrentTime(v.currentTime);
  };

  const handleError = () => {
    // For HLS-attached (Mux) sources, a native MediaError almost always
    // reflects a load/manifest failure (e.g. invalid playback id) rather
    // than a real codec issue. Never classify HLS sources as
    // 'unsupported' — and if attachHls already surfaced an unrecoverable
    // failure, keep the 'error' state we already set.
    if (isHlsSourceRef.current || hlsUnrecoverableRef.current) {
      setStatus('error');
      return;
    }
    const code = videoRef.current?.error?.code;
    setStatus(code === 4 ? 'unsupported' : 'error');
  };

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setStatus('loading');
    videoRef.current?.load();
  }, []);

  const togglePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userPausedRef.current = false;
      setAutoplayEnabled(true);
      v.play().catch(() => {});
    } else {
      userPausedRef.current = true;
      setAutoplayEnabled(false);
      v.pause();
    }
  }, []);

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTap) {
      const v = videoRef.current;
      let handoff: VideoHandoff | undefined;
      let extras: LightboxEntryExtras | undefined;
      if (v) {
        // Snapshot BEFORE pausing, otherwise wasPlaying would always be false.
        // Use global mute intent rather than v.muted — browsers force-mute
        // autoplaying videos even when the user has globally unmuted.
        handoff = {
          currentTime: v.currentTime,
          wasPlaying: !v.paused,
          muted: readGlobalVideoMuted(),
        };
        // Capture exact-frame bridge poster BEFORE pause so we get the live
        // frame, not a stale paused one. Best-effort: null on any failure
        // (CORS taint, pre-first-frame, etc.) → lightbox falls back to the
        // existing time-based / static Mux poster.
        const dataUrl = captureVideoFrame(v);
        if (dataUrl) extras = { entryPosterDataUrl: dataUrl };
        // Tier 2: kick off HLS prewarm in parallel with the open animation.
        // Pass v.currentTime so we target the segment the lightbox needs.
        if (isMuxPlayable(item) && item.mux_playback_id) {
          prewarmMuxHls(item.mux_playback_id, v.currentTime);
        }
        // Phase 2 — lightbox-open is an intentional handoff. Capture as
        // intent so the time persists in LRU even if the lightbox close
        // path doesn't write back (e.g. user navigates away).
        captureResumeFromIntent();
        try {
          v.pause();
        } catch {
          /* ignore */
        }
      }
      onTap(handoff, extras);
      return;
    }
    toggleMute();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      togglePlayPause();
    }
  };

  const handlePointerEnter = () => {
    setIsHovered(true);
    clearHideTimer();
    setForceShow(true);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    if (isPlaying && !isFocused && !isScrubbing) scheduleHide();
  };

  const handleFocus = () => {
    setIsFocused(true);
    clearHideTimer();
    setForceShow(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (isPlaying && !isHovered && !isScrubbing) scheduleHide();
  };

  const handleScrubStart = useCallback(() => {
    setIsScrubbing(true);
    clearHideTimer();
    setForceShow(true);
  }, [clearHideTimer]);

  const handleScrubEnd = useCallback(() => {
    setIsScrubbing(false);
    if (!isHovered && !isFocused) scheduleHide();
  }, [isHovered, isFocused, scheduleHide]);

  const handleScrubSeek = useCallback((t: number) => {
    setCurrentTime(t);
  }, []);

  const showPosterFallback =
    !item.thumbnail_url && status !== 'ready' && status !== 'error' && status !== 'unsupported';

  // Suppress unused-var lint for showBadge (kept in API for callers).
  void showBadge;

  // Compute crossOrigin in render body (NOT an effect) so the attribute is
  // present on first mount and never toggled. Toggling crossOrigin forces a
  // reload and breaks playback. Unknown hosts get NO attribute at all so
  // playback is unchanged for legacy CDNs.
  const resolvedForCors = srcOverride ?? resolveVideoSrc(item).src;
  const corsSafe = isCorsSafeVideoHost(resolvedForCors);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full group', className)}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      role="group"
      aria-label="Video"
      tabIndex={0}
    >
      <video
        ref={videoRef}
        {...(corsSafe ? { crossOrigin: 'anonymous' as const } : {})}
        poster={srcOverride ? (item.thumbnail_url || undefined) : muxPosterUrl(item)}
        muted={muted}
        playsInline
        loop
        preload="metadata"
        onPlay={handlePlay}
        onPause={handlePause}
        onLoadedData={handleLoadedData}
        onDurationChange={handleDurationChange}
        onTimeUpdate={handleTimeUpdate}
        onError={handleError}
        className={cn(
          'w-full h-full rounded-md',
          objectFit === 'contain' ? 'object-contain' : 'object-cover'
        )}
      />

      {/* Poster fallback when no thumbnail and not yet ready */}
      {showPosterFallback && (
        <div className="absolute inset-0 rounded-md bg-muted flex items-center justify-center pointer-events-none">
          <Film className="h-8 w-8 text-muted-foreground" aria-hidden />
        </div>
      )}

      {/* Loading skeleton overlay */}
      {status === 'loading' && <Skeleton className="absolute inset-0 rounded-md" />}

      {/* Error / unsupported overlay */}
      {(status === 'error' || status === 'unsupported') && (
        <div className="absolute inset-0 rounded-md bg-muted/95 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
          <p className="text-sm text-foreground">
            {status === 'unsupported'
              ? "This video format isn't supported on your device."
              : 'Video failed to load.'}
          </p>
          {status === 'error' && (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1 rounded-md bg-background border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
            >
              <RotateCw className="h-3 w-3" aria-hidden />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Center play/pause button — does NOT hijack outer tap */}
      {status === 'ready' && (
        <button
          type="button"
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
          aria-pressed={isPlaying}
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          className={cn(
            'absolute inset-0 m-auto h-11 w-11 rounded-full bg-black/55 hover:bg-black/70 text-white',
            'flex items-center justify-center',
            'motion-safe:transition-opacity motion-safe:duration-200',
            isPlaying
              ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
              : 'opacity-100'
          )}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
      )}

      {/* Bottom progress + controls bar */}
      {status === 'ready' && (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 pointer-events-none',
            'motion-safe:transition-opacity motion-safe:duration-200'
          )}
        >
          {/* Backdrop gradient — only when active */}
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent rounded-b-md',
              'motion-safe:transition-opacity motion-safe:duration-200',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
            aria-hidden
          />

          {/* Active controls row */}
          <div
            className={cn(
              'relative flex items-center gap-2 px-2 pb-1 pointer-events-auto',
              'motion-safe:transition-opacity motion-safe:duration-200',
              isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <button
              type="button"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="h-8 w-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 motion-safe:transition"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>

            <span className="text-xs font-medium text-white tabular-nums">
              {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration || 0))}
            </span>

            <div className="flex-1" />

            <button
              type="button"
              aria-label={muted ? 'Unmute video' : 'Mute video'}
              aria-pressed={!muted}
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="h-8 w-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 motion-safe:transition"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Scrubber — always present, with large hit area */}
          <div className="relative px-2 pb-1 pointer-events-auto">
            <VideoProgressBar
              currentTime={currentTime}
              duration={duration}
              isActive={isActive}
              videoRef={videoRef}
              onScrubStart={handleScrubStart}
              onScrubEnd={handleScrubEnd}
              onSeek={handleScrubSeek}
            />
          </div>
        </div>
      )}
    </div>
  );
}
