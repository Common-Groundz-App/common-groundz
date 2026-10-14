import React from 'react';
import { Loader2, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/types/media';
import { isMuxErroredOrBroken, muxPosterUrl } from '@/utils/muxMedia';
import { VIDEO_TILE_COPY } from '@/utils/videoTileCopy';

interface MuxPreparingPosterProps {
  item: MediaItem;
  className?: string;
  /** Tailwind object-fit class, defaults to cover. */
  objectFit?: 'cover' | 'contain';
  /** Hide the label (e.g. tiny thumbnails). */
  hideBadge?: boolean;
  /** Optional alt override. */
  alt?: string;
}

/**
 * Neutral placeholder for a Mux video that can't play yet (processing) or
 * at all (failed / too long). Same tile for everyone on posts, reviews and
 * timeline updates; owners get their detailed note outside the tile.
 * Never mounts a <video>, so it never plays or counts as a view.
 */
export const MuxPreparingPoster: React.FC<MuxPreparingPosterProps> = ({
  item,
  className,
  objectFit = 'cover',
  hideBadge = false,
  alt,
}) => {
  const errored = isMuxErroredOrBroken(item);
  // A failed asset's poster is usually black or missing — never show it.
  const poster = errored ? null : muxPosterUrl(item);
  const label = errored ? VIDEO_TILE_COPY.unavailable : VIDEO_TILE_COPY.processing;
  const Icon = errored ? VideoOff : Loader2;

  return (
    <div
      className={cn('relative w-full h-full min-h-24 bg-muted overflow-hidden', className)}
      data-mux-status={item.mux_status ?? 'preparing'}
      data-testid="mux-preparing-poster"
    >
      {poster && (
        <img
          src={poster}
          alt={alt ?? item.alt ?? label}
          className={cn('w-full h-full', objectFit === 'cover' ? 'object-cover' : 'object-contain')}
          loading="lazy"
          draggable={false}
        />
      )}

      {!hideBadge && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm"
            role="status"
            data-testid="video-tile-label"
          >
            <Icon className={cn('h-3.5 w-3.5', !errored && 'animate-spin')} />
            <span>{label}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MuxPreparingPoster;
