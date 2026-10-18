import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Film, Upload, X } from 'lucide-react';
import {
  uploadMedia,
  deleteMedia,
  ALLOWED_MEDIA_TYPES,
  ALLOWED_IMAGE_TYPES,
  validateMediaFile,
  MAX_VIDEOS_PER_POST,
  type LatePosterPatch,
} from '@/services/mediaService';
import { formatDuration, formatBytes, generateVideoPoster } from '@/utils/videoPoster';
import { MediaUploadState, MediaItem } from '@/types/media';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { detectHEVCRisk } from '@/utils/codecSupport';
import { MediaCompatibilityBadge } from '@/components/media/MediaCompatibilityBadge';

interface MediaUploaderProps {
  sessionId: string;
  /**
   * Called once an upload resolves to a persisted MediaItem. The original
   * source `File` is passed as a second argument so callers can build a
   * transient local preview (e.g. URL.createObjectURL) for Mux-backed
   * videos while Mux is still preparing the HLS asset.
   */
  onMediaUploaded: (media: MediaItem, file?: File) => void;
  /** Posts only: a poster that arrived after the video item was emitted. */
  onLatePoster?: (muxUploadId: string, patch: LatePosterPatch) => void;
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
  /**
   * Optional (review composer): reserve slots atomically before any upload
   * starts; returns how many were granted. When omitted, behaviour is unchanged.
   */
  reserveSlots?: (requested: number) => number;
  /** Optional: called exactly once per reserved file (success, failure or skip). */
  releaseSlot?: () => void;
  /**
   * Optional: when false, video files are refused (pick and drop) before any
   * slot is reserved or upload starts. Default true (posts unchanged).
   */
  allowVideo?: boolean;
  /** Optional: message shown when a video is refused because allowVideo is false. */
  videoRefusedMessage?: string;
  /**
   * Optional (review composers): videos go to Mux only, never the storage
   * fallback, and a cancelled upload's late result is dropped (slot released,
   * never added). Default false (posts unchanged).
   */
  videoMuxOnly?: boolean;
  muxKind?: 'post' | 'review' | 'review_update';
  /** Composer publishing flow: real byte progress and cancel-safe video handoff. */
  truthfulVideoProgress?: boolean;
  /**
   * Posts composer only (with truthfulVideoProgress): called right after a
   * video passes checks with the composer item for this upload attempt, so
   * the tile and local preview appear before the upload finishes. The final
   * item later arrives via onMediaUploaded carrying the same clientKey and
   * uploadAttemptId; callers must merge it into that exact item.
   */
  onVideoStarted?: (item: MediaItem, file: File) => void;
}

/** Fast local width/height read for the placeholder tile (bounded). */
function readVideoDims(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    let done = false;
    let url = '';
    const finish = (v: { width?: number; height?: number }) => {
      if (done) return;
      done = true;
      if (url) { try { URL.revokeObjectURL(url); } catch { /* ignore */ } }
      resolve(v);
    };
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.onloadedmetadata = () => finish({ width: video.videoWidth || undefined, height: video.videoHeight || undefined });
      video.onerror = () => finish({});
      url = URL.createObjectURL(file);
      video.src = url;
    } catch { finish({}); }
    setTimeout(() => finish({}), 1500);
  });
}

/**
 * Renders a single in-flight upload row. Exported so callers using
 * `renderUploadsInline={false}` can render the rows themselves above
 * the composer toolbar.
 */
