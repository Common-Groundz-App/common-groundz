/**
 * Step 3B — /review, /review?entityId=<id>, /review/:reviewId/edit.
 *
 * TEMPORARY pre-cutover gate (remove in 3D): the page opens only when the
 * rollout switch resolves to `page` or the user is a server-verified admin.
 * No existing button links here yet.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import SEOHead from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useReviewComposerImplementation } from '@/hooks/useReviewComposerImplementation';
import { isWithinEditWindow } from '@/utils/reviewEditPolicy';
import { findOwnReviewForEntity } from '@/services/review/ownReview';
import { ReviewComposerScreen, ComposerSkeleton } from '@/components/review-composer/screen/ReviewComposerScreen';
import {
  loadReviewForEdit,
  loadSubject,
  type LoadedReview,
  type ReviewLoad,
  type SubjectLoad,
} from '@/components/review-composer/screen/loaders';
import { TimelineComposerScreen, type LoadedTimelineContext } from '@/components/review-composer/screen/TimelineComposerScreen';
import { loadUpdateForEdit, type UpdateLoad } from '@/components/review-composer/screen/timelineLoaders';
import {
  isRetryableOpenResult,
  openExistingReviewTimelineUpdate,
  type OpenTimelineResult,
} from '@/components/review-composer/screen/openExistingReviewTimelineUpdate';

/** Only same-app paths are accepted as a return destination. */
export function safeOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/review')) return null;
  return value;
}

/** Temporary 3B gate. */
export function canUseReviewComposerPage(implementation: 'legacy' | 'page', isAdmin: boolean) {
  return implementation === 'page' || isAdmin;
}

export default function ReviewComposerPage() {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { implementation, isResolved } = useReviewComposerImplementation();
  const { reviewId, updateId } = useParams();
  const { pathname } = useLocation();
  const isTimeline = reviewId !== undefined && pathname.includes('/timeline/');
  const isEdit = reviewId !== undefined && !isTimeline;

  const gateReady = !adminLoading && (isResolved || isAdmin);
  let body: React.ReactNode;
  if (!user || !gateReady) body = <ComposerSkeleton />;
  else if (!canUseReviewComposerPage(implementation, isAdmin)) body = <NotAvailable />;
  else if (isTimeline) body = <TimelineRoute reviewId={reviewId!} updateId={updateId ?? null} userId={user.id} />;
  else body = isEdit ? <EditRoute reviewId={reviewId!} userId={user.id} isAdmin={isAdmin} /> : <CreateRoute userId={user.id} />;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead noindex={true} title={`${isTimeline ? 'Timeline update' : isEdit ? 'Edit review' : 'Write a review'} — Common Groundz`} />
      {body}
    </div>
  );
}

/** Return destination plus whether it came from a known in-app origin. */
function useCancelTo(fallback: string) {
  const location = useLocation();
  const from = safeOrigin((location.state as { from?: unknown } | null)?.from);
  return { cancelTo: from ?? fallback, fromKnown: from !== null };
}

/* --------------------------------- create --------------------------------- */

function CreateRoute({ userId }: { userId: string }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const entityId = params.get('entityId');
  const { cancelTo, fromKnown } = useCancelTo('/home');
  const [load, setLoad] = useState<SubjectLoad | 'loading' | null>(entityId ? 'loading' : null);

  const run = useCallback(() => {
    if (!entityId) return setLoad(null);
    let cancelled = false;
    setLoad('loading');
    loadSubject(entityId).then((r) => !cancelled && setLoad(r));
    return () => {
      cancelled = true;
    };
  }, [entityId]);
  useEffect(() => run(), [run]);

  if (load === 'loading') return <ComposerSkeleton />;
  if (load?.status === 'not_found') {
    return (
      <StatePanel title="Subject not found" body="We couldn't find what you wanted to review. It may have been removed.">
        <Button onClick={() => navigate('/review', { replace: true })}>Pick another</Button>
      </StatePanel>
    );
  }
  if (load?.status === 'error') {
    return (
      <StatePanel title="Couldn't load this" body="Check your connection and try again.">
        <Button onClick={() => run()}>Retry</Button>
      </StatePanel>
    );
  }
  // Keyed by subject: "Pick another" (→ /review) starts a genuinely fresh session.
  return (
    <ReviewComposerScreen
      key={entityId ?? 'generic'}
      mode="create-review"
      userId={userId}
      preselected={load?.status === 'ok' ? load.value : null}
      cancelTo={cancelTo}
      fromKnown={fromKnown}
    />
  );
}

/* ---------------------------------- edit ---------------------------------- */

function EditRoute({ reviewId, userId, isAdmin }: { reviewId: string; userId: string; isAdmin: boolean }) {
  const [load, setLoad] = useState<ReviewLoad | 'loading'>('loading');
  const [cancelFallback, setCancelFallback] = useState('/home');

  const run = useCallback(() => {
    let cancelled = false;
    setLoad('loading');
    loadReviewForEdit(reviewId, userId).then(async (r) => {
      if (cancelled) return;
      if (r.status === 'ok' && r.value.record.entity_id) {
        const found = await findOwnReviewForEntity(r.value.record.entity_id);
        if (!cancelled && found.status === 'found' && found.canonicalPath) setCancelFallback(found.canonicalPath);
      }
      if (!cancelled) setLoad(r);
    });
    return () => {
      cancelled = true;
    };
  }, [reviewId, userId]);
  useEffect(() => run(), [run]);
  const { cancelTo, fromKnown } = useCancelTo(cancelFallback);

  if (load === 'loading') return <ComposerSkeleton />;
  if (load.status === 'not_found') return <StatePanel title="Review not found" body="This review doesn't exist or was deleted." home />;
  if (load.status === 'unauthorized') return <StatePanel title="You can only edit your own review" body="Moderation tools are separate." home />;
  if (load.status === 'error') {
    return (
      <StatePanel title="Couldn't load this review" body="Check your connection and try again.">
        <Button onClick={() => run()}>Retry</Button>
      </StatePanel>
    );
  }
  // Admins keep the existing bypass only on their own review (ownership checked above).
  if (!isAdmin && !isWithinEditWindow(load.value.createdAt)) return <ExpiredEdit loaded={load.value} cancelTo={cancelTo} />;
  return <ReviewComposerScreen mode="edit-review" userId={userId} loaded={load.value} cancelTo={cancelTo} fromKnown={fromKnown} />;
}

