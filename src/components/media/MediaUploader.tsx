import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Film, Upload, X } from 'lucide-react';
import {
  uploadMedia,
  ALLOWED_MEDIA_TYPES,
  validateMediaFile,
  MAX_VIDEOS_PER_POST,
} from '@/services/mediaService';
import { formatDuration, formatBytes } from '@/utils/videoPoster';
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
}

export function MediaUploader({
  sessionId,
  onMediaUploaded,
  initialMedia = [],
  className,
  customButton,
  maxMediaCount = 4,
  disabled = false,
}: MediaUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploads, setUploads] = useState<MediaUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [currentMediaCount, setCurrentMediaCount] = useState(initialMedia.length);
  const [currentVideoCount, setCurrentVideoCount] = useState(
    initialMedia.filter((m) => m.type === 'video').length
  );

  useEffect(() => {
    setCurrentMediaCount(initialMedia.length);
    setCurrentVideoCount(initialMedia.filter((m) => m.type === 'video').length);
  }, [initialMedia]);

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
    let pendingVideoCount = currentVideoCount + uploads.filter((u) => u.file.type.startsWith('video/')).length;

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
      }

      uploadMedia(file, user.id, sessionId, (progress) => {
        setUploads((prev) =>
          prev.map((u) => (u.file === file ? { ...u, progress } : u))
        );
      }).then((mediaItem) => {
        if (mediaItem) {
          setUploads((prev) =>
            prev.map((u) => (u.file === file ? { ...u, status: 'success', item: mediaItem } : u))
          );
          onMediaUploaded(mediaItem);
          setCurrentMediaCount((prev) => prev + 1);
          if (mediaItem.type === 'video') setCurrentVideoCount((prev) => prev + 1);

          setTimeout(() => {
            setUploads((prev) => prev.filter((u) => u.file !== file));
          }, 2000);
        } else {
          setUploads((prev) =>
            prev.map((u) => (u.file === file ? { ...u, status: 'error', error: 'Upload failed' } : u))
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
    setUploads((prev) => prev.filter((u) => u !== uploadToCancel));
  };

  const renderUploadRow = (upload: MediaUploadState, index: number) => {
    const isVideo = upload.file.type.startsWith('video/');
    const posterReady = !!upload.item?.thumbnail_url;

    return (
      <div key={index} className="flex items-center space-x-2 border rounded-md p-2">
        <div className="flex-shrink-0">
          {isVideo ? (
            <Film size={20} className="text-purple-500" />
          ) : (
            <ImageIcon size={20} className="text-blue-500" />
          )}
        </div>
        {isVideo && (
          <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden">
            {posterReady ? (
              <img
                src={upload.item!.thumbnail_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              // Skeleton while we generate/upload the poster (project standard: skeletons not spinners).
              <Skeleton className="w-full h-full" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{upload.file.name}</p>
          {isVideo && upload.compatibility ? (
            <div className="mt-1">
              <MediaCompatibilityBadge
                state={upload.compatibility}
                note={upload.compatibilityNote}
              />
            </div>
          ) : null}
          <Progress value={upload.progress} className="h-1 mt-1" />
        </div>
        <div className="flex-shrink-0">
          {upload.status === 'success' ? (
            <div className="text-green-500 text-sm">✓</div>
          ) : upload.status === 'error' ? (
            <div className="text-red-500 text-sm">✗</div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => cancelUpload(upload)}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </div>
    );
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
            input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
            input.click();
          }}
        >
          {customButton}
        </div>

        {uploads.length > 0 && (
          <div className="space-y-2 mt-2">{uploads.map(renderUploadRow)}</div>
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
          !disabled && isDragging ? 'border-primary bg-primary/10' : 'border-gray-300',
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

      {uploads.length > 0 && <div className="space-y-2">{uploads.map(renderUploadRow)}</div>}
    </div>
  );
}
