/**
 * Feed → lightbox handoff seek decision (pure).
 *
 * "Check repeatedly, seek once":
 *  - target already reached (any timestamp, incl. nonzero) → complete now,
 *    never wait for a `seeked` that a no-op seek will not fire;
 *  - seek already issued → wait for `seeked` / reached check;
 *  - target inside a `seekable` range → issue the seek (once);
 *  - otherwise wait for the next readiness event and re-check.
 * Duration only clamps when finite; Infinity/NaN never blocks seeking.
 */
export const HANDOFF_SEEK_EPSILON = 0.05;
export const HANDOFF_REACHED_TOLERANCE = 0.25;

export interface SeekableLike {
  length: number;
  start(i: number): number;
  end(i: number): number;
}

export function handoffTarget(requested: number, duration: number): number {
  const t = Math.max(0, Number.isFinite(requested) ? requested : 0);
  if (Number.isFinite(duration) && duration > 0) return Math.min(t, Math.max(0, duration - 0.5));
  return t;
}

export function isTimeSeekable(ranges: SeekableLike | null | undefined, t: number): boolean {
  if (!ranges) return false;
  for (let i = 0; i < ranges.length; i++) {
    if (t >= ranges.start(i) - HANDOFF_SEEK_EPSILON && t <= ranges.end(i) + HANDOFF_SEEK_EPSILON) return true;
  }
  return false;
}

export type HandoffSeekAction = 'complete' | 'seek' | 'wait';

export function decideHandoffSeek(input: {
  currentTime: number;
  target: number;
  seekable: SeekableLike | null | undefined;
  seekIssued: boolean;
}): HandoffSeekAction {
  const { currentTime, target, seekable, seekIssued } = input;
  if (Math.abs(currentTime - target) < HANDOFF_SEEK_EPSILON) return 'complete';
  if (seekIssued) {
    return Math.abs(currentTime - target) <= HANDOFF_REACHED_TOLERANCE ? 'complete' : 'wait';
  }
  return isTimeSeekable(seekable, target) ? 'seek' : 'wait';
}