/* -------------------------------- timeline -------------------------------- */

type TimelineLoad =
  | { status: 'ok'; ctx: LoadedTimelineContext; update: UpdateLoad | null }
  | { status: 'not_found' | 'unauthorized' | 'error' };

function TimelineRoute({ reviewId, updateId, userId }: { reviewId: string; updateId: string | null; userId: string }) {
  const navigate = useNavigate();
  const [load, setLoad] = useState<TimelineLoad | 'loading'>('loading');
  const run = useCallback(() => {
    let cancelled = false;
    setLoad('loading');
    (async () => {
      const r = await loadReviewForEdit(reviewId, userId);
      if (cancelled) return;
      if (r.status !== 'ok') return setLoad({ status: r.status });
      let destination: string | null = null;
      if (r.value.record.entity_id) {
        const found = await findOwnReviewForEntity(r.value.record.entity_id);
        if (found.status === 'error') return !cancelled && setLoad({ status: 'error' });
        if (found.status === 'found' && found.review.id === reviewId) destination = found.canonicalPath ?? null;
      }
      const update = updateId ? await loadUpdateForEdit(reviewId, updateId, userId) : null;
      if (cancelled) return;
      setLoad({ status: 'ok', ctx: { review: r.value.record, display: r.value.display, contextLine: r.value.contextLine, destination }, update });
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewId, updateId, userId]);
  useEffect(() => run(), [run]);
  const fallback = load !== 'loading' && load.status === 'ok' ? load.ctx.destination ?? '/home' : '/home';
  const { cancelTo, fromKnown } = useCancelTo(fallback);

  if (load === 'loading') return <ComposerSkeleton />;
  const retry = (
    <StatePanel title="Couldn't load this" body="Check your connection and try again.">
      <Button onClick={() => run()}>Retry</Button>
    </StatePanel>
  );
  if (load.status === 'error') return retry;
  if (load.status === 'not_found') return <StatePanel title="Review not found" body="This review doesn't exist or was deleted." home />;
  if (load.status === 'unauthorized') return <StatePanel title="You can only add updates to your own review" body="Moderation tools are separate." home />;
  const u = load.update;
  if (!updateId || !u) {
    return <TimelineComposerScreen mode="create-timeline-update" userId={userId} loaded={load.ctx} cancelTo={cancelTo} fromKnown={fromKnown} />;
  }
  if (u.status === 'error') return retry;
  if (u.status === 'not_found') return <StatePanel title="Update not found" body="This timeline update doesn't exist or was deleted." home />;
  if (u.status === 'wrong_review') return <StatePanel title="Update not found" body="This update belongs to a different review." home />;
  if (u.status === 'unauthorized') return <StatePanel title="You can only edit your own update" body="Moderation tools are separate." home />;
  if (u.status === 'not_latest') {
    return (
      <StatePanel title="Cannot edit — A newer update exists." body="Only your latest timeline update can be edited.">
        <Button onClick={() => navigate(`/review/${reviewId}/timeline/new`, { replace: true, state: { from: cancelTo } })}>Add a new update</Button>
      </StatePanel>
    );
  }
  return (
    <TimelineComposerScreen
      mode="edit-timeline-update"
      userId={userId}
      loaded={load.ctx}
      update={u.value}
      mayBeExpired={u.mayBeExpired}
      cancelTo={cancelTo}
      fromKnown={fromKnown}
    />
  );
}

function ExpiredEdit({ loaded, cancelTo }: { loaded: LoadedReview; cancelTo: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OpenTimelineResult | null>(null);
  const entityId = loaded.record.entity_id;
  // Step 3C — inside the gated page, the hand-off opens the timeline page.
  const open = async () => {
    navigate(`/review/${loaded.record.id}/timeline/new`, { replace: true, state: { from: cancelTo } });
  };
  return (
    <StatePanel
      title="Edit window closed (1 hour limit)"
      body="You can edit for 1 hour after publishing. Share how it's going now with a timeline update."
    >
      <div className="flex flex-wrap justify-center gap-2">
        {(
          <Button onClick={open} disabled={busy}>
            {busy ? 'Opening…' : 'Add timeline update'}
          </Button>
        )}
        <Button variant="ghost" onClick={() => navigate(cancelTo)}>
          Cancel
        </Button>
      </div>
      {result && result.status !== 'opened' && (
        <p role="status" className="text-sm text-destructive">
          {isRetryableOpenResult(result) ? "We couldn't open your timeline. Please try again." : "We couldn't find your review anymore."}
        </p>
      )}
    </StatePanel>
  );
}

/* --------------------------------- states --------------------------------- */

function NotAvailable() {
  return <StatePanel title="Not available yet" body="This page is still being prepared. You can write reviews from any entity page." home />;
}

function StatePanel({ title, body, home, children }: { title: string; body: string; home?: boolean; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 pt-24 text-center" role="alert">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      {children}
      {home && (
        <Button asChild variant="outline">
          <Link to="/home">Back to home</Link>
        </Button>
      )}
    </div>
  );
}
