import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { nextDockCorrection } from '@/utils/dockCorrection';
import type { KeyboardStatus, ViewportOrientation } from '@/utils/viewportKeyboard';

export interface UseDockCorrectionOptions {
  /** True only while the composer is actually docked. */
  enabled: boolean;
  keyboardStatus: KeyboardStatus;
  shrinkPx: number;
  orientation: ViewportOrientation;
  shellRef: React.RefObject<HTMLElement | null>;
}

/**
 * Measures whether the docked composer overhangs the visual viewport and
 * returns the upward lift (px) needed to make it flush. Returns 0 when the
 * browser already anchored it correctly, so the working dismissal path is
 * untouched.
 *
 * Measures synchronously on the dock transition (the viewport events that
 * opened the keyboard have already fired by then) plus one follow-up frame for
 * late-published iOS geometry, then tracks viewport events.
 */
export const useDockCorrection = ({
  enabled,
  keyboardStatus,
  shrinkPx,
  orientation,
  shellRef,
}: UseDockCorrectionOptions): number => {
  const [correction, setCorrection] = useState(0);
  const correctionRef = useRef(0);

  // Read inside the frame so a queued sample never uses stale inputs.
  const statusRef = useRef(keyboardStatus);
  statusRef.current = keyboardStatus;
  const shrinkRef = useRef(shrinkPx);
  shrinkRef.current = shrinkPx;

  const reset = useCallback(() => {
    correctionRef.current = 0;
    setCorrection((prev) => (prev === 0 ? prev : 0));
  }, []);

  const sample = useCallback(() => {
    const node = shellRef.current;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!node || !vv) return;

    const result = nextDockCorrection({
      shellBottom: node.getBoundingClientRect().bottom,
      visualOffsetTop: vv.offsetTop,
      visualHeight: vv.height,
      scale: vv.scale ?? 1,
      currentCorrection: correctionRef.current,
      shrinkPx: shrinkRef.current,
      keyboardStatus: statusRef.current,
    });
    if (result.kind === 'skip') return;

    // Ref first: a rapid follow-up sample must compensate with this value.
    correctionRef.current = result.px;
    setCorrection((prev) => (prev === result.px ? prev : result.px));
  }, [shellRef]);

  // Synchronous first measurement, before paint, on the dock transition.
  useLayoutEffect(() => {
    if (!enabled) {
      reset();
      return;
    }
    sample();
  }, [enabled, orientation, reset, sample]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        sample();
      });
    };

    // One follow-up frame for geometry iOS publishes a tick late.
    schedule();

    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, [enabled, orientation, sample]);

  // Unmount safety: never leave a stale lift behind.
  useEffect(() => () => { correctionRef.current = 0; }, []);

  return enabled ? correction : 0;
};
