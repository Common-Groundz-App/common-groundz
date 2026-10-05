/**
 * Evidence after an ambiguous (timed-out) save. Never a verdict: without a
 * server submission key the client cannot prove which request landed.
 *
 *  - create-review: strong — one review per person + subject.
 *  - edit-review / edit-timeline-update: compare — exact record reloaded and
 *    compared with what was sent; another tab may still have changed it.
 *  - create-timeline-update: weak — the latest update is shown for the user
 *    to judge. It never counts as confirmed.
 */
import type { ComposerMode } from './modes';
import type { StoredReviewRecord, StoredTimelineUpdateRecord } from './values';
import { valuesEqual } from './values';

export type EvidenceStrength = 'strong' | 'compare' | 'weak';

export type AmbiguousSaveEvidence =
  | {
      status: 'candidate-found';
      strength: EvidenceStrength;
      candidate: StoredReviewRecord | StoredTimelineUpdateRecord | { id: string };
      /** Only for `compare`: whether the reloaded fields equal the attempt. */
      matchesAttempt?: boolean;
    }
  | { status: 'not-observed' }
  | { status: 'lookup-failed'; error: unknown };

export interface ReconcileDeps {
  findOwnReview(entityId: string): Promise<{ status: 'found'; review: { id: string } } | { status: 'none' } | { status: 'error' }>;
  loadReview(reviewId: string): Promise<StoredReviewRecord | null>;
  loadUpdate(reviewId: string, updateId: string): Promise<StoredTimelineUpdateRecord | null>;
  loadLatestUpdate(reviewId: string): Promise<StoredTimelineUpdateRecord | null>;
}

export interface ReconcileContext {
  mode: ComposerMode;
  entityId?: string;
  reviewId?: string;
  updateId?: string;
  /** Fields that were sent (used for compare). */
  attempt?: Record<string, unknown>;
}

function matches(record: object, attempt: Record<string, unknown> | undefined): boolean | undefined {
  if (!attempt) return undefined;
  const r = record as Record<string, unknown>;
  return Object.keys(attempt).every((k) => valuesEqual(r[k] ?? null, attempt[k] ?? null));
}

export async function gatherAmbiguousSaveEvidence(
  ctx: ReconcileContext,
  deps: ReconcileDeps,
): Promise<AmbiguousSaveEvidence> {
  try {
    switch (ctx.mode) {
      case 'create-review': {
        if (!ctx.entityId) return { status: 'not-observed' };
        const found = await deps.findOwnReview(ctx.entityId);
        if (found.status === 'error') return { status: 'lookup-failed', error: 'lookup_error' };
        if (found.status === 'none') return { status: 'not-observed' };
        return { status: 'candidate-found', strength: 'strong', candidate: found.review };
      }
      case 'edit-review': {
        if (!ctx.reviewId) return { status: 'not-observed' };
        const r = await deps.loadReview(ctx.reviewId);
        if (!r) return { status: 'not-observed' };
        return { status: 'candidate-found', strength: 'compare', candidate: r, matchesAttempt: matches(r, ctx.attempt) };
      }
      case 'edit-timeline-update': {
        if (!ctx.reviewId || !ctx.updateId) return { status: 'not-observed' };
        const u = await deps.loadUpdate(ctx.reviewId, ctx.updateId);
        if (!u) return { status: 'not-observed' };
        return { status: 'candidate-found', strength: 'compare', candidate: u, matchesAttempt: matches(u, ctx.attempt) };
      }
      case 'create-timeline-update': {
        if (!ctx.reviewId) return { status: 'not-observed' };
        const u = await deps.loadLatestUpdate(ctx.reviewId);
        if (!u) return { status: 'not-observed' };
        return { status: 'candidate-found', strength: 'weak', candidate: u };
      }
    }
  } catch (error) {
    return { status: 'lookup-failed', error };
  }
}
