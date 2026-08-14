import type { KeyboardStatus } from '@/utils/viewportKeyboard';

/**
 * Adaptive correction for the docked comment composer.
 *
 * iOS does not treat `position: fixed` consistently across keyboard-dismissal
 * paths: after dismissing with the keyboard's own key, a re-focus lands the
 * docked shell flush above the keyboard; after dismissing by tapping the page,
 * the same shell can stay anchored behind it. So we never add the keyboard
 * height blindly — we measure whether the shell actually overhangs the visual
 * viewport and lift it by exactly that much.
 *
 * The measured rect already reflects the currently applied lift, so
 * `currentCorrection` is added back before comparing. That makes the
 * calculation a fixed point: once correct, re-running returns the same number
 * instead of oscillating.
 */

/** Sub-pixel rect noise below which no correction is applied. */
export const DOCK_CORRECTION_TOLERANCE_PX = 2;

const SCALE_EPSILON = 1.01;

export type DockCorrectionResult =
  /** This frame tells us nothing — keep whatever correction is applied. */
  | { kind: 'skip' }
  | { kind: 'correction'; px: number };

export interface DockCorrectionInput {
  /** `getBoundingClientRect().bottom` of the docked shell, with the lift applied. */
  shellBottom: number;
  visualOffsetTop: number;
  visualHeight: number;
  scale: number;
  /** Lift currently applied to the shell, in px. */
  currentCorrection: number;
  /** Trustworthy viewport shrink; the correction can never exceed it. */
  shrinkPx: number;
  keyboardStatus: KeyboardStatus;
}

export function nextDockCorrection(input: DockCorrectionInput): DockCorrectionResult {
  const {
    shellBottom,
    visualOffsetTop,
    visualHeight,
    scale,
    currentCorrection,
    shrinkPx,
    keyboardStatus,
  } = input;

  if (keyboardStatus !== 'open') return { kind: 'skip' };
  if (
    !Number.isFinite(shellBottom) ||
    !Number.isFinite(visualOffsetTop) ||
    !Number.isFinite(visualHeight) ||
    !Number.isFinite(scale) ||
    !Number.isFinite(currentCorrection) ||
    !Number.isFinite(shrinkPx)
  ) {
    return { kind: 'skip' };
  }
  if (visualHeight <= 0) return { kind: 'skip' };
  if (scale > SCALE_EPSILON) return { kind: 'skip' };

  const visualBottom = visualOffsetTop + visualHeight;
  const uncorrectedBottom = shellBottom + currentCorrection;
  const overhang = uncorrectedBottom - visualBottom;

  if (overhang <= DOCK_CORRECTION_TOLERANCE_PX) return { kind: 'correction', px: 0 };

  const maxCorrection = Math.max(0, shrinkPx);
  return { kind: 'correction', px: Math.round(Math.min(overhang, maxCorrection)) };
}
