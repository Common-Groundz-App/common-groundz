import React from 'react';
import type { MediaItem } from '@/types/media';
import { cn } from '@/lib/utils';
import { isMuxItem, isMuxPlayable, muxPosterUrl } from '@/utils/muxMedia';
import { MuxPreparingPoster } from '@/components/media/MuxPreparingPoster';

/**
 * Gallery tile for a video. Ready Mux videos show their poster (they may
 * have an empty `url`); playback happens in the full-screen viewer, which
 * resolves the stream from the playback id. Legacy stored videos keep the
 * plain <video> preview they had before.
 */
export function GalleryVideoThumb({
  item,
  className,
  hideBadge = true,
}: {
  item: MediaItem;
  className?: string;
  hideBadge?: boolean;
}) {
  if (isMuxItem(item)) {
    if (!isMuxPlayable(item)) {
      return <MuxPreparingPoster item={item} className="w-full h-full" objectFit="cover" hideBadge={hideBadge} />;
    }
    return (
      <img
        src={muxPosterUrl(item)}
        alt={item.alt || 'Video'}
        className={cn('w-full h-full object-cover', className)}
        loading="lazy"
        draggable={false}
      />
    );
  }
  return <video src={item.url} className={cn('w-full h-full object-cover', className)} muted playsInline />;
}
