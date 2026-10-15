import type { MediaItem } from '@/types/media';

/**
 * Post-only display order: the (single) video is promoted to the first slot,
 * everything else keeps its saved relative order. Returns a NEW array and
 * never mutates or re-numbers the saved items — `order` and `id` are left
 * untouched, so this is presentation-only. The feed collage and the lightbox
 * must both receive this same array so positions (1/2, 2/2) agree.
 *
 * Not used by Review/Timeline media, which keep their own ordering.
 */
export function getPostDisplayMedia(media: readonly MediaItem[]): MediaItem[] {
  const list = [...media];
  if (list.length < 2) return list;
  const firstVideoIdx = list.findIndex((m) => m.type === 'video');
  if (firstVideoIdx > 0) {
    const [v] = list.splice(firstVideoIdx, 1);
    list.unshift(v);
  }
  return list;
}
