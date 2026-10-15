/**
 * Fix 2 — Feed video loading budget (pure selection logic).
 *
 * Separate from playback: FeedVideoManager still decides which slot is
 * active (plays). This module only decides which managed feed slots may
 * have an HLS source attached at all. Everything is keyed by stable slot
 * id — never by index or DOM order.
 *
 * Priority (hard cap = FEED_VIDEO_LOAD_BUDGET, grace slots count):
 *   1. live handoff pins (feed <-> lightbox)
 *   2. the active (playing) slot
 *   3. grace-retained slots (recently allowed, short retention)
 *   4. speculative preload: nearest eligible slot; scroll direction is a
 *      tie-breaker only.
 * While the lightbox is open only pins (+active, normally null) load.
 */

export const FEED_VIDEO_LOAD_BUDGET = 2;
export const FEED_VIDEO_LOAD_GRACE_MS = 1500;
/** Preload eligibility: within this many viewport heights of the viewport. */
export const FEED_VIDEO_PRELOAD_VIEWPORTS = 1.5;

export interface LoadSlotGeometry {
  id: string;
  /** Pixel gap between slot and viewport; 0 when overlapping. */
  distance: number;
  /** True when the slot lies in the current scroll direction. */
  ahead: boolean;
}

export interface LoadSelectionInput {
  slots: readonly LoadSlotGeometry[];
  activeId: string | null;
  pinned: ReadonlySet<string>;
  prevAllowed: ReadonlySet<string>;
  /** Mutable: id -> grace expiry (ms). Updated in place. */
  graceUntil: Map<string, number>;
  now: number;
  viewportHeight: number;
  lightboxOpen: boolean;
  budget?: number;
}

export function selectFeedVideoLoadSet(input: LoadSelectionInput): Set<string> {
  const budget = input.budget ?? FEED_VIDEO_LOAD_BUDGET;
  const registered = new Set(input.slots.map((s) => s.id));
  const out: string[] = [];
  const add = (id: string) => {
    if (out.length >= budget) return;
    if (!registered.has(id) || out.includes(id)) return;
    out.push(id);
  };

  // 1 + 2 — required.
  [...input.pinned].sort().forEach(add);
  if (input.activeId) add(input.activeId);

  // Drop grace entries for unregistered slots.
  for (const id of [...input.graceUntil.keys()]) {
    if (!registered.has(id)) input.graceUntil.delete(id);
  }

  if (input.lightboxOpen) {
    input.graceUntil.clear();
    return new Set(out);
  }

  // Speculative candidates ordered by distance, then direction, then id.
  const margin = Math.max(0, input.viewportHeight) * FEED_VIDEO_PRELOAD_VIEWPORTS;
  const candidates = input.slots
    .filter((s) => Number.isFinite(s.distance) && s.distance <= margin)
    .slice()
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.ahead !== b.ahead) return a.ahead ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  // Desired set ignoring grace — used to decide who enters grace.
  const desired = new Set(out);
  for (const c of candidates) {
    if (desired.size >= budget) break;
    desired.add(c.id);
  }

  // Previously allowed but no longer desired → start (or keep) grace.
  input.prevAllowed.forEach((id) => {
    if (!registered.has(id)) return;
    if (desired.has(id)) {
      input.graceUntil.delete(id);
    } else if (!input.graceUntil.has(id)) {
      input.graceUntil.set(id, input.now + FEED_VIDEO_LOAD_GRACE_MS);
    }
  });
  desired.forEach((id) => input.graceUntil.delete(id));

  // 3 — grace-retained (counts toward budget).
  [...input.graceUntil.entries()]
    .filter(([, until]) => until > input.now)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id]) => add(id));
  for (const [id, until] of [...input.graceUntil.entries()]) {
    if (until <= input.now || !out.includes(id)) input.graceUntil.delete(id);
  }

  // 4 — speculative preload.
  candidates.forEach((c) => add(c.id));
  return new Set(out);
}

export function nextGraceExpiry(graceUntil: ReadonlyMap<string, number>): number | null {
  let min: number | null = null;
  graceUntil.forEach((t) => { if (min === null || t < min) min = t; });
  return min;
}
