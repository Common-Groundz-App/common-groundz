import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, Film, AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useVideoMute } from '@/hooks/useVideoMute';
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

  const [status, setStatus] = useState<Status>('loading');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  useVideoAutoplay(videoRef, { threshold: 0.5, enabled: autoplayEnabled });
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

  const handlePlay = () => {
    setIsPlaying(true);
    if (playedRef.current) return;
    playedRef.current = true;
    const wasAutoplay = videoRef.current?.muted ?? true;
    autoplayRef.current = wasAutoplay;
    analytics.trackVideoPlayed({ autoplay: wasAutoplay, src: item.url });
  };

  const handlePause = () => setIsPlaying(false);

  const handleLoadedData = () => {
    setStatus('ready');
    const v = videoRef.current;
    if (v && v.videoHeight > v.videoWidth) setIsPortrait(true);
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
      // Pause feed video before lightbox opens to avoid double audio.
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

  const showPosterFallback = !item.thumbnail_url && status !== 'ready' && status !== 'error' && status !== 'unsupported';

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full group', className)}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
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
        onError={handleError}
        className={cn(
          'w-full h-full rounded-md',
          objectFit === 'contain' ? 'object-contain' : 'object-cover',
          isPortrait && 'aspect-[9/16] max-h-[560px] mx-auto'
        )}
      />

      {/* Poster fallback when no thumbnail and not yet ready */}
      {showPosterFallback && (
        <div className="absolute inset-0 rounded-md bg-muted flex items-center justify-center pointer-events-none">
          <Film className="h-8 w-8 text-muted-foreground" aria-hidden />
        </div>
      )}

      {/* Loading skeleton overlay */}
      {status === 'loading' && (
        <Skeleton className="absolute inset-0 rounded-md" />
      )}

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

      {/* Mute button */}
      <button
        type="button"
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        aria-pressed={!muted}
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        className="absolute bottom-2 left-2 rounded-full bg-black/60 hover:bg-black/80 p-2 text-white min-h-9 min-w-9 flex items-center justify-center motion-safe:transition"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {showBadge && item.duration ? (
        <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
          {formatDuration(item.duration)}
        </div>
      ) : null}
    </div>
  );
}
