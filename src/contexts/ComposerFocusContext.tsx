import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Tracks which composer *regions* currently hold focus, so surfaces like the
 * mobile bottom navigation can step out of the way while the user is writing.
 *
 * Important semantics:
 * - This is an "active source" Set, NOT a reference counter. `activate(id)` is
 *   idempotent and a single `deactivate(id)` removes that source entirely.
 *   Region ids must therefore be unique per mounted composer instance.
 * - The provider knows nothing about auth or viewport width. Callers gate with
 *   the hook's `enabled` option; consumers decide their own visibility rules.
 */
interface ComposerFocusContextValue {
  isComposerActive: boolean;
  activeIds: Set<string>;
  activate: (id: string) => void;
  deactivate: (id: string) => void;
}

const EMPTY_IDS: Set<string> = new Set();

const ComposerFocusContext = createContext<ComposerFocusContextValue>({
  isComposerActive: false,
  activeIds: EMPTY_IDS,
  activate: () => {},
  deactivate: () => {},
});

export const ComposerFocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set());
  const location = useLocation();

  const activate = useCallback((id: string) => {
    setActiveIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const deactivate = useCallback((id: string) => {
    setActiveIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Defensive reset: navigation must never leave a surface hidden.
  useEffect(() => {
    setActiveIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, [location.pathname]);

  const value = useMemo<ComposerFocusContextValue>(
    () => ({ isComposerActive: activeIds.size > 0, activeIds, activate, deactivate }),
    [activeIds, activate, deactivate]
  );

  return <ComposerFocusContext.Provider value={value}>{children}</ComposerFocusContext.Provider>;
};

export const useComposerFocus = () => useContext(ComposerFocusContext);

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'TEXTAREA' ||
    tag === 'INPUT' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'textbox'
  );
};

export interface ComposerFocusRegionProps {
  ref: React.RefObject<HTMLDivElement>;
  onFocusCapture: React.FocusEventHandler<HTMLDivElement>;
  onBlurCapture: React.FocusEventHandler<HTMLDivElement>;
}

/**
 * DOM props plus this region's own activity flag. `isActive` is NOT a DOM prop,
 * so consumers must destructure it out before spreading onto an element.
 */
export interface ComposerFocusRegion extends ComposerFocusRegionProps {
  isActive: boolean;
}

/**
 * Returns props for a composer *container*. Focus moving between the textarea,
 * the send button, or any other control inside the container keeps the region
 * active — only focus leaving the container releases it.
 */
export const useComposerFocusRegion = (
  id: string,
  options?: { enabled?: boolean }
): ComposerFocusRegion => {
  const enabled = options?.enabled !== false;
  const { activate, deactivate, activeIds } = useComposerFocus();
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Release on unmount, or whenever the id changes (reply/edit targets change).
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      deactivate(id);
    };
  }, [id, deactivate]);

  // Release immediately if the region becomes disabled while active.
  useEffect(() => {
    if (!enabled) deactivate(id);
  }, [enabled, id, deactivate]);

  const onFocusCapture = useCallback<React.FocusEventHandler<HTMLDivElement>>(
    (event) => {
      if (!enabled) return;
      if (!isEditableTarget(event.target)) return;
      activate(id);
    },
    [enabled, id, activate]
  );

  const onBlurCapture = useCallback<React.FocusEventHandler<HTMLDivElement>>(() => {
    if (!enabled) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const container = containerRef.current;
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      if (container && active && container.contains(active)) return;
      deactivate(id);
    });
  }, [enabled, id, deactivate]);

  return { ref: containerRef, onFocusCapture, onBlurCapture };
};
