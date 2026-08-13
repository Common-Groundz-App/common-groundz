import { useEffect, useRef } from 'react';
import type { KeyboardStatus } from '@/utils/viewportKeyboard';

const isEditableElement = (node: Element | null): node is HTMLElement => {
  if (!(node instanceof HTMLElement)) return false;
  const tag = node.tagName;
  return (
    tag === 'TEXTAREA' ||
    tag === 'INPUT' ||
    node.isContentEditable ||
    node.getAttribute('role') === 'textbox'
  );
};

export interface BlurComposerOnKeyboardDismissOptions {
  /** Tri-state keyboard classification for the current sample. */
  status: KeyboardStatus;
  /**
   * Identity of the focused editable session (the active composer region id),
   * or `null` when no composer of this thread is active. A change in identity
   * disarms the tracker: `open` recorded for one composer must never blur a
   * different one.
   */
  sessionId: string | null;
  /** Gate (e.g. auth + viewport below the nav breakpoint). */
  enabled: boolean;
  /** Container refs of this thread's composer regions. */
  regionRefs: Array<React.RefObject<HTMLElement | null>>;
}

/**
 * iOS's "hide keyboard" key closes the keyboard without blurring the textarea,
 * so a focus-driven surface (the bottom nav) would stay hidden forever.
 *
 * This fires on a *consecutive, same-session* `open -> closed` transition and
 * simply blurs the focused editable inside one of this thread's regions. The
 * existing region `onBlurCapture` then does the rest, so there is exactly one
 * release path. `unknown` (zoom, rotation, invalid sample, inactive composer)
 * disarms instead of firing.
 */
export const useBlurComposerOnKeyboardDismiss = ({
  status,
  sessionId,
  enabled,
  regionRefs,
}: BlurComposerOnKeyboardDismissOptions): void => {
  const armedSessionRef = useRef<string | null>(null);
  const regionRefsRef = useRef(regionRefs);
  regionRefsRef.current = regionRefs;

  useEffect(() => {
    if (!enabled || !sessionId) {
      armedSessionRef.current = null;
      return;
    }

    if (status === 'unknown') {
      // Not a usable sample — break any pending transition.
      armedSessionRef.current = null;
      return;
    }

    if (status === 'open') {
      armedSessionRef.current = sessionId;
      return;
    }

    // status === 'closed'
    if (armedSessionRef.current !== sessionId) {
      armedSessionRef.current = null;
      return;
    }
    // Disarm before acting so a re-entrant sample can't fire twice.
    armedSessionRef.current = null;

    if (typeof document === 'undefined') return;
    const active = document.activeElement;
    if (!isEditableElement(active)) return;
    const insideThisThread = regionRefsRef.current.some((ref) =>
      ref.current ? ref.current.contains(active) : false
    );
    if (!insideThisThread) return;

    active.blur();
  }, [enabled, sessionId, status]);

  // Release the arm on unmount so a remount starts clean.
  useEffect(() => () => {
    armedSessionRef.current = null;
  }, []);
};
