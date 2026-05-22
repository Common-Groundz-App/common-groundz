import type { MediaItem } from '@/types/media';
import {
  isMuxErroredOrBroken,
  isMuxPreparing,
  isMuxPlayable,
} from '@/utils/muxMedia';

/**
 * Locked render-branch decision for video MediaItems.
 *
 * Order is CRITICAL and asserted by renderBranching.test.ts:
 *   1. errored-or-broken → 'errored-poster'
 *   2. preparing         → 'preparing-poster'
 *   3. mux + playable    → 'mux-hls'
 *   4. anything else     → 'legacy-video'
 *
 * Reorder this at your peril — `mux_status === 'errored'` would otherwise
 * be matched by a loosened "not ready" check and play nothing.
 */
export type RenderBranch =
  | 'errored-poster'
  | 'preparing-poster'
  | 'mux-hls'
  | 'legacy-video';

export function pickRenderBranch(item: MediaItem): RenderBranch {
  if (isMuxErroredOrBroken(item)) return 'errored-poster';
  if (isMuxPreparing(item)) return 'preparing-poster';
  if (isMuxPlayable(item)) return 'mux-hls';
  return 'legacy-video';
}
