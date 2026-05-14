import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  /** Source type for view tracking. Defaults to 'post'. */
  source?: 'post' | 'review' | 'entity';
  /** Source id (e.g. post id) — required to track views. No-op if missing. */
  sourceId?: string;
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
  const [muted, toggleMute] = useVideoMute();
  const playedRef = useRef(false);
  const autoplayRef = useRef<boolean>(true);

  useVideoAutoplay(videoRef, { threshold: 0.5 });
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

  const handlePlay = () => {
    if (playedRef.current) return;
    playedRef.current = true;
    const wasAutoplay = videoRef.current?.muted ?? true;
    autoplayRef.current = wasAutoplay;
    analytics.trackVideoPlayed({ autoplay: wasAutoplay, src: item.url });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTap) {
      onTap();
      return;
    }
    toggleMute();
  };

  return (
    <div className={cn('relative w-full h-full', className)} onClick={handleClick}>
      <video
        ref={videoRef}
        src={item.url}
        poster={item.thumbnail_url}
        muted={muted}
        playsInline
        loop
        preload="metadata"
        onPlay={handlePlay}
        className={cn(
          'w-full h-full rounded-md',
          objectFit === 'contain' ? 'object-contain' : 'object-cover'
        )}
      />

      <button
        type="button"
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        className="absolute bottom-2 left-2 rounded-full bg-black/60 hover:bg-black/80 p-2 text-white transition"
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
