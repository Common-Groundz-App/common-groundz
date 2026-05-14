import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Film, Upload, X } from 'lucide-react';
import {
  uploadMedia,
  ALLOWED_MEDIA_TYPES,
  validateMediaFile,
  MAX_VIDEOS_PER_POST,
} from '@/services/mediaService';
import { formatDuration, formatBytes, generateVideoPoster } from '@/utils/videoPoster';
import { MediaUploadState, MediaItem } from '@/types/media';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { detectHEVCRisk } from '@/utils/codecSupport';
import { MediaCompatibilityBadge } from '@/components/media/MediaCompatibilityBadge';

interface MediaUploaderProps {
  sessionId: string;
  onMediaUploaded: (media: MediaItem) => void;
  initialMedia?: MediaItem[];
  className?: string;
  customButton?: React.ReactNode;
  maxMediaCount?: number;
  disabled?: boolean;
  /**
   * When false (and `customButton` is set), the uploader only renders the
   * trigger and reports in-flight uploads via `onUploadsChange` so the
   * parent can render the progress rows in a different region (e.g. above
   * the toolbar instead of inside it).
   * Default: true (current behavior).
   */
  renderUploadsInline?: boolean;
  /** Callback fired whenever the in-flight upload list changes. */
  onUploadsChange?: (
    uploads: MediaUploadState[],
    cancel: (upload: MediaUploadState) => void
  ) => void;
}

/**
 * Renders a single in-flight upload row. Exported so callers using
 * `renderUploadsInline={false}` can render the rows themselves above
 * the composer toolbar.
 */
