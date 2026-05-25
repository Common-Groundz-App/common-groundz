import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';
import { FeedCollage } from '@/components/media/FeedCollage';
import { cn } from '@/lib/utils';

interface ComposerMediaPreviewProps {
  media: MediaItem[];
  onRemove: (item: MediaItem) => void;
  className?: string;
  /**
   * Optional per-tile overlay. Used by Phase 5 to render a Mux processing/ready/failed chip.
   */
  overlayForItem?: (item: MediaItem) => React.ReactNode;
  /**
   * Optional per-item override that returns a local blob URL to render as a
   * plain native <video controls> in place of the normal FeedVideo branch.
   * Composer-only — used to preview Mux uploads with native controls while
   * Mux is still preparing the HLS asset. Feed callers never pass this.
   */
  previewSrcOverride?: (item: MediaItem) => string | undefined;
}

/**
 * Composer-only media preview. Renders through the same FeedCollage used by
 * the feed so the composer preview is visually identical to the published
 * post (intrinsic ratios, video controls, letterboxed portrait videos in
 * collages, etc.). Adds a remove "X" overlay and lets the caller layer in
 * upload-status chips via `overlayForItem`.
 */
export function ComposerMediaPreview({
  media,
  onRemove,
  className,
  overlayForItem,
  previewSrcOverride,
}: ComposerMediaPreviewProps) {
  if (media.length === 0) return null;

  const sorted = [...media].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className={cn('mt-3', className)}>
      <FeedCollage
        media={sorted}
        source="post"
        onItemClick={() => {}}
        disableItemClick
        previewSrcOverride={previewSrcOverride}
        renderTileOverlay={(item) => (
          <>
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
          </>
        )}
      />
    </div>
  );
}
