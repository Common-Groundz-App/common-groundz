import React, { useEffect, useState } from 'react';
import { MediaItem, VideoHandoff } from '@/types/media';
import { FeedVideo } from '@/components/media/FeedVideo';
import { cn } from '@/lib/utils';

interface FeedCollageProps {
  media: MediaItem[];
  onItemClick: (originalIndex: number, handoff?: VideoHandoff) => void;
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
    // In multi-item collages: videos letterbox (contain) on black so portrait/
    // landscape clips aren't cropped; images keep cover crop to fill the tile.
    const fit = options?.objectFit ?? (item.type === 'video' ? 'contain' : 'cover');
    return (
      <div
        key={item.id || `${item.url}-${originalIndex}`}
        className="relative w-full h-full overflow-hidden bg-black cursor-pointer"
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
            onTap={() => onItemClick(originalIndex)}
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

interface Shape {
  ratio: number;
  maxHeight: string;
  maxWidth?: string; // cap inner frame so portrait/square don't stretch full-width
  fit: 'cover' | 'contain';
}

function computeShape(
  intrinsic: number | null,
  isVideo: boolean,
  orientationHint?: Orientation
): Shape {
  if (intrinsic == null) {
    // Landscape hint: avoid a temporary portrait flash when intrinsic
    // dimensions haven't loaded yet. Videos use Twitter's tight 16:9 frame
    // (518×292). Images use the looser 5:4-derived cap (518×414) so 4:3 and
    // 3:2 photos aren't visually shrunk before measurement settles.
    if (orientationHint === 'landscape') {
      if (isVideo) {
        return {
          ratio: 16 / 9,
          maxHeight: 'min(292px, 60vh)',
          maxWidth: '518px',
          fit: 'cover',
        };
      }
      return {
        ratio: 16 / 9,
        maxHeight: 'min(414px, 70vh)',
        maxWidth: '518px',
        fit: 'cover',
      };
    }
    // Square video hint: Twitter displays square videos in a taller 4:5 frame
    // (408×510) for better feed viewing. Match this before measurement settles
    // so there is no width/height jump once intrinsic dimensions arrive.
    if (orientationHint === 'square' && isVideo) {
      return {
        ratio: 4 / 5,
        maxHeight: 'min(510px, 75vh)',
        maxWidth: '408px',
        fit: 'cover',
      };
    }
    // Placeholder while measuring. For videos use `cover` to avoid grey/black
    // letterbox during the brief loading window; for images we measure
    // synchronously via Image() so `contain` is fine.
    return {
      ratio: 4 / 5,
      maxHeight: isVideo ? 'min(508px, 75vh)' : 'min(512px, 75vh)',
      maxWidth: isVideo ? '287px' : '403px',
      fit: isVideo ? 'cover' : 'contain',
    };
  }
  // Square
  if (intrinsic >= 0.95 && intrinsic <= 1.05) {
    // Square video — Twitter shows square videos in a taller 4:5 display frame
    // (408×510) with cover cropping for better in-feed viewing.
    if (isVideo) {
      return {
        ratio: 4 / 5,
        maxHeight: 'min(510px, 75vh)',
        maxWidth: '408px',
        fit: 'cover',
      };
    }
    return {
      ratio: 1,
      maxHeight: 'min(560px, 80vh)',
      maxWidth: '480px',
      fit: 'contain',
    };
  }
  // Portrait — match intrinsic so the container hugs the media (no bars).
  if (intrinsic < 0.95) {
    if (isVideo) {
      return {
        ratio: intrinsic,
        maxHeight: 'min(508px, 75vh)',
        maxWidth: '287px',
        fit: 'cover',
      };
    }
    return {
      ratio: Math.min(intrinsic, 4 / 5),
      maxHeight: 'min(512px, 75vh)',
      maxWidth: '403px',
      fit: 'cover',
    };
  }
  // Landscape video — cap to Twitter's 518×292 16:9 frame.
  if (isVideo) {
    return {
      ratio: clamp(intrinsic, 5 / 4, 16 / 9),
      maxHeight: 'min(292px, 60vh)',
      maxWidth: '518px',
      fit: 'cover',
    };
  }
  // Landscape image — cap to 518px wide and 414px tall. 414 is derived from
  // 518 / (5/4) so every ratio in the 5:4–16:9 clamp range renders at the
  // full 518px width; only the height varies naturally. Wide 16:9 images
  // still land around Twitter's 518×292 measurement.
  return {
    ratio: clamp(intrinsic, 5 / 4, 16 / 9),
    maxHeight: 'min(414px, 70vh)',
    maxWidth: '518px',
    fit: 'cover',
  };
}

function SingleMediaTile({ entry, source, sourceId, onItemClick }: SingleMediaTileProps) {
  const { item, originalIndex } = entry;
  const isVideo = item.type === 'video';

  const stored =
    item.width && item.height ? item.width / item.height : null;

  const [measured, setMeasured] = useState<number | null>(null);

  // Measurement priority for legacy media (no stored width/height):
  //   1. Stored dimensions (handled by `stored` above — no probe needed).
  //   2. Poster image (item.thumbnail_url) via Image() — cheap, no CORS,
  //      and for videos the poster carries the true videoWidth/videoHeight.
  //   3. Detached <video preload="metadata"> probe — last resort, with a
  //      2 s safety timeout so a hung request can't pin the placeholder.
  useEffect(() => {
    if (stored != null) return;
    let cancelled = false;

    // Try image / poster first (works for image items and for video items
    // that have a poster).
    const posterSrc = item.thumbnail_url || (!isVideo ? item.url : null);
    if (posterSrc) {
      const probe = new Image();
      probe.onload = () => {
        if (cancelled) return;
        const w = probe.naturalWidth;
        const h = probe.naturalHeight;
        if (w && h) setMeasured(w / h);
      };
      probe.src = posterSrc;
      if (!isVideo || item.thumbnail_url) {
        return () => {
          cancelled = true;
        };
      }
    }

    // Video fallback probe (legacy videos with no width/height AND no poster).
    if (!isVideo) return;
    const src = item.url;
    if (!src) return;

    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.muted = true;
    probe.playsInline = true;

    const handleLoaded = () => {
      if (cancelled) return;
      const w = probe.videoWidth;
      const h = probe.videoHeight;
      if (w && h) setMeasured(w / h);
    };
    const handleError = () => {
      /* graceful fallback: placeholder shape (cover) keeps no bars visible */
    };

    probe.addEventListener('loadedmetadata', handleLoaded);
    probe.addEventListener('error', handleError);
    probe.src = src;

    // Safety timeout: if metadata never resolves, stop waiting.
    const timeout = window.setTimeout(() => {
      if (!cancelled) cancelled = true;
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      probe.removeEventListener('loadedmetadata', handleLoaded);
      probe.removeEventListener('error', handleError);
      try {
        probe.removeAttribute('src');
        probe.load();
      } catch {
        /* ignore */
      }
    };
  }, [stored, isVideo, item.thumbnail_url, item.url]);

  const intrinsic = stored ?? measured;
  const orientationHint = getOrientation(item);
  const { ratio, maxHeight, maxWidth, fit } = computeShape(intrinsic, isVideo, orientationHint);
  const ready = intrinsic != null;

  return (
    <div
      className="relative overflow-hidden rounded-xl bg-black"
      style={{
        aspectRatio: String(ratio),
        maxHeight,
        width: maxWidth ? `min(100%, ${maxWidth})` : '100%',
      }}
    >
      <div
        className="relative w-full h-full overflow-hidden bg-black cursor-pointer"
        onClick={() => onItemClick(originalIndex)}
      >

        {item.type === 'image' ? (
          <img
            src={item.thumbnail_url || item.url}
            alt={item.alt || item.caption || 'Media'}
            className={cn(
              'w-full h-full motion-safe:transition-opacity motion-safe:duration-150',
              fit === 'cover' ? 'object-cover' : 'object-contain',
              ready ? 'opacity-100' : 'opacity-0'
            )}
            loading="lazy"
          />
        ) : (
          <FeedVideo item={item} source={source} sourceId={sourceId} objectFit={fit} onTap={() => onItemClick(originalIndex)} />
        )}
      </div>
    </div>
  );
}
