/**
 * 🚫 HANDOFF INVARIANTS — DO NOT VIOLATE
 *  1. <video>.currentTime is set from initialVideoState.currentTime BEFORE play().
 *  2. <video>.muted is initialized from initialVideoState.muted (global mute intent).
 *  3. If initialVideoState.wasPlaying, play() is invoked once on loadedmetadata.
 *  4. First user tap on iOS triggers play()+unmute synchronously inside the
 *     ref-callback handler (earlyPlayRanRef path).
 *  5. Mux source attachment via attachHls() runs AFTER the iOS ref-callback
 *     wiring, never before it.
 * Regression of any of the above breaks iOS lightbox handoff.
 * Backed by LightboxPreview.handoff.test.tsx.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVideoViewTracker, isReviewViewSource, type ViewSource } from '@/hooks/useVideoViewTracker';
import { createPortal } from 'react-dom';
import { MediaItem, VideoHandoff, VideoExitHandoff } from '@/types/media';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { isMuxPreparing, isMuxErroredOrBroken, isMuxPlayable, resolveVideoSrc, muxPosterUrl, muxThumbnailUrl, maybeEmitBrokenReady } from '@/utils/muxMedia';
import { attachHls, type AttachToken } from '@/utils/hlsAttach';
import { analytics } from '@/services/analytics';
import { MuxPreparingPoster } from '@/components/media/MuxPreparingPoster';
import type { LightboxEntryExtras } from '@/components/media/lightboxTypes';
import { mediaKey, findByMediaKey } from '@/utils/mediaIdentity';
import { decideHandoffSeek, handoffTarget } from '@/utils/lightboxHandoffSeek';

// Lightbox uses the same canonical adaptive Mux URL as feed + prewarm
// (no forced rendition order / 720p floor); ABR ramps naturally.


interface LightboxPreviewProps {
  media: MediaItem[];
  initialIndex?: number;
  /**
   * Phase 4 Step 3 — stable media ID of the entry item. When supplied (and
   * it resolves to an item), the keyed path activates: the displayed item is
   * tracked by its ID for the whole session, navigation updates the active
   * key, and if the active item disappears from `media` the lightbox closes
   * instead of showing whatever shifted into its position. When absent,
   * the legacy numeric/index path runs completely unchanged.
   */
  initialMediaKey?: string;
  /**
   * Optional playback handoff from a feed video — apply once on the entry
   * item so the lightbox opens at the same timestamp / play state.
   */
  initialVideoState?: VideoHandoff;
  /**
   * Optional reverse handoff fired exactly once when the lightbox closes,
   * so the originating feed video can resume from the lightbox's playback
   * state. Mute is always emitted; timestamp/play resume is only honored
   * by the parent when entryIndex === currentIndex.
   */
  onExitHandoff?: (handoff: VideoExitHandoff) => void;
  /**
   * Transient view-only extras carried from the feed (e.g. exact-frame
   * snapshot dataURL). Used as a bridge cover on the entry item until
   * the real <video> is ready. Dropped on close.
   */
  entryExtras?: LightboxEntryExtras;
  onClose: () => void;
  className?: string;
  /** Phase 5 — review view tracking (review media block only). */
  viewSource?: ViewSource;
  viewSourceId?: string;
}

