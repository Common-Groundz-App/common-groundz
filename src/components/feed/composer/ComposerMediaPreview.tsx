import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';
import { FeedVideo } from '@/components/media/FeedVideo';
import { cn } from '@/lib/utils';

interface ComposerMediaPreviewProps {
  media: MediaItem[];
  onRemove: (item: MediaItem) => void;
  className?: string;
  /**
   * Optional per-tile overlay. Used by Phase 5 to render a Mux processing/ready/failed chip.
   */
  overlayForItem?: (item: MediaItem) => React.ReactNode;
}

/**
 * Composer-only media preview. Pure grid, no click-to-expand, no carousel
 * mode. Videos render with FeedVideo so autoplay/mute/duration keep working
 * regardless of how many items are attached.
 */
export function ComposerMediaPreview({
  media,
  onRemove,
  className,
  overlayForItem,
}: ComposerMediaPreviewProps) {
  if (media.length === 0) return null;

  const sorted = [...media].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const count = sorted.length;

  const renderTile = (
    item: MediaItem,
    opts: { aspect: string; fit?: 'cover' | 'contain'; extraClass?: string } = {
      aspect: 'aspect-square',
    }
  ) => {
    const fit = opts.fit ?? 'cover';
    return (
      <div
        key={item.id || item.url}
        className={cn(
          'relative overflow-hidden rounded-lg bg-muted',
          opts.aspect,
          opts.extraClass
        )}
      >
        {item.type === 'video' ? (
          <FeedVideo
            item={item}
            source="post"
            objectFit={fit}
            className="w-full h-full"
          />
        ) : (
          <img
            src={item.url}
            alt={item.alt || item.caption || ''}
            className={cn(
              'w-full h-full',
              fit === 'cover' ? 'object-cover' : 'object-contain'
            )}
            loading="lazy"
          />
        )}

        {overlayForItem?.(item)}

        <Button
          type="button"
          variant="destructive"
          size="icon"
          aria-label="Remove media"
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-sm z-10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  if (count === 1) {
    return (
      <div className={cn('mt-3', className)}>
        {renderTile(sorted[0], {
          aspect: 'max-h-[480px] aspect-auto',
          fit: 'contain',
          extraClass: 'flex items-center justify-center',
        })}
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className={cn('mt-3 grid grid-cols-2 gap-1', className)}>
        {sorted.map((item) => renderTile(item, { aspect: 'aspect-square' }))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className={cn('mt-3 grid grid-cols-2 grid-rows-2 gap-1', className)}>
        {renderTile(sorted[0], {
          aspect: 'h-full',
          extraClass: 'row-span-2',
        })}
        {renderTile(sorted[1], { aspect: 'aspect-square' })}
        {renderTile(sorted[2], { aspect: 'aspect-square' })}
      </div>
    );
  }

  // 4 items
  return (
    <div className={cn('mt-3 grid grid-cols-2 grid-rows-2 gap-1', className)}>
      {sorted.slice(0, 4).map((item) =>
        renderTile(item, { aspect: 'aspect-square' })
      )}
    </div>
  );
}
