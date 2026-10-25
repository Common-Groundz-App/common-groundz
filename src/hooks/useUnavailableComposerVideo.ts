import { useRef, useState } from 'react';
import type { MediaItem } from '@/types/media';
import { isMuxVideoUnavailable, MUX_UNAVAILABLE_COPY, MUX_UNAVAILABLE_TITLE, rejectedMuxUploadIds } from '@/utils/muxVideoUnavailable';
import { useToast } from '@/hooks/use-toast';

/** UI-only rejection state keyed by upload, independent of draft/player state. */
export function useUnavailableComposerVideo(media: readonly MediaItem[]) {
  const [rejected, setRejected] = useState<ReadonlySet<string>>(new Set());
  const rejectedRef = useRef(rejected);
  const { toast } = useToast();
  const isUnavailable = (item: MediaItem) => !!item.mux_upload_id && rejectedRef.current.has(item.mux_upload_id);
  const blocked = media.some(isUnavailable);
  const handleError = (error: unknown, submittedMedia: readonly MediaItem[] = media) => {
    if (!isMuxVideoUnavailable(error)) return false;
    const next = new Set(rejectedRef.current);
    rejectedMuxUploadIds(submittedMedia).forEach((id) => next.add(id));
    rejectedRef.current = next;
    setRejected(next);
    toast({ title: MUX_UNAVAILABLE_TITLE, description: MUX_UNAVAILABLE_COPY, variant: 'destructive' });
    return true;
  };
  return { blocked, isUnavailable, handleError };
}

export function scrollToUnavailableMedia() {
  requestAnimationFrame(() => {
    const section = document.getElementById('composer-section-media');
    if (!section) return;
    if (window.matchMedia('(max-width: 767px)').matches) {
      const rect = section.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        section.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
    section.focus({ preventScroll: true });
  });
}