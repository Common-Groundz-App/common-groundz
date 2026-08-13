import { useEffect, useRef, useState } from 'react';
import {
  createKeyboardState,
  reduceKeyboardState,
  type KeyboardState,
  type KeyboardStatus,
  type ViewportOrientation,
} from '@/utils/viewportKeyboard';

export interface SoftwareKeyboardResult {
  status: KeyboardStatus;
  /** Derived from `status` — never set independently. */
  open: boolean;
}

/**
 * Thin subscriber around the pure `viewportKeyboard` state machine.
 *
 * Observation never depends on `editableActive` — only *baseline mutation*
 * does, which the reducer owns. Activity is read from a ref inside the
 * coalesced frame so a queued frame can never apply a stale value.
 */
export const useSoftwareKeyboardOpen = ({
  editableActive,
}: {
  editableActive: boolean;
}): SoftwareKeyboardResult => {
  const [status, setStatus] = useState<KeyboardStatus>('unknown');
  const activeRef = useRef(editableActive);
  activeRef.current = editableActive;

  const stateRef = useRef<KeyboardState>(createKeyboardState());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) {
      setStatus('unknown');
      return;
    }

    let mounted = true;
    let frame: number | null = null;

    const portraitQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(orientation: portrait)')
        : null;

    const readOrientation = (): ViewportOrientation => {
      if (portraitQuery) return portraitQuery.matches ? 'portrait' : 'landscape';
      const type = window.screen?.orientation?.type;
      if (typeof type === 'string') {
        return type.startsWith('landscape') ? 'landscape' : 'portrait';
      }
      return 'portrait';
    };

    const sampleNow = () => {
      if (!mounted) return;
      const result = reduceKeyboardState(stateRef.current, {
        visualHeight: Math.round(vv.height),
        visualWidth: Math.round(vv.width),
        scale: vv.scale ?? 1,
        orientation: readOrientation(),
        editableActive: activeRef.current,
      });
      stateRef.current = result.state;
      setOpen((prev) => (prev === result.keyboardOpen ? prev : result.keyboardOpen));
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        sampleNow();
      });
    };

    // Synchronous initial sample so the first render after focus is correct.
    sampleNow();

    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    portraitQuery?.addEventListener?.('change', schedule);

    return () => {
      mounted = false;
      if (frame !== null) window.cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      portraitQuery?.removeEventListener?.('change', schedule);
    };
    // `editableActive` intentionally re-runs the effect: it forces an immediate
    // re-sample when activity flips, without changing what we subscribe to.
  }, [editableActive]);

  return open;
};