export function UploadRow({
  upload,
  onCancel,
  truthfulVideoProgress = false,
}: {
  upload: MediaUploadState;
  onCancel: (upload: MediaUploadState) => void;
  truthfulVideoProgress?: boolean;
}) {
  const isVideo = upload.file.type.startsWith('video/');
  const truthful = isVideo && truthfulVideoProgress;
  const serverPoster = upload.item?.thumbnail_url;
  const localPoster = upload.localPosterUrl;
  const rawDuration = upload.item?.duration ?? upload.localDuration;
  const duration = Number.isFinite(rawDuration) ? rawDuration : undefined;
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
    if (truthful || stage !== 'preparing') {
      setPreparingBoost(false);
      return;
    }
    const t = setTimeout(() => setPreparingBoost(true), 10000);
    return () => clearTimeout(t);
  }, [stage, truthful]);

  useEffect(() => {
    if (truthful || isError) return; // Byte progress is reported by the uploader, never animated.
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
  }, [stage, preparingBoost, isError, truthful]);

  const stageLabel = isError
    ? 'Upload failed'
    : stage === 'preparing'
    ? 'Preparing…'
    : stage === 'uploading'
    ? isVideo
      ? truthful ? `Uploading ${Math.round(Math.max(0, Math.min(100, upload.progress)))}%` : 'Uploading video…'
      : 'Uploading…'
    : stage === 'finalizing'
    ? truthful ? 'Finishing upload…' : 'Finalizing…'
    : '';

  const showShimmer = !isError && stage !== 'done' && (!truthful || stage !== 'uploading');
  const progressWidth = truthful ? stage === 'uploading' ? Math.max(0, Math.min(100, upload.progress)) : stage === 'done' ? 100 : 0 : display;

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
        {upload.durationUnknown ? (
          <p className="text-[11px] mt-1 leading-none text-muted-foreground" data-testid="duration-unknown-note">
            Length will be checked after upload
          </p>
        ) : null}
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
            style={{ width: `${progressWidth}%` }}
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
          <div className="flex items-center gap-1">
            <span className="text-destructive text-sm" aria-label="Upload failed">
              ✗
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onCancel(upload)}
              aria-label="Remove failed upload"
            >
              <X size={14} />
            </Button>
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
  onLatePoster,
  initialMedia = [],
  className,
  customButton,
  maxMediaCount = 4,
  disabled = false,
  renderUploadsInline = true,
  onUploadsChange,
  reserveSlots,
  releaseSlot,
  allowVideo = true,
  videoRefusedMessage,
  videoMuxOnly = false,
  muxKind,
  truthfulVideoProgress = false,
  onVideoStarted,
}: MediaUploaderProps) {
  const cancelledFilesRef = useRef<WeakSet<File>>(new WeakSet());
  const abortControllersRef = useRef<Map<File, AbortController>>(new Map());
  useEffect(() => () => { abortControllersRef.current.forEach((c) => c.abort()); abortControllersRef.current.clear(); }, []);
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

  const acceptTypes = (allowVideo ? ALLOWED_MEDIA_TYPES : ALLOWED_IMAGE_TYPES).join(',');

  const handleFileSelect = async (input: FileList | File[] | null) => {
    if (!input || !user || disabled) return;
    let files: File[] = Array.from(input);
    if (!allowVideo) {
      const photos = files.filter((f) => !f.type.startsWith('video/'));
      if (photos.length < files.length) {
        toast({
          title: 'Photos only',
          description: videoRefusedMessage ?? 'Videos can\'t be added here yet. Please add photos instead.',
          variant: 'destructive',
        });
      }
      files = photos;
      if (files.length === 0) return;
    }

    const remainingSlots = maxMediaCount - currentMediaCount;

    if (remainingSlots <= 0) {
      toast({
        title: 'Media limit reached',
        description: `You can only add up to ${maxMediaCount} media items to one experience`,
        variant: 'destructive',
      });
      return;
    }

    const picked = files.length;
    let filesToProcess = files.slice(0, remainingSlots);
    if (reserveSlots) {
      const granted = reserveSlots(filesToProcess.length);
      if (granted <= 0) {
        toast({
          title: 'Media limit reached',
          description: `You can only add up to ${maxMediaCount} media items to one experience`,
          variant: 'destructive',
        });
        return;
      }
      // Compare with what was picked, not the already-trimmed list.
      if (granted < picked) {
        toast({
          title: 'Too many files selected',
          description: `Only the first ${granted} files will be processed.`,
        });
      }
      filesToProcess = filesToProcess.slice(0, granted);
    }
    const released = new Set<File>();
    const release = (f: File) => {
      if (!releaseSlot || released.has(f)) return;
      released.add(f);
      releaseSlot();
    };

    if (!reserveSlots && files.length > remainingSlots) {
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
        release(file);
        continue;
      }

      const { valid, error, durationUnknown } = await validateMediaFile(file, { unknownDurationAllowed: videoMuxOnly });
      if (!valid) {
        toast({ title: 'Invalid file', description: error, variant: 'destructive' });
        release(file);
        continue;
      }

      if (isVideo) {
        pendingVideoCount += 1;
      }

      const placeholder = truthfulVideoProgress && !videoMuxOnly && isVideo && !!onVideoStarted;
      const clientKey = placeholder ? crypto.randomUUID() : undefined;
      const attemptId = placeholder ? crypto.randomUUID() : undefined;
      const newUpload: MediaUploadState = {
        file,
        clientKey,
        attemptId,
        progress: 0,
        status: 'uploading',
        stage: 'preparing',
        compatibility: isVideo ? 'checking' : undefined,
        durationUnknown: isVideo && durationUnknown ? true : undefined,
      };
      setUploads((prev) => [...prev, newUpload]);

      if (placeholder && clientKey && attemptId) {
        const dims = await readVideoDims(file);
        const orientation = dims.width && dims.height
          ? (dims.width === dims.height ? 'square' : dims.width > dims.height ? 'landscape' : 'portrait')
          : undefined;
        onVideoStarted!({
          url: '', type: 'video', caption: '', alt: file.name.split('.')[0], order: 0,
          session_id: sessionId, provider: 'mux', mux_status: 'preparing',
          clientKey, uploadAttemptId: attemptId,
          ...(dims.width && dims.height ? { width: dims.width, height: dims.height, orientation } : {}),
        } as MediaItem, file);
      }

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

      const controller = truthfulVideoProgress && !videoMuxOnly && isVideo ? new AbortController() : undefined;
      if (controller) abortControllersRef.current.set(file, controller);
      const postOpts = controller ? { signal: controller.signal, onLatePoster } : undefined;
      uploadMedia(file, user.id, sessionId, (progress, stage) => {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, progress, ...(stage ? { stage } : {}) }
              : u
          )
        );
      }, videoMuxOnly ? { videoMuxOnly: true, muxKind } : postOpts).then((mediaItem) => {
        abortControllersRef.current.delete(file);
        if ((videoMuxOnly || truthfulVideoProgress) && cancelledFilesRef.current.has(file)) {
          // Cancelled while transferring: never added; slot released once.
          // Only the preview image is removed; the Mux video itself is kept.
          if (mediaItem?.url) void deleteMedia(mediaItem.url).catch(() => undefined);
          release(file);
          return;
        }
        if (mediaItem && placeholder) {
          // Same composer item as the placeholder; the slot was already taken
          // by it (counted via initialMedia), so never count it again.
          onMediaUploaded({ ...mediaItem, clientKey, uploadAttemptId: attemptId }, file);
          release(file);
          setUploads((prev) => {
            const target = prev.find((u) => u.file === file);
            if (target?.localPosterUrl) revokePoster(target.localPosterUrl);
            return prev.filter((u) => u.file !== file);
          });
        } else if (mediaItem) {
          onMediaUploaded(mediaItem, file);
          release(file);
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
          release(file);
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file ? { ...u, status: 'error', error: 'Upload failed' } : u
            )
          );
        }
      }, () => {
        release(file);
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: 'error', error: 'Upload failed' } : u
          )
        );
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
    if ((videoMuxOnly || truthfulVideoProgress) && uploadToCancel.status === 'uploading') cancelledFilesRef.current.add(uploadToCancel.file);
    abortControllersRef.current.get(uploadToCancel.file)?.abort();
    revokePoster(uploadToCancel.localPosterUrl);
    // Match by file: the caller may hold an older snapshot of this row.
    setUploads((prev) => prev.filter((u) => u.file !== uploadToCancel.file));
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
            input.accept = acceptTypes;
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
              <UploadRow key={index} upload={upload} onCancel={cancelUpload} truthfulVideoProgress={truthfulVideoProgress} />
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
          input.accept = acceptTypes;
          input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
          input.click();
        }}
      >
        <div className="flex flex-col items-center space-y-2">
          <div className="p-3 bg-primary/10 rounded-full">
            <Upload size={24} className="text-primary" />
          </div>
          <div>
            <p className="font-medium">
              {allowVideo ? 'Add photos or a short video to your experience' : 'Add photos'}
            </p>
            <p className="text-sm text-muted-foreground">
              {allowVideo
                ? 'Images up to 10 MB · 1 video up to 100 MB, 60 seconds (MP4, MOV, WebM)'
                : 'Images up to 10 MB (JPG, PNG, GIF, WebP)'}
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
            <UploadRow key={index} upload={upload} onCancel={cancelUpload} truthfulVideoProgress={truthfulVideoProgress} />
          ))}
        </div>
      )}
    </div>
  );
}
