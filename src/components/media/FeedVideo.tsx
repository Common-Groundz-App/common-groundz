import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, Film, AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useVideoMute, readGlobalVideoMuted } from '@/hooks/useVideoMute';
import { useVideoAutoplay } from '@/hooks/useVideoAutoplay';
import { useVideoMilestones } from '@/hooks/useVideoMilestones';
import { useVideoViewTracker } from '@/hooks/useVideoViewTracker';
import { formatDuration } from '@/utils/videoPoster';
import { extractMediaPath } from '@/utils/mediaPath';
import { analytics } from '@/services/analytics';
import { MediaItem } from '@/types/media';

interface FeedVideoProps {
  item: MediaItem;
  className?: string;
  onTap?: () => void;
  showBadge?: boolean;
  objectFit?: 'contain' | 'cover';
  source?: 'post' | 'review' | 'entity';
  sourceId?: string;
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

export function FeedVideo({
  item,
  className,
  onTap,
  showBadge = true,
  objectFit = 'contain',
  source = 'post',
  sourceId,
}: FeedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, toggleMute] = useVideoMute();
  const playedRef = useRef(false);
  const autoplayRef = useRef<boolean>(true);
  const userPausedRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);

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

  useVideoAutoplay(videoRef, { threshold: 0.5, enabled: autoplayEnabled && !isScrubbing });
  useVideoMilestones(videoRef, { src: item.url, autoplayRef });
  useVideoViewTracker({
    videoRef,
    source,
    sourceId,
    mediaPath: extractMediaPath(item.url),
    autoplayRef,
  });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

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
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
      onTap();
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
        src={item.url}
        poster={item.thumbnail_url}
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
