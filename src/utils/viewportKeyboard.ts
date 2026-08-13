/**
 * Pure classifier for "is a software keyboard covering the viewport?".
 *
 * Deliberate design constraints (see the approved plan):
 * - Decision is **height only**. `visualViewport.offsetTop` is never an input:
 *   its coordinate meaning shifts with browser chrome, scroll and zoom.
 * - Orientation is supplied by the caller as an opaque label and is *never*
 *   derived from the sampled dimensions. A tall keyboard can turn a 390x700
 *   portrait visual viewport into 390x300, which would read as "landscape" and
 *   wrongly invalidate the baseline at the exact moment the keyboard opens.
 * - The baseline only ever moves while no composer is active, so a
 *   keyboard-obscured frame can never be recorded as the unobscured height.
 */

export type ViewportOrientation = 'portrait' | 'landscape';

export interface KeyboardViewportSample {
  visualHeight: number;
  visualWidth: number;
  scale: number;
  /** Supplied by the caller (media query), never derived from the dimensions. */
  orientation: ViewportOrientation;
  /** True while a composer region holds focus. */
  editableActive: boolean;
}

export interface KeyboardState {
  /** Greatest height observed in frames judged unobscured, or null if unknown. */
  baseline: number | null;
  /** Orientation label the baseline was captured in. */
  baselineOrientation: ViewportOrientation | null;
  /** Diagnostics only — width never invalidates the baseline. */
  lastWidth: number | null;
}

/**
 * Tri-state so callers can distinguish "the keyboard genuinely closed" from
 * "this sample tells us nothing" (zoom, rotation, no baseline, inactive).
 */
export type KeyboardStatus = 'open' | 'closed' | 'unknown';

export interface KeyboardReduceResult {
  state: KeyboardState;
  keyboardStatus: KeyboardStatus;
  /** Derived from `keyboardStatus` so the two can never disagree. */
  keyboardOpen: boolean;
}

/** Pinch-zoom tolerance: anything above this is treated as user zoom. */
const SCALE_EPSILON = 1.01;

/** A keyboard is at least this tall; below it we assume browser chrome/toolbars. */
const MIN_SHRINK_PX = 120;
const SHRINK_RATIO = 0.15;

export const createKeyboardState = (): KeyboardState => ({
  baseline: null,
  baselineOrientation: null,
  lastWidth: null,
});

export const keyboardShrinkThreshold = (baseline: number): number =>
  Math.max(MIN_SHRINK_PX, baseline * SHRINK_RATIO);

export const reduceKeyboardState = (
  state: KeyboardState,
  sample: KeyboardViewportSample
): KeyboardReduceResult => {
  const { visualHeight, visualWidth, scale, orientation, editableActive } = sample;

  let baseline = state.baseline;
  let baselineOrientation = state.baselineOrientation;

  // Independently confirmed rotation invalidates the baseline. Width jitter and
  // aspect-ratio changes do not — only this explicit label.
  if (baselineOrientation !== null && baselineOrientation !== orientation) {
    baseline = null;
    baselineOrientation = null;
  }

  const zoomed = scale > SCALE_EPSILON;
  const validHeight = Number.isFinite(visualHeight) && visualHeight > 0;

  if (!editableActive) {
    // Trustworthy frame: establish or raise the baseline for this orientation.
    if (!zoomed && validHeight) {
      baseline = baseline === null ? visualHeight : Math.max(baseline, visualHeight);
      baselineOrientation = orientation;
    }
    // No active composer: this sample says nothing about the keyboard. Never
    // `closed`, so an ordinary blur can't fabricate an open -> closed edge.
    return {
      state: { baseline, baselineOrientation, lastWidth: visualWidth },
      keyboardStatus: 'unknown',
      keyboardOpen: false,
    };
  }

  // Composer active: the baseline is frozen. Classify only.
  let keyboardStatus: KeyboardStatus = 'unknown';
  if (!zoomed && validHeight && baseline !== null) {
    keyboardStatus =
      baseline - visualHeight > keyboardShrinkThreshold(baseline) ? 'open' : 'closed';
  }

  return {
    state: { baseline, baselineOrientation, lastWidth: visualWidth },
    keyboardStatus,
    keyboardOpen: keyboardStatus === 'open',
  };
};
