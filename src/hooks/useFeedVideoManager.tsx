import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

/**
 * Phase 1 — Single Active Feed Video Manager (Phase 1.1 stabilization).
 *
 * Responsibility split:
 *   - Manager decides which slot is `activeId` based on visibility.
 *   - FeedVideo (the consumer) actually calls play()/pause() in response
 *     to `isActive`. This avoids dual ownership of playback transitions.
 *
 * Phase 1.1 fix: the provider's context value is STABLE — it never
 * changes when activeId changes. Active state is delivered to each slot
 * via a per-slot useSyncExternalStore subscription. This eliminates the
 * unregister/re-register loop that caused frame-by-frame oscillation.
 *
 * The manager is OPT-IN via <FeedVideoManagerProvider>. Outside a
 * provider, `useFeedVideoSlot` returns `managed: false` and FeedVideo
 * falls back to its legacy `useVideoAutoplay` behavior.
 */

interface SlotEntry {
  el: HTMLVideoElement | null;
  raw: number;        // raw intersection ratio
  effective: number;  // raw / maxPossibleRatio for oversized videos
  centerDist: number; // |elementCenterY - viewportCenterY|
}

type Listener = () => void;

interface RegistryApi {
  setSlotEl: (id: string, el: HTMLVideoElement | null) => void;
  unregisterSlot: (id: string) => void;
  setLightboxOpen: (open: boolean) => void;
  subscribeSlotActive: (id: string, listener: Listener) => () => void;
  getSlotActiveSnapshot: (id: string) => boolean;
}

const Ctx = createContext<RegistryApi | null>(null);
// Sentinel context so nested providers can detect each other (dev-only warn).
const NestingCtx = createContext<boolean>(false);

const ACTIVATE_THRESHOLD = 0.6;
const KEEP_THRESHOLD = 0.35;
const SWITCH_MARGIN = 0.2;
const DEBOUNCE_MS = 200;
const SETTLE_MS = 50;

