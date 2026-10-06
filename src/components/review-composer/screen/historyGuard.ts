/**
 * Page-local Back protection for the review composer (3B close-out).
 *
 * The app uses BrowserRouter, which cannot block navigation. While the form
 * has something to lose, the page adds ONE extra history entry at the same
 * address (marker in router location.state). Pressing Back lands on the base
 * entry; the address is unchanged so the page stays mounted, re-adds the
 * guard and asks the user. Entries are identified by router location keys.
 *
 * Known limits (documented in docs/verification/review-composer-3b.md):
 * - a very rapid double Back can pass the base entry before the guard is
 *   re-added;
 * - the old guard entry stays in FORWARD history after leaving; a leftover
 *   marker from another session is treated as a normal fresh page.
 */
export type GuardMode = 'clean' | 'dirty' | 'saving' | 'ambiguous';

export const GUARD_STATE_KEY = '__reviewGuard';

export function guardSessionOf(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const g = (state as Record<string, unknown>)[GUARD_STATE_KEY];
  if (!g || typeof g !== 'object') return null;
  const id = (g as { sessionId?: unknown }).sessionId;
  return typeof id === 'string' ? id : null;
}

export function withGuard(state: unknown, sessionId: string): Record<string, unknown> {
  const base = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  return { ...base, [GUARD_STATE_KEY]: { sessionId } };
}

export function withoutGuard(state: unknown): Record<string, unknown> | null {
  if (!state || typeof state !== 'object') return null;
  const { [GUARD_STATE_KEY]: _omit, ...rest } = state as Record<string, unknown>;
  return Object.keys(rest).length ? rest : null;
}

export const needsProtection = (mode: GuardMode) => mode !== 'clean';

/** Whether to add the guard now. At most once: never when already on this session's guard. */
export function shouldArm(mode: GuardMode, currentState: unknown, sessionId: string, armed: boolean): boolean {
  if (!needsProtection(mode) || armed) return false;
  return guardSessionOf(currentState) !== sessionId;
}

export type BaseDecision =
  | { kind: 'block'; mode: Exclude<GuardMode, 'clean'> }
  | { kind: 'release-back' }
  | { kind: 'release-replace' };

/** The user pressed Back from the guard onto the base entry. */
export function decideOnBase(mode: GuardMode, fromKnown: boolean): BaseDecision {
  if (mode !== 'clean') return { kind: 'block', mode };
  return fromKnown ? { kind: 'release-back' } : { kind: 'release-replace' };
}

export const DIALOG_COPY: Record<Exclude<GuardMode, 'clean'>, { title: string; description: string; confirm: string; cancel: string }> = {
  dirty: {
    title: 'Discard your draft?',
    description: 'Your changes will be lost.',
    confirm: 'Discard',
    cancel: 'Keep editing',
  },
  saving: {
    title: 'Still saving',
    description: 'Your review is still saving. Leaving now may leave its status uncertain.',
    confirm: 'Leave anyway',
    cancel: 'Stay here',
  },
  ambiguous: {
    title: "We couldn't confirm the save",
    description:
      "We couldn't confirm whether your review was saved. Leaving now will close this form before the save status is resolved.",
    confirm: 'Leave anyway',
    cancel: 'Stay here',
  },
};

export type WaitResult = 'arrived' | 'timeout' | 'unexpected' | 'aborted';

export interface KeyWaiter {
  /** Feed every router location key change here. */
  notify(key: string): void;
  /** Wait for `expectedKey`; any other key → 'unexpected'. */
  wait(expectedKey: string, timeoutMs?: number): Promise<WaitResult>;
  /** Abort a pending wait (e.g. unmount). */
  abort(): void;
}

export function createKeyWaiter(setTimer = setTimeout, clearTimer = clearTimeout): KeyWaiter {
  let pending: { expected: string; resolve: (r: WaitResult) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  const settle = (r: WaitResult) => {
    if (!pending) return;
    clearTimer(pending.timer);
    const p = pending;
    pending = null;
    p.resolve(r);
  };
  return {
    notify(key) {
      if (!pending) return;
      settle(key === pending.expected ? 'arrived' : 'unexpected');
    },
    wait(expected, timeoutMs = 1000) {
      settle('aborted');
      return new Promise<WaitResult>((resolve) => {
        const timer = setTimer(() => settle('timeout'), timeoutMs);
        pending = { expected, resolve, timer };
      });
    },
    abort() {
      settle('aborted');
    },
  };
}
