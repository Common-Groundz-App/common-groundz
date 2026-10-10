/**
 * Step 3D — the one routing decision for review authoring entry points.
 *
 * Composer routes are identified by durable database IDs only. Persisted
 * entity/parent slugs are used elsewhere solely for return destinations.
 */
import type { ReviewComposerImplementation } from '@/hooks/useReviewComposerImplementation';

export type ComposerAction =
  | { kind: 'write'; entityId?: string | null }
  | { kind: 'editReview'; reviewId: string }
  | { kind: 'addUpdate'; reviewId: string }
  | { kind: 'editUpdate'; reviewId: string; updateId: string };

export type ComposerTarget = { to: string; state: { from?: string } } | 'legacy';

/** Only same-app paths are accepted as a return destination. */
export function safeOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/review')) return null;
  return value;
}

export function composerPath(action: ComposerAction): string {
  switch (action.kind) {
    case 'write':
      return action.entityId ? `/review?entityId=${encodeURIComponent(action.entityId)}` : '/review';
    case 'editReview':
      return `/review/${encodeURIComponent(action.reviewId)}/edit`;
    case 'addUpdate':
      return `/review/${encodeURIComponent(action.reviewId)}/timeline/new`;
    case 'editUpdate':
      return `/review/${encodeURIComponent(action.reviewId)}/timeline/${encodeURIComponent(action.updateId)}/edit`;
  }
}

/** Identity of an action, used to cancel a pending tap whose target changed. */
export function composerActionKey(action: ComposerAction): string {
  return `${action.kind}:${composerPath(action)}`;
}

export function resolveComposerTarget(
  action: ComposerAction,
  implementation: ReviewComposerImplementation,
  from?: string | null,
): ComposerTarget {
  if (implementation !== 'page') return 'legacy';
  const origin = safeOrigin(from);
  return { to: composerPath(action), state: origin ? { from: origin } : {} };
}
