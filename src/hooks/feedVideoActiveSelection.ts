/**
 * Pure active-slot (playback) selection for FeedVideoManager.
 *
 * Primary rule: a slot at >= ACTIVATE (0.60 effective visibility) can
 * become active. If nothing reaches it, exactly ONE dominant fallback slot
 * at >= FALLBACK (0.35) is chosen (most visible, then closest to centre).
 * Applies at every feed position and viewport size.
 *
 * Precedence with the current active slot (kept while >= KEEP):
 *   - a 60%+ challenger always replaces a current that is below 60%;
 *   - otherwise a challenger must beat the current by SWITCH_MARGIN.
 */

export const ACTIVE_ACTIVATE_THRESHOLD = 0.6;
export const ACTIVE_FALLBACK_THRESHOLD = 0.35;
export const ACTIVE_KEEP_THRESHOLD = 0.35;
export const ACTIVE_SWITCH_MARGIN = 0.2;

export interface ActiveCandidate {
  id: string;
  effective: number;
  centerDist: number;
}

export interface ActiveSelection {
  id: string | null;
  fallback: boolean;
}

export function selectActiveSlot(
  slots: readonly ActiveCandidate[],
  currentId: string | null,
): ActiveSelection {
  let best: ActiveCandidate | null = null;
  for (const s of slots) {
    if (
      !best ||
      s.effective > best.effective ||
      (s.effective === best.effective && s.centerDist < best.centerDist)
    ) {
      best = s;
    }
  }
  const cur = currentId ? slots.find((s) => s.id === currentId) ?? null : null;

  if (cur && cur.effective >= ACTIVE_KEEP_THRESHOLD) {
    if (best && best.id !== cur.id) {
      const challengerPrimary = best.effective >= ACTIVE_ACTIVATE_THRESHOLD;
      const curPrimary = cur.effective >= ACTIVE_ACTIVATE_THRESHOLD;
      if (challengerPrimary && !curPrimary) {
        return { id: best.id, fallback: false };
      }
      if (
        best.effective >= ACTIVE_FALLBACK_THRESHOLD &&
        best.effective - cur.effective >= ACTIVE_SWITCH_MARGIN
      ) {
        return { id: best.id, fallback: !challengerPrimary };
      }
    }
    return { id: cur.id, fallback: cur.effective < ACTIVE_ACTIVATE_THRESHOLD };
  }

  if (best && best.effective >= ACTIVE_ACTIVATE_THRESHOLD) return { id: best.id, fallback: false };
  if (best && best.effective >= ACTIVE_FALLBACK_THRESHOLD) return { id: best.id, fallback: true };
  return { id: null, fallback: false };
}

/** Dev / opt-in (?feedvideodebug=1) diagnostics. Never logs URLs. */
export const FEED_VIDEO_DEBUG: boolean = (() => {
  try {
    if (import.meta.env.DEV) return true;
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('feedvideodebug') === '1';
  } catch {
    return false;
  }
})();

export function feedVideoDebug(event: string, props: Record<string, unknown>): void {
  if (!FEED_VIDEO_DEBUG) return;
  try { console.debug('[feed-video-mobile]', event, props); } catch { /* ignore */ }
}
