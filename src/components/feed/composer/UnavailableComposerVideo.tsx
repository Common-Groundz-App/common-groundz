import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaUploader } from '@/components/media/MediaUploader';
import type { MediaItem, MediaUploadState } from '@/types/media';
import { MUX_UNAVAILABLE_COPY, MUX_UNAVAILABLE_TITLE } from '@/utils/muxVideoUnavailable';

interface Props {
  item: MediaItem;
  media: MediaItem[];
  sessionId: string;
  onRemove: () => void;
  onUploaded: (media: MediaItem, file?: File) => void;
  onVideoStarted?: (media: MediaItem, file: File) => void;
  onLatePoster?: React.ComponentProps<typeof MediaUploader>['onLatePoster'];
  onUploadsChange: (uploads: MediaUploadState[], cancel: (upload: MediaUploadState) => void) => void;
  kind?: 'post' | 'review' | 'review_update';
  allowVideo?: boolean;
  disabled?: boolean;
}

/** Replaces only a rejected tile; local preview registries are never changed. */
export function UnavailableComposerVideo(p: Props) {
  return (
    <div role="alert" className="w-full rounded-lg border border-destructive/50 bg-background p-4 text-foreground">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-destructive">{MUX_UNAVAILABLE_TITLE}</p>
          <p className="text-sm">{MUX_UNAVAILABLE_COPY}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <MediaUploader
          sessionId={p.sessionId}
          truthfulVideoProgress
          videoReplacementOnly
          videoMuxOnly={p.kind !== 'post'}
          muxKind={p.kind}
          allowVideo={p.allowVideo}
          disabled={p.disabled || p.allowVideo === false}
          initialMedia={p.media.filter((m) => m.mux_upload_id !== p.item.mux_upload_id)}
          onMediaUploaded={p.onUploaded}
          onVideoStarted={p.onVideoStarted}
          onLatePoster={p.onLatePoster}
          onUploadsChange={p.onUploadsChange}
          customButton={<Button type="button" variant="outline" className="min-h-11 gap-2" disabled={p.disabled || p.allowVideo === false}><RefreshCw className="h-4 w-4" />Replace</Button>}
        />
        <Button type="button" variant="destructive" className="min-h-11 gap-2" onClick={p.onRemove} disabled={p.disabled}><Trash2 className="h-4 w-4" />Remove</Button>
      </div>
    </div>
  );
}