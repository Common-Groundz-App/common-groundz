import React, { useEffect, useState } from 'react';
import { MediaItem } from '@/types/media';
import { FeedVideo } from '@/components/media/FeedVideo';
import { cn } from '@/lib/utils';

interface FeedCollageProps {
  media: MediaItem[];
  onItemClick: (originalIndex: number) => void;
  source?: 'post' | 'review' | 'entity';
  sourceId?: string;
  className?: string;
}

type Orientation = 'portrait' | 'landscape' | 'square';

function getOrientation(item: MediaItem): Orientation {
  if (item.orientation) return item.orientation;
  if (item.width && item.height) {
    const r = item.width / item.height;
    if (r > 1.05) return 'landscape';
    if (r < 0.95) return 'portrait';
    return 'square';
  }
  return 'landscape';
}

interface DisplayEntry {
  item: MediaItem;
  originalIndex: number;
}

export function FeedCollage({
  media,
  onItemClick,
  source = 'post',
  sourceId,
  className,
}: FeedCollageProps) {
  if (!media || media.length === 0) return null;

  // Build display order; promote first video to index 0 for multi-item posts.
  const entries: DisplayEntry[] = media.map((item, originalIndex) => ({ item, originalIndex }));
  if (entries.length > 1) {
    const firstVideoIdx = entries.findIndex((e) => e.item.type === 'video');
    if (firstVideoIdx > 0) {
      const [v] = entries.splice(firstVideoIdx, 1);
      entries.unshift(v);
    }
  }

  const count = media.length;

  const renderTile = (
    entry: DisplayEntry,
    options?: { overlayCount?: number; objectFit?: 'cover' | 'contain' }
  ) => {
    const { item, originalIndex } = entry;
    const fit = options?.objectFit ?? 'cover';
    return (
      <div
        key={item.id || `${item.url}-${originalIndex}`}
        className="relative w-full h-full overflow-hidden bg-muted cursor-pointer"
        onClick={() => onItemClick(originalIndex)}
      >
        {item.type === 'image' ? (
          <img
            src={item.thumbnail_url || item.url}
            alt={item.alt || item.caption || 'Media'}
            className={cn('w-full h-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
            loading="lazy"
          />
        ) : (
          <FeedVideo
            item={item}
            source={source}
            sourceId={sourceId}
            objectFit={fit}
          />
        )}
        {options?.overlayCount && options.overlayCount > 0 ? (
          <div className="absolute inset-0 bg-black/55 text-white flex items-center justify-center text-2xl font-semibold pointer-events-none">
            +{options.overlayCount}
          </div>
        ) : null}
      </div>
    );
  };

  // Single item: shape the container to the media's intrinsic ratio (clamped),
  // so there are no grey letterbox bars. Hard max-height caps prevent very tall
  // media from dominating the feed.
  if (count === 1) {
    return (
      <div className={cn('w-full', className)}>
        <SingleMediaTile
          entry={entries[0]}
          source={source}
          sourceId={sourceId}
          onItemClick={onItemClick}
        />
      </div>
    );
  }

  // Multi-item collages — outer fixed aspect, tiles object-cover.
  // For 2 items, use a slightly taller aspect when both are portrait.
  let outerAspect = 'aspect-[16/9]';
  if (count === 2) {
    const bothPortrait =
      getOrientation(entries[0].item) === 'portrait' &&
      getOrientation(entries[1].item) === 'portrait';
    if (bothPortrait) outerAspect = 'aspect-[4/3]';
  }

  if (count === 2) {
    return (
      <div className={cn('w-full', className)}>
        <div className={cn('relative w-full overflow-hidden rounded-xl', outerAspect)}>
          <div className="grid grid-cols-2 gap-1 w-full h-full">
            {renderTile(entries[0])}
            {renderTile(entries[1])}
          </div>
        </div>
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className={cn('w-full', className)}>
        <div className={cn('relative w-full overflow-hidden rounded-xl', outerAspect)}>
          <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">
            <div className="row-span-2 h-full">{renderTile(entries[0])}</div>
            {renderTile(entries[1])}
            {renderTile(entries[2])}
          </div>
        </div>
      </div>
    );
  }

  // 4+ items
  const visible = entries.slice(0, 4);
  const extra = count - 4;
  return (
    <div className={cn('w-full', className)}>
      <div className={cn('relative w-full overflow-hidden rounded-xl', outerAspect)}>
        <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">
          {visible.map((entry, idx) =>
            renderTile(entry, idx === 3 && extra > 0 ? { overlayCount: extra } : undefined)
          )}
        </div>
      </div>
    </div>
  );
}

interface SingleMediaTileProps {
  entry: DisplayEntry;
  source: 'post' | 'review' | 'entity';
  sourceId?: string;
  onItemClick: (originalIndex: number) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function computeShape(
  intrinsic: number | null,
  isVideo: boolean
): { ratio: number; maxHeight: string } {
  if (intrinsic == null) {
    // Neutral placeholder while we measure — sits between portrait and landscape.
    return { ratio: 4 / 5, maxHeight: 'min(620px, 80vh)' };
  }
  if (intrinsic >= 0.95 && intrinsic <= 1.05) {
    return { ratio: 1, maxHeight: 'min(620px, 80vh)' };
  }
  if (intrinsic < 0.95) {
    // Portrait
    if (isVideo) {
      return { ratio: clamp(intrinsic, 9 / 16, 3 / 4), maxHeight: 'min(700px, 80vh)' };
    }
    return { ratio: clamp(intrinsic, 3 / 4, 4 / 5), maxHeight: 'min(620px, 80vh)' };
  }
  // Landscape
  return { ratio: clamp(intrinsic, 5 / 4, 16 / 9), maxHeight: 'min(560px, 80vh)' };
}

function SingleMediaTile({ entry, source, sourceId, onItemClick }: SingleMediaTileProps) {
  const { item, originalIndex } = entry;
  const isVideo = item.type === 'video';

  const stored =
    item.width && item.height ? item.width / item.height : null;

  const [measured, setMeasured] = useState<number | null>(null);

  // Preload to measure legacy images that have no stored dimensions.
  useEffect(() => {
    if (stored != null || isVideo) return;
    const src = item.thumbnail_url || item.url;
    if (!src) return;
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (cancelled) return;
      const w = probe.naturalWidth;
      const h = probe.naturalHeight;
      if (w && h) setMeasured(w / h);
    };
    probe.src = src;
    return () => {
      cancelled = true;
    };
  }, [stored, isVideo, item.thumbnail_url, item.url]);

  const intrinsic = stored ?? measured;
  const { ratio, maxHeight } = computeShape(intrinsic, isVideo);
  const ready = intrinsic != null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-muted"
      style={{ aspectRatio: String(ratio), maxHeight }}
    >
      <div
        className="relative w-full h-full overflow-hidden bg-muted cursor-pointer"
        onClick={() => onItemClick(originalIndex)}
      >
        {item.type === 'image' ? (
          <img
            src={item.thumbnail_url || item.url}
            alt={item.alt || item.caption || 'Media'}
            className={cn(
              'w-full h-full object-cover motion-safe:transition-opacity motion-safe:duration-150',
              ready ? 'opacity-100' : 'opacity-0'
            )}
            loading="lazy"
          />
        ) : (
          <FeedVideo item={item} source={source} sourceId={sourceId} objectFit="cover" />
        )}
      </div>
    </div>
  );
}
