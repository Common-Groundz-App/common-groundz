/**
 * Router binding for the composer's page-local Back guard. See historyGuard.ts
 * for the design and its documented limits.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createKeyWaiter,
  decideOnBase,
  guardSessionOf,
  shouldArm,
  withGuard,
  type GuardMode,
} from './historyGuard';

interface Options {
  mode: GuardMode;
  sessionId: string;
  /** True only when a valid in-app return path arrived with the page. */
  fromKnown: boolean;
  /** Destination when history provenance is unknown. */
  fallback: string;
  onBlocked: (mode: Exclude<GuardMode, 'clean'>) => void;
}

export function useHistoryGuard({ mode, sessionId, fromKnown, fallback, onBlocked }: Options) {
  const location = useLocation();
  const navigate = useNavigate();
  const waiter = useMemo(() => createKeyWaiter(), []);
  const armed = useRef<{ baseKey: string; guardKey: string | null } | null>(null);
  const pushing = useRef(false);
  const leaving = useRef(false);
  const loc = useRef(location);
  loc.current = location;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const blockedRef = useRef(onBlocked);
  blockedRef.current = onBlocked;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const pushGuard = useCallback(() => {
    const l = loc.current;
    pushing.current = true;
    navigate(l.pathname + l.search + l.hash, { state: withGuard(l.state, sessionId) });
  }, [navigate, sessionId]);

  // Arm at most once per session.
  useEffect(() => {
    if (!shouldArm(mode, loc.current.state, sessionId, !!armed.current || pushing.current)) return;
    armed.current = { baseKey: loc.current.key, guardKey: null };
    pushGuard();
  }, [mode, sessionId, pushGuard]);

  // React to every router location change.
  useEffect(() => {
    waiter.notify(location.key);
    const a = armed.current;
    if (!a) return;
    if (pushing.current) {
      if (guardSessionOf(location.state) === sessionId) {
        a.guardKey = location.key;
        pushing.current = false;
      }
      return;
    }
    if (leaving.current || location.key !== a.baseKey) return;
    const d = decideOnBase(modeRef.current, fromKnown);
    if (d.kind === 'block') {
      pushGuard();
      blockedRef.current(d.mode);
      return;
    }
    armed.current = null;
    if (d.kind === 'release-back') navigate(-1);
    else navigate(fallbackRef.current, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => () => waiter.abort(), [waiter]);

  /**
   * Step off the guard (waiting for the base key) so the caller can replace
   * the base entry. Returns false when the move didn't arrive as expected —
   * the caller must then stay put and must not replace anything.
   */
  const release = useCallback(async (): Promise<boolean> => {
    const a = armed.current;
    if (!a) return true;
    if (pushing.current || loc.current.key !== a.guardKey) {
      if (loc.current.key === a.baseKey || !a.guardKey) {
        armed.current = null;
        pushing.current = false;
        return true;
      }
      return false;
    }
    leaving.current = true;
    const done = waiter.wait(a.baseKey);
    navigate(-1);
    const r = await done;
    leaving.current = false;
    if (r !== 'arrived') return false;
    armed.current = null;
    return true;
  }, [navigate, waiter]);

  return { release };
}
