
import React, { useState, useCallback } from 'react';
import { MediaItem, VideoHandoff, VideoExitHandoff } from '@/types/media';
import { FeedCollage } from '@/components/media/FeedCollage';
import { cn } from '@/lib/utils';
import { LightboxPreview } from '@/components/media/LightboxPreview';
import { readGlobalVideoMuted, setGlobalVideoMuted } from '@/hooks/useVideoMute';
import { useFeedVideoManagerControls } from '@/hooks/useFeedVideoManager';
import type { LightboxEntryExtras } from '@/components/media/lightboxTypes';
import { findByMediaKey } from '@/utils/mediaIdentity';
import { getPostDisplayMedia } from '@/utils/postDisplayMedia';

interface PostMediaDisplayProps {
  media?: MediaItem[];
  className?: string;
  displayType?: 'grid' | 'carousel' | 'linkedin';
  maxHeight?: string;
  aspectRatio?: 'maintain' | '16:9' | '4:5' | '1:1';
  objectFit?: 'contain' | 'cover';
  enableBackground?: boolean;
  thumbnailDisplay?: 'always' | 'hover' | 'none';
  enableLazyLoading?: boolean;
  /** Source type for video view tracking. Defaults to 'post'. */
  source?: 'post' | 'review' | 'entity';
  /** Source id (post id, review id, etc.) for video view tracking. */
  sourceId?: string;
}

export function PostMediaDisplay({ 
  media, 
  className,
  displayType = 'linkedin',
  maxHeight,
  aspectRatio = 'maintain',
  objectFit = 'contain',
  enableBackground = true,
  thumbnailDisplay = 'always',
  enableLazyLoading = true,
  source = 'post',
  sourceId
}: PostMediaDisplayProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // Phase 4 Step 3 — stable media ID of the item the lightbox was opened on
  // (null when the item genuinely has no ID). The lightbox resolves its entry
  // index from this key, so a removed neighbour can't shift the open target.
  const [activeMediaKey, setActiveMediaKey] = useState<string | null>(null);
  const [videoHandoff, setVideoHandoff] = useState<VideoHandoff | null>(null);
  const [entryExtras, setEntryExtras] = useState<LightboxEntryExtras | null>(null);
  const [videoResume, setVideoResume] = useState<{ index: number; mediaKey?: string | null; handoff: VideoExitHandoff } | null>(null);
  const { setLightboxOpen: setManagerLightboxOpen } = useFeedVideoManagerControls();
  
  if (!media || media.length === 0 || media.every(m => m.is_deleted)) {
    return null;
  }
  
  // Filter out deleted media and sort by order
  // Post display order (video first) is computed ONCE here and shared by the
  // collage and the lightbox so their positions always agree.
  const validMedia = getPostDisplayMedia(
    media
      .filter(item => !item.is_deleted)
      .sort((a, b) => a.order - b.order)
  )
    .map(item => {
      // Enhanced orientation detection - ensure each media item has accurate orientation
      if (!item.orientation && item.width && item.height) {
        const ratio = item.width / item.height;
        let orientation: 'portrait' | 'landscape' | 'square';
        
        // More precise thresholds for orientation detection
        if (ratio > 1.05) orientation = 'landscape';
        else if (ratio < 0.95) orientation = 'portrait';
        else orientation = 'square';
        
        return { ...item, orientation };
      } else if (!item.orientation) {
        // Default to landscape if we have no dimensions
        return { ...item, orientation: 'landscape' as const };
      }
      
      return item;
    });
    
  if (validMedia.length === 0) {
    return null;
  }
  
  // Determine appropriate maxHeight based on content and first image orientation
  const adaptiveMaxHeight = () => {
    if (maxHeight) return maxHeight;
    
    // Get first image orientation for better layout decisions
    const firstImageOrientation = validMedia[0].orientation || 'landscape';
    
    // Single image handling with orientation awareness
    if (validMedia.length === 1) {
      if (firstImageOrientation === 'portrait') return 'h-auto max-h-[600px]';
      if (firstImageOrientation === 'landscape') return 'h-auto max-h-[400px]';
      return 'h-auto max-h-[400px]'; // square
    }
    
    // Multiple images with LinkedIn layout - adjust based on first image orientation
    if (displayType === 'linkedin' && validMedia.length > 1) {
      if (firstImageOrientation === 'portrait') return 'h-auto max-h-[560px]'; // Taller for portrait first
      return 'h-auto max-h-[480px]'; // Standard height for landscape first
    }
    
    // Default for multiple images
    return 'h-auto max-h-[500px]';
  };
  
  const handleImageClick = (index: number, handoff?: VideoHandoff, extras?: LightboxEntryExtras, key?: string | null) => {
    setActiveImageIndex(index);
    setActiveMediaKey(key ?? null);
    // Both state updates happen in the same handler — React batches them so
    // LightboxPreview never mounts a render before entryPosterDataUrl is set.
    setVideoHandoff(handoff ?? null);
    setEntryExtras(extras ?? null);
    setLightboxOpen(true);
    // Phase 1: synchronously pause all feed videos via the manager so
    // there's no debounce gap before the lightbox takes over playback.
    setManagerLightboxOpen(true);
  };

  const handleLightboxClose = () => {
    setLightboxOpen(false);
    // Reset so a later open of a different post can't inherit stale state.
    setVideoHandoff(null);
    setActiveMediaKey(null);
    // Drop the dataURL — never retained in a ref. Eligible for GC immediately.
    setEntryExtras(null);
    setManagerLightboxOpen(false);
  };

  // Reverse handoff: mute is a global preference, so always sync it.
  // Timestamp/play resume only applies when the user closed on the SAME
  // item they originally opened from the feed. Phase 4 Step 3: when the
  // handoff carries stable media keys, compare those (missing keys never
  // compare equal); the numeric index comparison is the legacy fallback for
  // ID-less items only.
  const handleExitHandoff = useCallback((h: VideoExitHandoff) => {
    if (h.muted !== readGlobalVideoMuted()) {
      setGlobalVideoMuted(h.muted);
    }
    const sameByKey = h.entryMediaKey != null && h.currentMediaKey != null
      ? h.entryMediaKey === h.currentMediaKey
      : null;
    const sameItem = sameByKey ?? (h.entryIndex === h.currentIndex);
    if (sameItem) {
      setVideoResume({ index: h.entryIndex, mediaKey: h.entryMediaKey ?? null, handoff: h });
    }
  }, []);

  const handleResumeConsumed = useCallback(() => {
    setVideoResume(null);
  }, []);

  return (
    <>
      <FeedCollage
        media={validMedia}
        onItemClick={handleImageClick}
        source={source}
        sourceId={sourceId}
        className={cn("mt-3", className)}
        videoResume={videoResume}
        onResumeConsumed={handleResumeConsumed}
      />

      {/* Replace Dialog with a direct render of LightboxPreview when lightbox is open */}
      {lightboxOpen && (
        <LightboxPreview
          media={validMedia}
          initialIndex={(() => {
            // Resolve the entry position from the stable media ID at open
            // time; fall back to the clicked position only for ID-less items.
            const byKey = findByMediaKey(validMedia, activeMediaKey);
            return byKey >= 0 ? byKey : activeImageIndex;
          })()}
          initialMediaKey={activeMediaKey ?? undefined}
          initialVideoState={videoHandoff ?? undefined}
          entryExtras={entryExtras ?? undefined}
          onExitHandoff={handleExitHandoff}
          onClose={handleLightboxClose}
        />
      )}
    </>
  );
}