export function UploadRow({
  upload,
  onCancel,
}: {
  upload: MediaUploadState;
  onCancel: (upload: MediaUploadState) => void;
}) {
  const isVideo = upload.file.type.startsWith('video/');
  const serverPoster = upload.item?.thumbnail_url;
  const localPoster = upload.localPosterUrl;
  const duration = upload.item?.duration ?? upload.localDuration;
  const ext =
    upload.file.name.split('.').pop()?.toUpperCase() || (isVideo ? 'VIDEO' : 'IMAGE');

  // Staged animator. We don't have real byte-level progress (Supabase Storage
  // upload uses fetch and doesn't expose it), so we ease a local `display`
  // value toward a per-stage ceiling. Guarantees a minimum forward creep so
  // the bar never visually freezes on slow connections.
  const stage = upload.stage ?? 'preparing';
  const isError = upload.status === 'error';
  const [display, setDisplay] = useState(0);
  // Bumped ceiling for pathologically slow `preparing` (e.g. huge MOV on a
  // slow CPU). Reassures the user that work is still happening.
  const [preparingBoost, setPreparingBoost] = useState(false);

  // After 10s still in `preparing`, nudge the ceiling up once.
  useEffect(() => {
    if (stage !== 'preparing') {
      setPreparingBoost(false);
      return;
    }
    const t = setTimeout(() => setPreparingBoost(true), 10000);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (isError) return; // Freeze on error.
    if (stage === 'done') {
      setDisplay(100);
      return;
    }
    const ceiling =
      stage === 'preparing'
        ? preparingBoost
          ? 25
          : 15
        : stage === 'uploading'
        ? 90
        : /* finalizing */ 97;

    let raf = 0;
    const tick = () => {
      setDisplay((cur) => {
        if (cur >= ceiling) return ceiling;
        const next = cur + Math.max((ceiling - cur) * 0.04, 0.15);
        return next > ceiling ? ceiling : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, preparingBoost, isError]);

  const stageLabel = isError
    ? 'Upload failed'
    : stage === 'preparing'
    ? isVideo
      ? 'Preparing video…'
      : 'Preparing…'
    : stage === 'uploading'
    ? 'Uploading…'
    : stage === 'finalizing'
    ? 'Finalizing…'
    : '';

  const showShimmer = !isError && stage !== 'done';

  return (
    <div className="flex items-center space-x-2 border border-border rounded-md p-2">
      <div className="flex-shrink-0 relative w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {isVideo ? (
          serverPoster || localPoster ? (
            <>
              <img
                src={serverPoster ?? localPoster}
                alt=""
                className="w-full h-full object-cover"
              />
              {duration ? (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white leading-none">
                  {formatDuration(duration)}
                </span>
              ) : null}
            </>
          ) : upload.status === 'uploading' || upload.status === 'idle' ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <Film size={20} className="text-muted-foreground" />
          )
        ) : (
          <ImageIcon size={20} className="text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{upload.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {ext} · {formatBytes(upload.file.size)}
          {duration ? ` · ${formatDuration(duration)}` : ''}
        </p>
        {isVideo && upload.compatibility ? (
          <div className="mt-1">
            <MediaCompatibilityBadge
              state={upload.compatibility}
              note={upload.compatibilityNote}
            />
          </div>
        ) : null}
        {stageLabel ? (
          <p
            className={cn(
              'text-[11px] mt-1 leading-none',
              isError ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {stageLabel}
          </p>
        ) : null}
        <div className="relative h-1 mt-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-[width] duration-150 ease-out"
            style={{ width: `${display}%` }}
          />
          {showShimmer ? (
            <div
              className="pointer-events-none absolute inset-0 motion-safe:animate-shimmer-slide bg-gradient-to-r from-transparent via-white/40 to-transparent"
              style={{ width: '40%' }}
              aria-hidden
            />
          ) : null}
        </div>
      </div>
      <div className="flex-shrink-0">
        {upload.status === 'success' ? (
          <div className="text-success text-sm" aria-label="Upload complete">
            ✓
          </div>
        ) : upload.status === 'error' ? (
          <div className="text-destructive text-sm" aria-label="Upload failed">
            ✗
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onCancel(upload)}
            aria-label="Cancel upload"
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}

export function MediaUploader({
  sessionId,
  onMediaUploaded,
  initialMedia = [],
  className,
  customButton,
  maxMediaCount = 4,
  disabled = false,
  renderUploadsInline = true,
  onUploadsChange,
}: MediaUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploads, setUploads] = useState<MediaUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [currentMediaCount, setCurrentMediaCount] = useState(initialMedia.length);
  const [currentVideoCount, setCurrentVideoCount] = useState(
    initialMedia.filter((m) => m.type === 'video').length
  );

  // Keep object URLs we create so we can revoke them on unmount.
  const objectUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setCurrentMediaCount(initialMedia.length);
    setCurrentVideoCount(initialMedia.filter((m) => m.type === 'video').length);
  }, [initialMedia]);

  // Notify parent of upload list changes (used when renderUploadsInline=false).
  useEffect(() => {
    onUploadsChange?.(uploads, cancelUpload);
  }, [uploads, onUploadsChange]);

  // Revoke any leftover object URLs on unmount.
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      });
      objectUrlsRef.current.clear();
    };
  }, []);

  const revokePoster = (url?: string) => {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    objectUrlsRef.current.delete(url);
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !user || disabled) return;

    const remainingSlots = maxMediaCount - currentMediaCount;

    if (remainingSlots <= 0) {
      toast({
        title: 'Media limit reached',
        description: `You can only add up to ${maxMediaCount} media items to one experience`,
        variant: 'destructive',
      });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast({
        title: 'Too many files selected',
        description: `Only the first ${remainingSlots} files will be processed.`,
      });
    }

    // Enforce 1 video per post — count videos already selected in this batch too.
    let pendingVideoCount =
      currentVideoCount + uploads.filter((u) => u.file.type.startsWith('video/')).length;

    for (const file of filesToProcess) {
      const isVideo = file.type.startsWith('video/');

      if (isVideo && pendingVideoCount >= MAX_VIDEOS_PER_POST) {
        toast({
          title: 'Only 1 video per experience',
          description:
            'You can include one video in this version. Remove the existing video to add a different one.',
          variant: 'destructive',
        });
        continue;
      }

      const { valid, error } = await validateMediaFile(file);
      if (!valid) {
        toast({ title: 'Invalid file', description: error, variant: 'destructive' });
        continue;
      }

      if (isVideo) {
        pendingVideoCount += 1;
      }

      const newUpload: MediaUploadState = {
        file,
        progress: 0,
        status: 'uploading',
        stage: 'preparing',
        compatibility: isVideo ? 'checking' : undefined,
      };
      setUploads((prev) => [...prev, newUpload]);

      if (isVideo) {
        // Soft, non-blocking compatibility hint shown inline as a badge.
        const isMov = file.type === 'video/quicktime' || /\.mov$/i.test(file.name);
        (async () => {
          let compatibility: 'compatible' | 'risky' = 'compatible';
          let note: string | undefined;
          if (isMov) {
            const warning = await detectHEVCRisk(file);
            if (warning) {
              compatibility = 'risky';
              note = warning;
            }
          }
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file ? { ...u, compatibility, compatibilityNote: note } : u
            )
          );
        })();

        // Generate a local poster + duration so the row shows a thumbnail
        // immediately, instead of waiting for the server upload to finish.
        (async () => {
          try {
            const poster = await generateVideoPoster(file);
            const url = URL.createObjectURL(poster.posterBlob);
            objectUrlsRef.current.add(url);
            setUploads((prev) =>
              prev.map((u) =>
                u.file === file
                  ? { ...u, localPosterUrl: url, localDuration: poster.duration }
                  : u
              )
            );
          } catch {
            // Generation failed — UploadRow falls back to the Film icon.
          }
        })();
      }

      uploadMedia(file, user.id, sessionId, (progress, stage) => {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, progress, ...(stage ? { stage } : {}) }
              : u
          )
        );
      }).then((mediaItem) => {
        if (mediaItem) {
          onMediaUploaded(mediaItem);
          setCurrentMediaCount((prev) => prev + 1);
          if (mediaItem.type === 'video') setCurrentVideoCount((prev) => prev + 1);

          // Remove the in-flight row immediately — the final preview is
          // already mounting in the same React commit, so the handoff feels
          // instant instead of lingering for ~2s.
          setUploads((prev) => {
            const target = prev.find((u) => u.file === file);
            if (target?.localPosterUrl) revokePoster(target.localPosterUrl);
            return prev.filter((u) => u.file !== file);
          });
        } else {
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file ? { ...u, status: 'error', error: 'Upload failed' } : u
            )
          );
        }
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    if (!disabled) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const cancelUpload = (uploadToCancel: MediaUploadState) => {
    revokePoster(uploadToCancel.localPosterUrl);
    setUploads((prev) => prev.filter((u) => u !== uploadToCancel));
  };

  if (customButton) {
    return (
      <div className={className}>
        <div
          onClick={() => {
            if (disabled || currentMediaCount >= maxMediaCount) {
              if (!disabled) {
                toast({
                  title: 'Media limit reached',
                  description: `You can only add up to ${maxMediaCount} media items to one experience`,
                  variant: 'destructive',
                });
              }
              return;
            }
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = ALLOWED_MEDIA_TYPES.join(',');
            input.onchange = (e) =>
              handleFileSelect((e.target as HTMLInputElement).files);
            input.click();
          }}
        >
          {customButton}
        </div>

        {renderUploadsInline && uploads.length > 0 && (
          <div className="space-y-2 mt-2">
            {uploads.map((upload, index) => (
              <UploadRow key={index} upload={upload} onCancel={cancelUpload} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-all',
          disabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
          !disabled && isDragging ? 'border-primary bg-primary/10' : 'border-border',
          !disabled && !isDragging && 'hover:border-primary/50',
          currentMediaCount >= maxMediaCount && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onDrop={disabled ? undefined : handleDrop}
        onClick={() => {
          if (disabled || currentMediaCount >= maxMediaCount) {
            if (!disabled) {
              toast({
                title: 'Media limit reached',
                description: `You can only add up to ${maxMediaCount} media items to one experience`,
                variant: 'destructive',
              });
            }
            return;
          }
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = ALLOWED_MEDIA_TYPES.join(',');
          input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
          input.click();
        }}
      >
        <div className="flex flex-col items-center space-y-2">
          <div className="p-3 bg-primary/10 rounded-full">
            <Upload size={24} className="text-primary" />
          </div>
          <div>
            <p className="font-medium">Add photos or a short video to your experience</p>
            <p className="text-sm text-muted-foreground">
              Images up to 10 MB · 1 video up to 100 MB, 60 seconds (MP4, MOV, WebM)
            </p>
            <p className="text-xs font-medium mt-1">
              {currentMediaCount}/{maxMediaCount} media items used
            </p>
          </div>
        </div>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <UploadRow key={index} upload={upload} onCancel={cancelUpload} />
          ))}
        </div>
      )}
    </div>
  );
}
