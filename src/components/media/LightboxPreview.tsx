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
import React, { useState, useEffect, useRef, useCallback } from 'react';
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

interface LightboxPreviewProps {
  media: MediaItem[];
  initialIndex?: number;
  /**
   * Optional playback handoff from a feed video — apply once on the entry
   * item so the lightbox opens at the same timestamp / play state.
   */
  initialVideoState?: VideoHandoff;
  onClose: () => void;
  className?: string;
}

export function LightboxPreview({ 
  media,
  initialIndex = 0,
  initialVideoState,
  onClose,
  className 
}: LightboxPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
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
  const videoElRef = useRef<HTMLVideoElement | null>(null);
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
        onClose();
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
  
  const nextImage = () => {
    setCurrentIndex(prev => (prev + 1) % media.length);
  };
  
  const prevImage = () => {
    setCurrentIndex(prev => (prev - 1 + media.length) % media.length);
  };

  // Keep live-value refs in sync each render so the stable video ref-callback
  // below can read the latest values without being re-created.
  currentIndexRef.current = currentIndex;
  initialVideoStateRef.current = initialVideoState;
  currentItemRef.current = media && media.length > 0 ? media[currentIndex] : null;

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
      return;
    }

    // No-op if React ever re-invokes us with the same element we already wired.
    if (el === videoElRef.current) return;

    videoElRef.current = el;

    const item = currentItemRef.current;
    if (!item) return;
    const handoff = initialVideoStateRef.current;
    const idx = currentIndexRef.current;

    // Phase 4 — attach source synchronously inside the ref callback, BEFORE
    // the iOS early-play call below. Native HLS (Safari/iOS) is sync (sets
    // el.src), preserving the first-tap gesture chain.
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
      idx !== entryIndexRef.current
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
            onClose();
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
            onClose();
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
            const hiResPoster = isMux
              ? muxThumbnailUrl(currentItem.mux_playback_id!, { width: 1280 })
              : muxPosterUrl(currentItem);
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

                    if (
                      handoffAppliedRef.current ||
                      !initialVideoState ||
                      currentIndex !== entryIndexRef.current
                    ) {
                      return;
                    }
                    // Only set muted here if the iOS early-play path did NOT run.
                    // If it did, we must keep muted=true until onSeeked attempts
                    // the one-shot unmute, otherwise iOS will pause playback.
                    if (!earlyPlayRanRef.current) {
                      try { v.muted = initialVideoState.muted; } catch { /* ignore */ }
                    }
                    const dur = v.duration;
                    if (isFinite(dur) && dur > 0) {
                      const target = Math.min(
                        Math.max(0, initialVideoState.currentTime),
                        Math.max(0, dur - 0.5)
                      );
                      try { v.currentTime = target; } catch { /* ignore */ }
                    }
                  }}
                  onLoadedData={() => {
                    handleImageLoad(currentItem, currentIndex);
                    // For non-handoff items (or Supabase no-op handoff), reveal
                    // immediately on first frame. Entry-handoff items wait for
                    // onSeeked so we never flash the pre-seek frame.
                    const isEntryHandoff =
                      !!initialVideoState && currentIndex === entryIndexRef.current;
                    if (!isEntryHandoff) {
                      setVideoReady(true);
                    }

                  }}
                  onSeeked={(e) => {
                    e.stopPropagation();
                    // Always reveal once any seek lands — covers handoff seek
                    // and any subsequent user-initiated seeks.
                    setVideoReady(true);

                    if (
                      handoffAppliedRef.current ||
                      !initialVideoState ||
                      currentIndex !== entryIndexRef.current
                    ) {
                      return;
                    }
                    handoffAppliedRef.current = true;
                    const v = e.currentTarget;

                    if (earlyPlayRanRef.current) {
                      // iOS early-play already started playback (muted). If the
                      // user's global pref is unmuted, try once to unmute. If the
                      // browser re-mutes or throws, leave it muted — no retries.
                      if (!initialVideoState.muted) {
                        try { v.muted = false; } catch { /* ignore */ }
                      }
                      return;
                    }

                    // Non-iOS / no early-play path: attempt play here as before.
                    if (!initialVideoState.wasPlaying) return;
                    
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
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPlay={(e) => e.stopPropagation()}
                  onPause={(e) => e.stopPropagation()}
                  onVolumeChange={(e) => e.stopPropagation()}
                  onTimeUpdate={(e) => e.stopPropagation()}
                  onSeeking={(e) => e.stopPropagation()}
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
                        setCurrentIndex(idx);
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