export function LightboxPreview({
  media,
  initialIndex = 0,
  initialMediaKey,
  initialVideoState,
  onExitHandoff,
  entryExtras,
  onClose,
  className,
  viewSource,
  viewSourceId,
}: LightboxPreviewProps) {
  const [currentIndexState, setCurrentIndexState] = useState(initialIndex);
  // Phase 4 Step 3 — keyed path state. Active only when a valid entry media
  // key was supplied. `activeKey` is the ID of the item currently displayed;
  // it changes on navigation. `entryKey` is the ID of the item that initiated
  // the lightbox/handoff and never changes.
  const keyedModeRef = useRef(!!initialMediaKey);
  const entryKeyRef2 = useRef<string | undefined>(initialMediaKey);
  const [activeKey, setActiveKey] = useState<string | null>(initialMediaKey ?? null);
  const activeKeyRef = useRef<string | null>(initialMediaKey ?? null);
  activeKeyRef.current = activeKey;
  // In keyed mode with a known active key, the displayed index is DERIVED
  // from the key on every render — a neighbour removal shifts positions but
  // never changes which item is shown. Null active key (navigated onto an
  // ID-less item) or legacy mode uses the numeric state.
  const keyedIndex = keyedModeRef.current && activeKey != null
    ? findByMediaKey(media, activeKey)
    : -1;
  const currentIndex = keyedIndex >= 0 ? keyedIndex : currentIndexState;
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  // Tracks when the <video> for the current item is ready to be revealed
  // (HLS attached + loadeddata fired + handoff seek applied). Used to keep a
  // high-res Mux poster on top so we never show a small/blurry interim frame.
  const [videoReady, setVideoReady] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);


  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRef = useRef<MediaItem[]>([]);
  const isMobile = useIsMobile();

  // Apply the feed handoff at most once, on the entry video only.
  const handoffAppliedRef = useRef(false);
  // Tracks whether the iOS synchronous ref-callback play() ran for this open.
  // When true, onLoadedMetadata leaves `muted` alone and onSeeked handles the
  // one-shot unmute attempt instead of re-attempting play().
  const earlyPlayRanRef = useRef(false);
  // Reveal safety net: if the handoff seek never lands, show the video and
  // native controls WITHOUT auto-playing. Auto-play stays gated on a verified
  // seek and is skipped entirely once the user has acted on the video.
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set only by explicit playback overrides (native pause / user scrub),
  // never by incidental taps on the covering poster.
  const userActedRef = useRef(false);
  const userSeekedRef = useRef(false);
  const handoffSeekIssuedRef = useRef(false);
  const programmaticRef = useRef(false);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  // Phase 5 — review/timeline-update view tracking in the viewer. Only active
  // when the caller supplies viewSource + viewSourceId (review media block);
  // Posts and all other callers pass nothing and are unaffected.
  const [trackedVideoEl, setTrackedVideoEl] = useState<HTMLVideoElement | null>(null);
  const trackedVideoRef = useMemo(() => ({ current: trackedVideoEl }), [trackedVideoEl]);
  const viewAutoplayRef = useRef<boolean>(false);
  const trackedItem = media[currentIndex];
  useVideoViewTracker({
    videoRef: trackedVideoRef,
    source: viewSource ?? 'review',
    sourceId: viewSourceId,
    mediaPath: trackedItem?.type === 'video' ? (resolveVideoSrc(trackedItem).src ?? '') : '',
    mediaId: trackedItem?.viewMediaId,
    autoplayRef: viewAutoplayRef,
    enabled: !!viewSource && !!viewSourceId && isReviewViewSource(viewSource) && trackedItem?.type === 'video',
  });
  // Phase 4 — attachHls detach handle for the current <video>. Cleared on
  // ref-callback unmount (key change remounts the video).
  const hlsDetachRef = useRef<(() => void) | null>(null);
  const hlsTokenRef = useRef<AttachToken | null>(null);
  // Capture entry index so navigation away from it disables the handoff.
  const entryIndexRef = useRef(initialIndex);
  // Live-value refs read by the stable video ref-callback below. Updated each
  // render so the callback can stay identity-stable (empty deps) without
  // closing over stale values. This is what prevents the per-render
  // detach/re-attach loop that was killing playback + handoff.
  const currentItemRef = useRef<MediaItem | null>(null);
  const currentIndexRef = useRef<number>(initialIndex);
  const initialVideoStateRef = useRef<VideoHandoff | undefined>(initialVideoState);
  // Keyed (Post) path only — per-lightbox-session playback memory, keyed by
  // stable media key. Seeded from the feed handoff so the entry visit and
  // later returns share one state model. Cleared when the lightbox unmounts.
  const sessionStateRef = useRef<Map<string, VideoHandoff>>(
    new Map(initialMediaKey && initialVideoState ? [[initialMediaKey, initialVideoState]] : [])
  );
  useEffect(() => () => { sessionStateRef.current.clear(); }, []);
  // Guards closeWithHandoff so emission/close only happens once even when
  // multiple close paths fire in rapid succession (e.g. ESC during swipe).
  const closedRef = useRef(false);
  // Keep latest onExitHandoff/onClose accessible from the stable callback.
  const onExitHandoffRef = useRef(onExitHandoff);
  const onCloseRef = useRef(onClose);
  onExitHandoffRef.current = onExitHandoff;
  onCloseRef.current = onClose;

  const closeWithHandoff = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    const v = videoElRef.current;
    if (v) {
      try {
        // Keyed path: if this visit's resume hasn't landed yet, hand back
        // the remembered state rather than the not-yet-seeked playhead.
        const pendingKey = keyedModeRef.current ? activeKeyRef.current : null;
        const pendingState = pendingKey != null && !handoffAppliedRef.current
          ? sessionStateRef.current.get(pendingKey)
          : undefined;
        const snapshot: VideoExitHandoff = {
          currentTime: pendingState ? pendingState.currentTime : v.currentTime,
          wasPlaying: pendingState ? pendingState.wasPlaying : (!v.paused && !v.ended),
          muted: v.muted,
          entryIndex: entryIndexRef.current,
          currentIndex: currentIndexRef.current,
          // Phase 4 Step 3 — stable identity for resume matching. Only
          // emitted on the keyed path; legacy callers get neither field.
          entryMediaKey: keyedModeRef.current ? entryKeyRef2.current : undefined,
          currentMediaKey: keyedModeRef.current ? (activeKeyRef.current ?? undefined) : undefined,
        };
        onExitHandoffRef.current?.(snapshot);
      } catch {
        /* never throw from close path */
      }
    }
    onCloseRef.current();
  }, []);

  // iOS UA check — Safari/Chrome/etc on iPhone/iPad (including iPadOS desktop UA).
  const isIOS = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/iP(hone|ad|od)/.test(ua)) return true;
    // iPadOS 13+ reports MacIntel with touch.
    return navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
  };
  
  // Prevent body scrolling when lightbox is open (preserve scroll position)
  useEffect(() => {
    // Check if we're already in a modal context (Radix UI Dialog handles body scroll)
    const isInModal = document.querySelector('[data-radix-portal]') !== null;
    if (isInModal) return;

    const savedY = window.scrollY || window.pageYOffset || 0;
    const prevTop = document.body.style.top;
    const prevLeft = document.body.style.left;
    const prevRight = document.body.style.right;

    document.body.style.top = `-${savedY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.classList.add('lightbox-open');

    return () => {
      document.body.classList.remove('lightbox-open');
      document.body.style.top = prevTop;
      document.body.style.left = prevLeft;
      document.body.style.right = prevRight;
      window.scrollTo(0, savedY);
    };
  }, []);
  
  // Track if the media array has changed
  useEffect(() => {
    const mediaChanged = 
      mediaRef.current.length !== media.length || 
      mediaRef.current.some((item, idx) => item.url !== media[idx]?.url);
    
    // Only reset loaded state if media array changed
    if (mediaChanged) {
      setLoaded({});
      mediaRef.current = [...media];
    }
  }, [media]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'Escape') {
        closeWithHandoff();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-fade nav chrome (not the close button) after inactivity
  useEffect(() => {
    const reset = () => {
      setChromeVisible(true);
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
      chromeTimerRef.current = setTimeout(() => setChromeVisible(false), 3000);
    };
    reset();
    window.addEventListener('pointermove', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('touchstart', reset);
    return () => {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
      window.removeEventListener('pointermove', reset);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('touchstart', reset);
    };
  }, []);

  // Reset videoReady whenever the displayed item changes so the high-res
  // poster overlay covers the next <video> until it's truly ready.
  useEffect(() => {
    setVideoReady(false);
    handoffSeekIssuedRef.current = false;
    userSeekedRef.current = false;
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      if (!closedRef.current) setVideoReady(true);
    }, 2500);
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    };
  }, [currentIndex]);





  // Preload adjacent images
  const preloadAdjacentImages = () => {
    if (!media || media.length <= 1) return;
    
    // Preload next image
    const nextIdx = (currentIndex + 1) % media.length;
    const nextItem = media[nextIdx];
    if (nextItem?.type === 'image' && !loaded[getImageKey(nextItem, nextIdx)]) {
      const nextImg = new Image();
      nextImg.src = nextItem.url;
      nextImg.onload = () => handleImagePreload(nextItem, nextIdx);
    }
    
    // Preload previous image
    const prevIdx = (currentIndex - 1 + media.length) % media.length;
    const prevItem = media[prevIdx];
    if (prevItem?.type === 'image' && !loaded[getImageKey(prevItem, prevIdx)]) {
      const prevImg = new Image();
      prevImg.src = prevItem.url;
      prevImg.onload = () => handleImagePreload(prevItem, prevIdx);
    }
  };
  
  // Get a stable key for the image
  const getImageKey = (item: MediaItem, index: number): string => {
    return item.id || `${item.url}-${index}`;
  };
  
  const handleImageLoad = (item: MediaItem, index: number) => {
    const key = getImageKey(item, index);
    if (!loaded[key]) {
      setLoaded(prev => ({...prev, [key]: true}));
    }
    
    // Start preloading adjacent images once current image is loaded
    preloadAdjacentImages();
  };
  
  const handleImagePreload = (item: MediaItem, index: number) => {
    const key = getImageKey(item, index);
    setLoaded(prev => ({...prev, [key]: true}));
  };
  
  // Phase 4 Step 3 — navigation updates the ACTIVE media key to the newly
  // displayed item's ID (null for ID-less items), then derives its index.
  // Model: stable key → derive index → navigate → replace active key.
  const goToIndex = (idx: number) => {
    if (keyedModeRef.current) {
      // Snapshot the departing video BEFORE it unmounts. If its own pending
      // resume hasn't landed yet, keep the remembered target instead.
      const leavingKey = activeKeyRef.current;
      const v = videoElRef.current;
      if (leavingKey != null && v && handoffAppliedRef.current) {
        try {
          sessionStateRef.current.set(leavingKey, {
            currentTime: v.currentTime,
            wasPlaying: !v.paused && !v.ended,
            muted: v.muted,
          });
        } catch { /* ignore */ }
      } else if (leavingKey != null && v && !sessionStateRef.current.has(leavingKey)) {
        try {
          sessionStateRef.current.set(leavingKey, {
            currentTime: v.currentTime,
            wasPlaying: !v.paused && !v.ended,
            muted: v.muted,
          });
        } catch { /* ignore */ }
      }
      // New visit: per-visit handoff bookkeeping starts fresh. Done here
      // (synchronously) so the next <video> ref-callback sees clean state.
      handoffAppliedRef.current = false;
      handoffSeekIssuedRef.current = false;
      userActedRef.current = false;
      userSeekedRef.current = false;
      earlyPlayRanRef.current = false;
      setActiveKey(mediaKey(media[idx]));
    }
    setCurrentIndexState(idx);
  };

  const nextImage = () => {
    goToIndex((currentIndex + 1) % media.length);
  };

  const prevImage = () => {
    goToIndex((currentIndex - 1 + media.length) % media.length);
  };

  // Phase 4 Step 3 — if the actively displayed item disappears from the
  // media list while the lightbox is open (e.g. a concurrent edit removed
  // it), close immediately. Never fall back to whatever shifted into its
  // old position, and never resume a different video.
  useEffect(() => {
    if (!keyedModeRef.current || activeKey == null || closedRef.current) return;
    if (findByMediaKey(media, activeKey) === -1) {
      closeWithHandoff();
    }
  }, [media, activeKey, closeWithHandoff]);

  // Keep live-value refs in sync each render so the stable video ref-callback
  // below can read the latest values without being re-created.
  currentIndexRef.current = currentIndex;
  initialVideoStateRef.current = initialVideoState;
  currentItemRef.current = media && media.length > 0 ? media[currentIndex] : null;

  // Phase 4 Step 3 — "is the entry item the one displayed right now?"
  // Keyed path compares stable media IDs; legacy path compares positions.
  const isEntryDisplayed = () =>
    keyedModeRef.current
      ? activeKeyRef.current != null && activeKeyRef.current === entryKeyRef2.current
      : currentIndexRef.current === entryIndexRef.current;

  // The pending resume state for the displayed item. Keyed path: the
  // session memory for the active stable key (no positional fallback).
  // Legacy path: unchanged — the feed handoff on the entry item only.
  const getPendingHandoff = (): VideoHandoff | undefined => {
    if (keyedModeRef.current) {
      const k = activeKeyRef.current;
      return k != null ? sessionStateRef.current.get(k) : undefined;
    }
    return isEntryDisplayed() ? initialVideoStateRef.current : undefined;
  };

  // Stable video ref-callback. Identity never changes, so React only invokes
  // it on real mount/unmount (and on key={imageKey} change). Without this,
  // every re-render tore down + re-attached the source, causing the spinner
  // loop and breaking handoff.
  const videoRefCallback = useCallback((el: HTMLVideoElement | null) => {
    // Unmount path — only run teardown if we actually had an attachment.
    if (!el) {
      if (!videoElRef.current) return;
      if (hlsTokenRef.current) hlsTokenRef.current.cancelled = true;
      if (hlsDetachRef.current) {
        try { hlsDetachRef.current(); } catch { /* ignore */ }
      }
      hlsDetachRef.current = null;
      hlsTokenRef.current = null;
      videoElRef.current = null;
      setTrackedVideoEl(null);
      return;
    }

    // No-op if React ever re-invokes us with the same element we already wired.
    if (el === videoElRef.current) return;

    videoElRef.current = el;
    setTrackedVideoEl(el);

    const item = currentItemRef.current;
    if (!item) return;
    const handoff = initialVideoStateRef.current;
    const isFirstEntryVisit = keyedModeRef.current
      ? getPendingHandoff() === handoff
      : isEntryDisplayed();

    // Phase 4 — attach source synchronously inside the ref callback, BEFORE
    // the iOS early-play call below. Native HLS (Safari/iOS) is sync (sets
    // el.src), preserving the first-tap gesture chain.
    // Lightbox displays Mux video at large size — bias native HLS ABR to start
    // at the highest available rendition to avoid the cold-start blur.
    // Lower renditions remain available as fallback if network can't sustain.
    const { src, isHls } = resolveVideoSrc(item);
    if (src && !hlsDetachRef.current) {
      if (isHls) {
        const token: AttachToken = { cancelled: false };
        hlsTokenRef.current = token;
        hlsDetachRef.current = attachHls(el, src, token, {
          onEvent: (e, p) => analytics.track(e, p),
          onUnrecoverable: () => {
            // Stop here instead of falling back to raw .m3u8 on non-native-HLS
            // browsers (would surface as a misleading "format unsupported").
          },
        });
      } else {
        try { el.src = src; } catch { /* ignore */ }
        hlsDetachRef.current = () => {
          try { el.removeAttribute('src'); el.load(); } catch { /* ignore */ }
        };
      }
    }

    // iOS-only synchronous early play, inside the originating tap gesture.
    if (
      !isIOS() ||
      earlyPlayRanRef.current ||
      handoffAppliedRef.current ||
      !handoff ||
      !handoff.wasPlaying ||
      !isFirstEntryVisit
    ) {
      return;
    }
    earlyPlayRanRef.current = true;
    try { el.muted = true; } catch { /* ignore */ }
    try {
      if (handoff.currentTime > 0) {
        el.currentTime = handoff.currentTime;
      }
    } catch { /* ignore — pre-metadata seeks may throw */ }
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { /* iOS blocked; fall back to existing flow */ });
    }
  }, []);

  if (!media || media.length === 0) {
    return null;
  }

  
  const currentItem = media[currentIndex];
  const imageKey = getImageKey(currentItem, currentIndex);
  const isLoaded = loaded[imageKey];
  
  // Determine orientation class for responsive styling
  const getOrientationClass = (item: MediaItem) => {
    if (!item.orientation && item.width && item.height) {
      const ratio = item.width / item.height;
      if (ratio > 1.05) return 'landscape';
      if (ratio < 0.95) return 'portrait';
      return 'square';
    }
    return item.orientation || 'landscape';
  };
  
  const orientation = getOrientationClass(currentItem);
  const isLandscape = orientation === 'landscape';

  const lightboxContent = (
    <div 
      className={cn(
        "lightbox-preview fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm pointer-events-auto",
        "flex items-center justify-center",
        className
      )}
      style={{ position: 'fixed' }}
      data-lightbox="true"
    >
      {/* Background overlay - no click handler, handled by content container */}
      <div 
        className="absolute inset-0 bg-black/95"
        aria-label="Lightbox background"
      />
      
      {/* Content container - handles background clicks only */}
      <div 
        className="relative z-10 flex h-full w-full items-center justify-center lightbox-content"
        onClick={(e) => {
          // Only close if clicking directly on this container (the background area)
          if (e.target === e.currentTarget) {
            closeWithHandoff();
          }
        }}
      >
        {/* Close button - always visible, respects safe-area */}
        <Button
          className="absolute right-3 z-50 h-10 w-10 rounded-full bg-background/20 hover:bg-background/40 backdrop-blur"
          style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}
          size="icon"
          variant="ghost"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            closeWithHandoff();
          }}
        >
          <X className="h-5 w-5 text-white" />
          <span className="sr-only">Close</span>
        </Button>

        {/* Main image container - reduced padding on mobile */}
        <div className={cn(
          "relative flex h-full w-full items-center justify-center",
          isMobile ? "px-2" : "px-12"
        )}>
        {/* Current media item */}
        <div className="relative flex h-full max-h-[90vh] w-full items-center justify-center">
          {currentItem.type === 'image' ? (
            <>
              <img 
                key={imageKey}
                src={currentItem.url} 
                alt={currentItem.alt || currentItem.caption || `Image ${currentIndex + 1}`}
                className={cn(
                  "transition-opacity duration-300",
                  isLoaded ? "opacity-100" : "opacity-0",
                  // Orientation-specific styles
                  isMobile && isLandscape 
                    ? "h-auto w-full object-contain"
                    : "max-h-[90vh] max-w-full object-contain"
                )}
                style={isMobile && isLandscape ? { maxHeight: '85vh' } : undefined}
                onLoad={() => handleImageLoad(currentItem, currentIndex)}
              />
              {/* Only show loading spinner if the image hasn't loaded yet */}
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-white" />
                </div>
              )}
            </>
          ) : isMuxErroredOrBroken(currentItem) ? (
            (() => {
              maybeEmitBrokenReady(currentItem, (e, p) => analytics.track(e, p));
              return (
                <MuxPreparingPoster
                  item={currentItem}
                  className="max-h-[90vh] max-w-full"
                  objectFit="contain"
                />
              );
            })()
          ) : isMuxPreparing(currentItem) ? (
            <MuxPreparingPoster
              item={currentItem}
              className="max-h-[90vh] max-w-full"
              objectFit="contain"
            />
          ) : (() => {
            const isMux = isMuxPlayable(currentItem) && !!currentItem.mux_playback_id;
            // Defensive numeric ratio — guard against missing / 0 / NaN / Infinity
            // metadata so the wrapper always has a sane intrinsic shape.
            const rawRatio =
              currentItem.width && currentItem.height
                ? currentItem.width / currentItem.height
                : 16 / 9;
            const ratio =
              Number.isFinite(rawRatio) && rawRatio > 0 ? rawRatio : 16 / 9;
            const maxVh = isMobile && isLandscape ? 85 : 90;
            // Prefer the exact-frame bridge poster captured at tap time on
            // the entry item. Falls back to a time-based Mux thumbnail
            // (matching the handoff timestamp) and finally to the static
            // Mux poster. Non-Mux items keep their existing poster.
            const pending = getPendingHandoff();
            const isEntryItem = keyedModeRef.current
              ? !!pending && pending === initialVideoState
              : isEntryDisplayed();
            const entryPoster = isEntryItem ? entryExtras?.entryPosterDataUrl : undefined;
            const posterTime =
              pending && pending.currentTime > 0
                ? pending.currentTime
                : undefined;
            const muxFallbackPoster = isMux
              ? muxThumbnailUrl(currentItem.mux_playback_id!, { width: 1280, time: posterTime })
              : muxPosterUrl(currentItem);
            const hiResPoster = entryPoster ?? muxFallbackPoster;
            // Defensive non-zero sizing: give the browser a real intrinsic
            // width (min of parent and ratio-derived width from the vh cap)
            // PLUS max constraints PLUS a 1px floor so the flex parent can
            // never collapse this wrapper to 0x0 (which would render a black
            // screen since the video + poster are absolutely positioned).
            const wrapperStyle: React.CSSProperties = {
              position: 'relative',
              display: 'block',
              aspectRatio: String(ratio),
              width: `min(100%, calc(${maxVh}vh * ${ratio}))`,
              maxWidth: '100%',
              maxHeight: `${maxVh}vh`,
              minWidth: '1px',
              minHeight: '1px',
            };
            // For Mux, keep the high-res poster on top until the video has
            // attached + loaded + handoff seek completed so we never show a
            // small/blurry interim frame. Supabase videos reveal immediately
            // (no HLS attach delay) and behave exactly as before.
            const hidden = isMux && !videoReady;
            // Applies the feed handoff once the playhead is verified at the
            // target (real `seeked`, or a no-op seek). Plays only if the feed
            // was playing and the user hasn't acted since the lightbox opened.
            const completeHandoff = (v: HTMLVideoElement) => {
              if (closedRef.current) return;
              setVideoReady(true);
              const h = getPendingHandoff();
              if (handoffAppliedRef.current || !h) {
                return;
              }
              handoffAppliedRef.current = true;
              if (earlyPlayRanRef.current && h === initialVideoState) {
                if (!h.muted) {
                  try { v.muted = false; } catch { /* ignore */ }
                }
                return;
              }
              if (!h.wasPlaying) return;
              if (userActedRef.current || !v.paused) return;
              const tryPlay = v.play();
              if (tryPlay && typeof tryPlay.catch === 'function') {
                tryPlay.catch(() => {
                  try { v.muted = true; } catch { /* ignore */ }
                  const retry = v.play();
                  if (retry && typeof retry.catch === 'function') {
                    retry.catch(() => { /* still blocked; native controls visible */ });
                  }
                });
              }
            };

            // "Check repeatedly, seek once": called from every readiness
            // event. Completes immediately when the target is already
            // reached (incl. nonzero), seeks once when the target is
            // seekable, otherwise waits for the next event.
            const tryHandoffSeek = (v: HTMLVideoElement) => {
              const h = getPendingHandoff();
              if (
                closedRef.current ||
                handoffAppliedRef.current ||
                !h ||
                v.readyState < 1
              ) {
                return;
              }
              if (userSeekedRef.current) {
                completeHandoff(v);
                return;
              }
              const target = handoffTarget(h.currentTime, v.duration);
              const action = decideHandoffSeek({
                currentTime: v.currentTime,
                target,
                seekable: v.seekable,
                seekIssued: handoffSeekIssuedRef.current,
              });
              if (action === 'complete') {
                completeHandoff(v);
              } else if (action === 'seek') {
                handoffSeekIssuedRef.current = true;
                programmaticRef.current = true;
                try { v.currentTime = target; } catch { handoffSeekIssuedRef.current = false; }
                programmaticRef.current = false;
              }
            };


            return (
              <div style={wrapperStyle}>
                <video
                  key={imageKey}
                  ref={videoRefCallback}
                  poster={hiResPoster}
                  controls
                  playsInline
                  className={cn(
                    "absolute inset-0 h-full w-full object-contain cursor-auto [&::-webkit-media-controls]:cursor-pointer [&::-webkit-media-controls-panel]:cursor-pointer transition-opacity duration-200",
                    hidden ? "opacity-0" : "opacity-100"
                  )}
                  style={{ cursor: 'auto' }}
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    const h = getPendingHandoff();
                    if (
                      closedRef.current ||
                      handoffAppliedRef.current ||
                      !h
                    ) {
                      return;
                    }
                    // Only set muted here if the iOS early-play path did NOT run.
                    // If it did, we must keep muted=true until handoff completes.
                    if (!(earlyPlayRanRef.current && h === initialVideoState)) {
                      try { v.muted = h.muted; } catch { /* ignore */ }
                    }
                    tryHandoffSeek(v);
                  }}
                  onDurationChange={(e) => tryHandoffSeek(e.currentTarget)}
                  onProgress={(e) => tryHandoffSeek(e.currentTarget)}
                  onCanPlay={(e) => tryHandoffSeek(e.currentTarget)}
                  onLoadedData={(e) => {
                    if (closedRef.current) return;
                    handleImageLoad(currentItem, currentIndex);
                    // For non-handoff items, reveal immediately on first frame.
                    // Entry-handoff items wait for a verified target.
                    const isEntryHandoff = !!getPendingHandoff();
                    if (!isEntryHandoff) {
                      setVideoReady(true);
                    } else {
                      tryHandoffSeek(e.currentTarget);
                    }
                  }}
                  onPlaying={(e) => {
                    e.stopPropagation();
                  }}
                  onSeeked={(e) => {
                    e.stopPropagation();
                    if (closedRef.current) return;
                    const v = e.currentTarget;
                    if (handoffAppliedRef.current || !getPendingHandoff()) {
                      setVideoReady(true);
                      return;
                    }
                    // Our handoff seek landed (or the user scrubbed): verify.
                    if (handoffSeekIssuedRef.current) {
                      tryHandoffSeek(v);
                      // Landed off-target (e.g. keyframe snap) → still complete
                      // once rather than reseeking repeatedly.
                      if (!handoffAppliedRef.current) completeHandoff(v);
                    } else {
                      setVideoReady(true);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPlay={(e) => e.stopPropagation()}
                  onPause={(e) => {
                    e.stopPropagation();
                    // Explicit user pause while handoff is pending overrides
                    // the feed's wasPlaying intent. Programmatic pauses are
                    // ignored via programmaticRef.
                    if (!handoffAppliedRef.current && !programmaticRef.current) {
                      userActedRef.current = true;
                    }
                  }}
                  onVolumeChange={(e) => e.stopPropagation()}
                  onTimeUpdate={(e) => {
                    e.stopPropagation();
                  }}
                  onSeeking={(e) => {
                    e.stopPropagation();
                    // A seek we didn't issue during pending handoff = user scrub:
                    // honor their position, skip our seek, keep play intent.
                    if (!handoffAppliedRef.current && !programmaticRef.current && !handoffSeekIssuedRef.current) {
                      handoffSeekIssuedRef.current = true;
                      userSeekedRef.current = true;
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                {isMux && hiResPoster && (
                  <img
                    src={hiResPoster}
                    alt=""
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-200",
                      videoReady ? "opacity-0" : "opacity-100"
                    )}
                  />
                )}
              </div>
            );
          })()}

        </div>


        {/* Navigation controls - only shown when there are multiple items */}
        {media.length > 1 && (
          <div
            className={cn(
              "motion-safe:transition-opacity motion-safe:duration-200",
              chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            {/* Previous button */}
            <Button
              className={cn(
                "absolute top-1/2 -translate-y-1/2 rounded-full bg-gray-800/70 hover:bg-gray-700",
                isMobile ? "left-1 h-8 w-8" : "left-4 h-12 w-12"
              )}
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                prevImage();
              }}
            >
              <ChevronLeft className={cn("text-white", isMobile ? "h-5 w-5" : "h-8 w-8")} />
              <span className="sr-only">Previous image</span>
            </Button>

            {/* Next button */}
            <Button
              className={cn(
                "absolute top-1/2 -translate-y-1/2 rounded-full bg-gray-800/70 hover:bg-gray-700",
                isMobile ? "right-1 h-8 w-8" : "right-4 h-12 w-12"
              )}
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                nextImage();
              }}
            >
              <ChevronRight className={cn("text-white", isMobile ? "h-5 w-5" : "h-8 w-8")} />
              <span className="sr-only">Next image</span>
            </Button>

            {/* Image counter */}
            <div
              className="absolute left-0 right-0 flex justify-center"
              style={{ bottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
            >
              <div className={cn("flex items-center gap-2", isMobile && "scale-90")}>
                <div className={cn("flex gap-2", isMobile && "gap-1")}>
                  {media.map((item, idx) => (
                    <button
                      key={getImageKey(item, idx)}
                      className={cn(
                        "h-2 rounded-full transition-all focus:outline-none",
                        idx === currentIndex
                          ? isMobile ? "w-6 bg-brand-orange" : "w-8 bg-brand-orange"
                          : "w-2 bg-white opacity-70 hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        goToIndex(idx);
                      }}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>

                <span className={cn(
                  "ml-4 rounded-full bg-black/60 px-3 py-1 text-white",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {currentIndex + 1} / {media.length}
                </span>
              </div>
            </div>
           </div>

         )}
       </div>
      </div>

       {/* Invisible preloader for adjacent images */}
      <div className="sr-only hidden">
        {media.map((item, idx) => {
          // Only preload images not currently shown
          if (item.type === 'image' && idx !== currentIndex) {
            return (
              <img 
                key={`preload-${getImageKey(item, idx)}`}
                src={item.url}
                alt=""
                onLoad={() => handleImagePreload(item, idx)}
                aria-hidden="true"
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );

  // Use portal to render outside the normal component hierarchy
  const modalRoot = document.getElementById('modal-root');
  const portalTarget = modalRoot || document.body;
  
  console.log('LightboxPreview portal target:', portalTarget === document.body ? 'document.body' : '#modal-root');
  
  return createPortal(lightboxContent, portalTarget);
}