export function FeedVideoManagerProvider({ children }: { children: React.ReactNode }) {
  const slotsRef = useRef<Map<string, SlotEntry>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const debounceRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lightboxOpenRef = useRef(false);

  // Per-slot subscription: map id -> set of listeners.
  const slotListenersRef = useRef<Map<string, Set<Listener>>>(new Map());
  const activeIdRef = useRef<string | null>(null);

  // Dev-only nested-provider warning.
  const isNested = useContext(NestingCtx);
  useEffect(() => {
    if (isNested && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        '[FeedVideoManager] Nested <FeedVideoManagerProvider> detected. ' +
          'Only one provider should wrap a visible feed area; nested providers ' +
          'can each autoplay their own video.'
      );
    }
  }, [isNested]);

  const notifySlot = useCallback((id: string) => {
    const set = slotListenersRef.current.get(id);
    if (!set) return;
    set.forEach((l) => {
      try { l(); } catch { /* ignore */ }
    });
  }, []);

  const updateActive = useCallback((next: string | null) => {
    const prev = activeIdRef.current;
    if (prev === next) return;
    activeIdRef.current = next;
    // Only the outgoing and incoming slots need to re-evaluate.
    if (prev) notifySlot(prev);
    if (next) notifySlot(next);
  }, [notifySlot]);

  const recompute = useCallback(() => {
    if (typeof window === 'undefined') return;
    const vpH = window.innerHeight || document.documentElement.clientHeight || 0;
    if (vpH <= 0) return;
    const vpCenter = vpH / 2;

    slotsRef.current.forEach((slot) => {
      const el = slot.el;
      if (!el) {
        slot.raw = 0;
        slot.effective = 0;
        slot.centerDist = Infinity;
        return;
      }
      const rect = el.getBoundingClientRect();
      const elH = rect.height;
      if (elH <= 0) {
        slot.raw = 0;
        slot.effective = 0;
        slot.centerDist = Infinity;
        return;
      }
      const visTop = Math.max(0, rect.top);
      const visBot = Math.min(vpH, rect.bottom);
      const visH = Math.max(0, visBot - visTop);
      const raw = visH / elH;
      const maxPossible = Math.min(1, vpH / elH);
      const effective = maxPossible > 0 ? Math.min(1, raw / maxPossible) : 0;
      const elCenter = rect.top + elH / 2;
      slot.raw = raw;
      slot.effective = effective;
      slot.centerDist = Math.abs(elCenter - vpCenter);
    });

    if (lightboxOpenRef.current || (typeof document !== 'undefined' && document.hidden)) {
      updateActive(null);
      return;
    }

    let bestId: string | null = null;
    let bestEff = -1;
    let bestDist = Infinity;
    slotsRef.current.forEach((s, id) => {
      if (
        s.effective > bestEff ||
        (s.effective === bestEff && s.centerDist < bestDist)
      ) {
        bestEff = s.effective;
        bestDist = s.centerDist;
        bestId = id;
      }
    });

    const current = activeIdRef.current;
    if (current && slotsRef.current.has(current)) {
      const cur = slotsRef.current.get(current)!;
      if (cur.effective >= KEEP_THRESHOLD) {
        if (
          bestId &&
          bestId !== current &&
          bestEff >= ACTIVATE_THRESHOLD &&
          bestEff - cur.effective >= SWITCH_MARGIN
        ) {
          updateActive(bestId);
        }
        return;
      }
    }

    if (bestId && bestEff >= ACTIVATE_THRESHOLD) {
      updateActive(bestId);
    } else {
      updateActive(null);
    }
  }, [updateActive]);

  const flushNow = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    recompute();
  }, [recompute]);

  const scheduleRecompute = useCallback(() => {
    if (debounceRef.current !== null) return;
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        recompute();
      });
    }, DEBOUNCE_MS);
  }, [recompute]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      return;
    }
    observerRef.current = new IntersectionObserver(
      () => scheduleRecompute(),
      { threshold: [0, 0.35, 0.6, 1] }
    );
    const onScroll = () => scheduleRecompute();
    const onResize = () => scheduleRecompute();
    const onVisibility = () => {
      if (document.hidden) {
        if (debounceRef.current !== null) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        updateActive(null);
      } else {
        requestAnimationFrame(() => {
          window.setTimeout(() => recompute(), SETTLE_MS);
        });
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    slotsRef.current.forEach((slot) => {
      if (slot.el) observerRef.current?.observe(slot.el);
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      window.removeEventListener('scroll', onScroll, { capture: true } as any);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleRecompute, recompute, updateActive]);

  // ----- Stable registry callbacks. Captured once; never change identity. -----

  const setSlotEl = useCallback((id: string, el: HTMLVideoElement | null) => {
    let slot = slotsRef.current.get(id);
    if (!slot) {
      slot = { el: null, raw: 0, effective: 0, centerDist: Infinity };
      slotsRef.current.set(id, slot);
    }
    if (slot.el === el) return;
    if (slot.el && observerRef.current) {
      try { observerRef.current.unobserve(slot.el); } catch { /* ignore */ }
    }
    slot.el = el;
    if (el && observerRef.current) {
      try { observerRef.current.observe(el); } catch { /* ignore */ }
    }
    scheduleRecompute();
  }, [scheduleRecompute]);

  const unregisterSlot = useCallback((id: string) => {
    const slot = slotsRef.current.get(id);
    if (slot?.el && observerRef.current) {
      try { observerRef.current.unobserve(slot.el); } catch { /* ignore */ }
    }
    slotsRef.current.delete(id);
    if (activeIdRef.current === id) updateActive(null);
    scheduleRecompute();
  }, [scheduleRecompute, updateActive]);

  const setLightboxOpen = useCallback((open: boolean) => {
    lightboxOpenRef.current = open;
    if (open) {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      updateActive(null);
    } else {
      flushNow();
    }
  }, [flushNow, updateActive]);

  const subscribeSlotActive = useCallback((id: string, listener: Listener) => {
    let set = slotListenersRef.current.get(id);
    if (!set) {
      set = new Set();
      slotListenersRef.current.set(id, set);
    }
    set.add(listener);
    return () => {
      const s = slotListenersRef.current.get(id);
      if (!s) return;
      s.delete(listener);
      if (s.size === 0) slotListenersRef.current.delete(id);
    };
  }, []);

  const getSlotActiveSnapshot = useCallback((id: string) => {
    return activeIdRef.current === id;
  }, []);

  // Stable api object — never changes identity.
  const api = useMemo<RegistryApi>(
    () => ({
      setSlotEl,
      unregisterSlot,
      setLightboxOpen,
      subscribeSlotActive,
      getSlotActiveSnapshot,
    }),
    [setSlotEl, unregisterSlot, setLightboxOpen, subscribeSlotActive, getSlotActiveSnapshot]
  );

  return (
    <NestingCtx.Provider value={true}>
      <Ctx.Provider value={api}>{children}</Ctx.Provider>
    </NestingCtx.Provider>
  );
}

interface SlotReturn {
  /** True when a FeedVideoManagerProvider exists above. */
  managed: boolean;
  /** True when this slot is the chosen active video. */
  isActive: boolean;
  /** Stable ref callback — pass to the <video> element. */
  registerEl: (el: HTMLVideoElement | null) => void;
}

const FALSE_SNAPSHOT = () => false;
const NOOP_SUBSCRIBE = () => () => {};

export function useFeedVideoSlot(id: string): SlotReturn {
  const ctx = useContext(Ctx);

  // Per-slot subscription. Only this slot's listeners fire when its
  // active state flips — siblings are unaffected.
  const subscribe = useCallback(
    (cb: Listener) => (ctx ? ctx.subscribeSlotActive(id, cb) : NOOP_SUBSCRIBE()),
    [ctx, id]
  );
  const getSnapshot = useCallback(
    () => (ctx ? ctx.getSlotActiveSnapshot(id) : false),
    [ctx, id]
  );
  const isActive = useSyncExternalStore(subscribe, getSnapshot, FALSE_SNAPSHOT);

  // Mount/unmount-only registration. Because `ctx` is stable, this effect
  // runs exactly once per slot lifetime (plus on id change), not on every
  // active-state flip.
  useEffect(() => {
    if (!ctx) return;
    return () => {
      ctx.unregisterSlot(id);
    };
  }, [ctx, id]);

  const registerEl = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!ctx) return;
      ctx.setSlotEl(id, el);
    },
    [ctx, id]
  );

  return {
    managed: !!ctx,
    isActive,
    registerEl,
  };
}

interface ControlsReturn {
  isPresent: boolean;
  setLightboxOpen: (open: boolean) => void;
}

const NOOP_LIGHTBOX = () => {};

export function useFeedVideoManagerControls(): ControlsReturn {
  const ctx = useContext(Ctx);
  return {
    isPresent: !!ctx,
    setLightboxOpen: ctx ? ctx.setLightboxOpen : NOOP_LIGHTBOX,
  };
}
