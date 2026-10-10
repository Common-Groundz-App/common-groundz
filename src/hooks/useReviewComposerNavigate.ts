import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReviewComposerImplementation } from './useReviewComposerImplementation';
import { composerActionKey, resolveComposerTarget, type ComposerAction } from '@/services/review/composerRoutes';

type Pending = { key: string; action: ComposerAction; legacy: () => void; from: string };

/**
 * Step 3D — the only entry-point reader of the rollout switch.
 *
 * `open(action, legacy)` runs exactly one action: navigate to the page when the
 * switch is confirmed on, otherwise call `legacy`. While the switch is loading
 * the first tap waits (isPending) and later taps are ignored; leaving the
 * screen (unmount or navigation) cancels the waiting tap. A load failure
 * resolves to legacy once.
 */
export function useReviewComposerNavigate() {
  const { implementation, isResolved } = useReviewComposerImplementation();
  const navigate = useNavigate();
  const location = useLocation();
  const pending = useRef<Pending | null>(null);
  const [isPending, setIsPending] = useState(false);

  const live = useRef({ implementation, isResolved, from: '' });
  live.current = { implementation, isResolved, from: `${location.pathname}${location.search}${location.hash}` };

  const run = useCallback(
    (p: Omit<Pending, 'key'>) => {
      const target = resolveComposerTarget(p.action, live.current.implementation, p.from);
      if (target === 'legacy') p.legacy();
      else navigate(target.to, { state: target.state });
    },
    [navigate],
  );

  const cancelPending = useCallback(() => {
    pending.current = null;
    setIsPending(false);
  }, []);

  const open = useCallback(
    (action: ComposerAction, legacy: () => void) => {
      const key = composerActionKey(action);
      if (pending.current) {
        // A different target replaces nothing: the waiting tap is cancelled.
        if (pending.current.key !== key) cancelPending();
        return;
      }
      const from = live.current.from;
      if (!live.current.isResolved) {
        pending.current = { key, action, legacy, from };
        setIsPending(true);
        return;
      }
      run({ action, legacy, from });
    },
    [run, cancelPending],
  );

  // Switch resolved: run the single waiting tap once.
  useEffect(() => {
    if (!isResolved || !pending.current) return;
    const p = pending.current;
    pending.current = null;
    setIsPending(false);
    run(p);
  }, [isResolved, implementation, run]);

  // Leaving the screen cancels a waiting tap.
  useEffect(() => cancelPending, [location.key, cancelPending]);

  return { open, isPending, cancelPending, implementation, isResolved };
}
