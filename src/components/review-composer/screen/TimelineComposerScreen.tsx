/**
 * Step 3C — full-page composer for adding / editing a timeline update.
 *
 * Built on the same 3A foundation and 3B protections as the review page:
 * session-keyed store, upload registry (slots, late uploads), history guard
 * and leave dialogs. The in-timeline form is untouched.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { getSentimentColor } from '@/utils/ratingColorUtils';
import { useToast } from '@/hooks/use-toast';
import { MediaUploader } from '@/components/media/MediaUploader';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';
import ChoiceChips from '@/components/profile/reviews/questionnaire/ChoiceChips';
import { BASE_ON_RATING_ACTION_LABEL, RECOMMENDATION_INTENT_OPTIONS } from '@/services/review/recommendationResolver';
import { addReviewUpdate, editLatestReviewUpdate } from '@/services/review/timeline';
import { deleteMedia } from '@/services/mediaService';
import type { EntityAdapter } from '@/components/profile/circles/types';
import type { MediaItem, MediaUploadState } from '@/types/media';
import {
  decideFinishedUpload,
  endSession,
  releaseSlot as registryReleaseSlot,
  reserveSlots as registryReserveSlots,
  setSettlement,
  syncCommitted,
} from '../uploadRegistry';
import { getCapabilities } from '../modes';
import { canSubmit, hasUnsavedChanges, useComposerController } from '../store';
import { validateForSubmit } from '../stepEngine';
import { buildCreateTimelinePayload, buildEditTimelinePayload } from '../saveBuilders';
import { fromTimelineCreate, fromTimelineStatus } from '../serverErrors';
import { gatherAmbiguousSaveEvidence, type AmbiguousSaveEvidence } from '../reconcile';
import { useUploadSession } from '../useUploadSession';
import type { RecommendationChoice, StoredReviewRecord, StoredTimelineUpdateRecord } from '../values';
import { DIALOG_COPY, type GuardMode } from './historyGuard';
import { useHistoryGuard } from './useHistoryGuard';
import { loadLatestUpdate, loadUpdateById } from './timelineLoaders';
import { ComposerSkeleton, SAVE_TIMEOUT_MS } from './ReviewComposerScreen';

const TIMEOUT = Symbol('timeout');

export const TIMELINE_COPY = {
  addRetryWarning: 'This could add a second update if the first one went through.',
  editRetryWarning: 'Your edit may already have been saved.',
  mayBeExpired: 'This update may be past its 1-hour edit window. Saving will tell you for sure.',
  notLatest: 'Cannot edit — A newer update exists.',
  expired: 'Edit window closed (1 hour limit)',
  unavailableSubject: 'This subject is no longer available',
  noDestination: "We couldn't open this review's page, so you're back where you started.",
} as const;

export interface LoadedTimelineContext {
  review: StoredReviewRecord;
  display: EntityAdapter | null;
  contextLine: string | null;
  /** Entity page built from persisted slugs; null when none can be built. */
  destination: string | null;
}

type Props =
  | { mode: 'create-timeline-update'; userId: string; loaded: LoadedTimelineContext; cancelTo: string; fromKnown?: boolean }
  | {
      mode: 'edit-timeline-update';
      userId: string;
      loaded: LoadedTimelineContext;
      update: StoredTimelineUpdateRecord;
      mayBeExpired: boolean;
      cancelTo: string;
      fromKnown?: boolean;
    };

export function TimelineComposerScreen(props: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = props.mode === 'edit-timeline-update';
  const review = props.loaded.review;
  const updateId = props.mode === 'edit-timeline-update' ? props.update.id : null;
  const target = useMemo(
    () =>
      updateId
        ? ({ mode: 'edit-timeline-update', reviewId: review.id, updateId } as const)
        : ({ mode: 'create-timeline-update', reviewId: review.id } as const),
    [review.id, updateId],
  );
  const { state, dispatch, sessionKey } = useComposerController(target);
  const uploads = useUploadSession(sessionKey);
  const caps = getCapabilities(state.mode);
  const [isUploading, setIsUploading] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState<{ mode: Exclude<GuardMode, 'clean'>; action: () => void | Promise<void> } | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /* ---------------- hydration ---------------- */
  useEffect(() => {
    if (state.status !== 'loading') return;
    dispatch({
      type: 'HYDRATED',
      sessionKey,
      record: { review, update: props.mode === 'edit-timeline-update' ? props.update : null },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, state.status]);

  /* ---------------- destinations ---------------- */
  const destination = props.loaded.destination;
  const exitTo = destination ?? props.cancelTo;
  const goOut = useCallback(() => {
    if (destination) navigate(destination, { replace: true, state: { openReviewUpdate: { reviewId: review.id } } });
    else {
      toast({ title: TIMELINE_COPY.noDestination });
      navigate(props.cancelTo, { replace: true });
    }
  }, [destination, navigate, review.id, props.cancelTo, toast]);

  /* ---------------- leave warnings ---------------- */
  const dirty = hasUnsavedChanges(state, uploads.uploads.length);
  const guardMode: GuardMode =
    state.status === 'saving' ? 'saving' : state.status === 'ambiguous' ? 'ambiguous' : dirty && state.status !== 'saved' ? 'dirty' : 'clean';
  const guard = useHistoryGuard({
    mode: guardMode,
    sessionId: uploads.sessionId,
    fromKnown: !!props.fromKnown,
    fallback: exitTo,
    onBlocked: (mode) => setLeaveDialog({ mode, action: goOut }),
  });

  /* ---------------- upload registry ---------------- */
  const uploadSid = uploads.sessionId;
  useEffect(() => setSettlement(uploadSid, uploads.settlement), [uploadSid, uploads.settlement]);
  useEffect(() => syncCommitted(uploadSid, state.values.media.length), [uploadSid, state.values.media.length]);
  useEffect(() => () => endSession(uploadSid), [uploadSid]);
  useEffect(() => {
    if (guardMode === 'clean') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [guardMode]);

  const handleMediaAdded = (media: MediaItem) => {
    const decision = decideFinishedUpload(uploadSid, media.url, aliveRef.current);
    uploads.recordUpload(sessionKey, media.url);
    if (decision === 'add') dispatch({ type: 'MEDIA_ADDED', sessionKey, media });
    else if (decision === 'delete') void deleteMedia(media.url).catch(() => undefined);
  };
  const handleMediaRemove = (media: MediaItem) => dispatch({ type: 'MEDIA_REMOVED', sessionKey, url: media.url });
  const reserveSlots = useCallback((n: number) => registryReserveSlots(uploadSid, n), [uploadSid]);
  const releaseSlot = useCallback(() => registryReleaseSlot(uploadSid), [uploadSid]);
  const onUploadsChange = useCallback((list: MediaUploadState[]) => setIsUploading(list.some((u) => u.status === 'uploading')), []);

  /* ---------------- values ---------------- */
  const rec = state.values.recommendation;
  const setRec = (next: { baseOnRating: boolean; choice: RecommendationChoice | null }) =>
    dispatch({ type: 'SET_VALUE', sessionKey, id: 'recommendation', value: next });
  const onIntent = (value: string | undefined) => {
    if (value === 'yes' || value === 'maybe' || value === 'no') setRec({ baseOnRating: false, choice: value });
    else setRec({ baseOnRating: rec.baseOnRating, choice: null });
  };
  const onResetToRating = () => setRec({ baseOnRating: !rec.baseOnRating, choice: null });

  /* ---------------- saving ---------------- */
  const attemptRef = useRef<Record<string, unknown> | undefined>(undefined);
  const gatherEvidence = useCallback(async () => {
    const evidence = await gatherAmbiguousSaveEvidence(
      { mode: state.mode, reviewId: review.id, updateId: updateId ?? undefined, attempt: attemptRef.current },
      {
        findOwnReview: async () => ({ status: 'none' }),
        loadReview: async () => null,
        loadUpdate: loadUpdateById,
        loadLatestUpdate,
      },
    );
    dispatch({ type: 'EVIDENCE', sessionKey, evidence });
  }, [state.mode, review.id, updateId, sessionKey, dispatch]);

  const handleSave = async () => {
    if (!canSubmit(state)) return;
    const v = validateForSubmit(state);
    dispatch({ type: 'VALIDATED', sessionKey, errors: v.errors });
    if (!v.ok) {
      document.getElementById(`composer-section-${v.firstInvalid}`)?.focus();
      return;
    }
    dispatch({ type: 'SAVE_STARTED', sessionKey });
    uploads.send({ type: 'SAVING' });

    let write: Promise<unknown>;
    if (isEdit) {
      const built = buildEditTimelinePayload({ values: state.values, reviewId: review.id, updateId: updateId! });
      if (!built.ok) return;
      const p = built.payload;
      attemptRef.current = { comment: p.comment, rating: p.rating, media: p.media, would_recommend: p.would_recommend };
      write = editLatestReviewUpdate(p.review_id, p.update_id, p.rating, p.comment, p.media, p.would_recommend).then(fromTimelineStatus);
    } else {
      const built = buildCreateTimelinePayload({
        values: state.values,
        reviewId: review.id,
        recommendationTouched: state.meta.recommendation.touched,
      });
      if (!built.ok) return;
      const p = built.payload;
      attemptRef.current = undefined; // add evidence is never compared — the author judges it
      write = addReviewUpdate(p.review_id, props.userId, p.rating ?? null, p.comment, p.media, p.would_recommend, {
        sendExplicitNull: true,
      }).then(fromTimelineCreate);
    }

    let outcome: unknown;
    try {
      outcome = await Promise.race([write, new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), SAVE_TIMEOUT_MS))]);
    } catch {
      outcome = { status: 'error' };
    }
    // Left while saving: background only — no navigation, toast or form change.
    if (!aliveRef.current) return;
    if (outcome === TIMEOUT) {
      uploads.send({ type: 'AMBIGUOUS' });
      dispatch({ type: 'SAVE_TIMEOUT', sessionKey });
      void gatherEvidence();
      return;
    }
    const result = outcome as ReturnType<typeof fromTimelineStatus>;
    if (result.status === 'ok') {
      uploads.send({ type: 'COMMITTED' });
      dispatch({ type: 'SAVE_RESULT', sessionKey, result });
      toast(isEdit ? { title: 'Timeline update saved' } : { title: 'Update added', description: 'Your timeline update has been added successfully' });
      await guard.release();
      if (aliveRef.current) goOut();
      return;
    }
    uploads.send({ type: 'SAVE_FAILED' });
    dispatch({ type: 'SAVE_RESULT', sessionKey, result });
    if (result.status === 'error') {
      toast({
        title: 'Error',
        description: isEdit ? 'Failed to save your edit' : 'Could not add the timeline update.',
        variant: 'destructive',
      });
    }
  };

  /* ---------------- leaving ---------------- */
  const performLeave = async (action: () => void | Promise<void>) => {
    const ok = await guard.release();
    if (!ok) {
      if (aliveRef.current) toast({ title: "Couldn't leave this page — try again." });
      return;
    }
    // Saved photos of the update are never cleanup candidates.
    const preexisting = (state.storedUpdate?.media ?? []).map((m) => m.url);
    const candidates = uploads.cleanupCandidates(preexisting);
    void Promise.allSettled(candidates.map((url) => deleteMedia(url)));
    await action();
  };
  const requestLeave = (action: () => void | Promise<void>) => {
    if (guardMode === 'clean') return void performLeave(action);
    setLeaveDialog({ mode: guardMode, action });
  };
  const requestCancel = () => requestLeave(goOut);
  const openNewUpdate = () =>
    requestLeave(() => navigate(`/review/${review.id}/timeline/new`, { replace: true, state: { from: props.cancelTo } }));

  /* ---------------- render ---------------- */
  if (state.status === 'loading') return <ComposerSkeleton />;

  const err = (id: 'text' | 'media' | 'rating') => state.meta[id].error;
  const blocked = state.status === 'blocked' ? state.blockedReason : null;
  const last = state.lastResult?.status;
  const display = props.loaded.display;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4">
      <header className="flex items-center justify-between gap-3 py-2">
        <Button type="button" variant="ghost" onClick={requestCancel}>
          Cancel
        </Button>
        <h1 className="text-base font-semibold text-foreground">{isEdit ? 'Edit timeline update' : 'Add timeline update'}</h1>
        <span className="w-16" aria-hidden="true" />
      </header>

      {props.mode === 'edit-timeline-update' && props.mayBeExpired && !blocked && (
        <p role="status" className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {TIMELINE_COPY.mayBeExpired}
        </p>
      )}

      {(blocked === 'not_latest' || blocked === 'expired') && (
        <div role="alert" className="mb-6 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          <p className="font-medium text-foreground">{blocked === 'not_latest' ? TIMELINE_COPY.notLatest : TIMELINE_COPY.expired}</p>
          <p className="text-sm text-muted-foreground">
            Your text and photos are still here. You can start a new timeline update instead.
          </p>
          <Button size="sm" onClick={openNewUpdate}>
            Add a new update
          </Button>
        </div>
      )}
      {(blocked === 'unauthorized' || blocked === 'not_found') && (
        <div role="alert" className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground">
          {blocked === 'unauthorized' ? 'You can only change updates on your own review.' : "We couldn't find this update anymore."}
        </div>
      )}
      {state.status === 'ready' && last === 'conflict' && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          This update changed while you were editing. Your form is kept — please try again.
        </p>
      )}
      {state.status === 'ambiguous' && (
        <TimelineAmbiguousPanel
          isEdit={isEdit}
          evidence={state.evidence}
          retryAllowed={state.manualRetryAllowed}
          onCheckAgain={() => void gatherEvidence()}
          onAllowRetry={() => dispatch({ type: 'ALLOW_MANUAL_RETRY', sessionKey })}
          onConfirmSaved={async () => {
            uploads.send({ type: 'COMMITTED' });
            await guard.release();
            if (aliveRef.current) goOut();
          }}
        />
      )}

      <div className="space-y-6">
        <div className="space-y-2" data-testid="timeline-subject">
          {display ? (
            <>
              <EntityPreviewCard
                entity={{ ...display, image_url: display.image_url?.replace(/^http:\/\//i, 'https://') }}
                type={display.type ?? ''}
                onChange={() => {}}
                disableChange
              />
              {props.loaded.contextLine && <p className="text-sm text-muted-foreground">{props.loaded.contextLine}</p>}
            </>
          ) : (
            <div className="space-y-2">
              {review.entity_id && <p className="text-sm font-medium text-foreground">{TIMELINE_COPY.unavailableSubject}</p>}
              <Label htmlFor="timeline-legacy-title">What this review is about</Label>
              <Input id="timeline-legacy-title" value={review.title ?? ''} readOnly disabled aria-readonly="true" />
            </div>
          )}
        </div>

        <div id="composer-section-rating" tabIndex={-1} className="space-y-2 outline-none">
          <label className="text-sm font-medium">New Rating (optional)</label>
          <div className="flex items-center gap-3">
            <ConnectedRingsRating
              value={state.values.rating || 0}
              onChange={(v: number) => dispatch({ type: 'SET_VALUE', sessionKey, id: 'rating', value: v })}
              variant="default"
              size="md"
              showValue={false}
              isInteractive={true}
            />
            {!!state.values.rating && (
              <>
                <span className="font-medium" style={{ color: getSentimentColor(state.values.rating) }}>
                  {state.values.rating.toFixed(1)}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: 'SET_VALUE', sessionKey, id: 'rating', value: null })}>
                  Clear
                </Button>
              </>
            )}
          </div>
          {err('rating') && <FieldError message={err('rating')!} />}
        </div>

        <div id="composer-section-recommendation" tabIndex={-1} className="space-y-2 outline-none">
          <ChoiceChips
            fieldId="timeline_would_recommend"
            label="Would you still recommend it?"
            helperText="Tap again to clear your answer."
            options={RECOMMENDATION_INTENT_OPTIONS as readonly { value: string; label: string }[]}
            value={rec.baseOnRating ? undefined : rec.choice ?? undefined}
            onChange={onIntent}
          />
          <Button type="button" variant={rec.baseOnRating ? 'default' : 'outline'} size="sm" onClick={onResetToRating}>
            {BASE_ON_RATING_ACTION_LABEL}
          </Button>
        </div>

        <div id="composer-section-text" tabIndex={-1} className="space-y-2 outline-none">
          <Label htmlFor="timeline-comment" className="text-sm font-medium">
            Update Comment *
          </Label>
          <Textarea
            id="timeline-comment"
            value={state.values.text}
            onChange={(e) => dispatch({ type: 'SET_VALUE', sessionKey, id: 'text', value: e.target.value })}
            placeholder="Share what's changed in your experience..."
            rows={3}
          />
          {err('text') && <FieldError message={err('text')!} />}
        </div>

        <div id="composer-section-media" tabIndex={-1} className="space-y-4 outline-none">
          {state.values.media.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-medium">
                <span className="text-lg">🖼️</span>
                <span>Your media ({state.values.media.length}/4)</span>
              </Label>
              <CompactMediaGrid media={state.values.media} onRemove={handleMediaRemove} maxVisible={4} className="group" />
            </div>
          )}
          <div className="space-y-2">
            <Label className="mb-1 flex items-center gap-2 font-medium">
              <span className="text-lg">📸</span>
              <span>Add photos & videos</span>
            </Label>
            <MediaUploader
              sessionId={uploads.sessionId}
              onMediaUploaded={handleMediaAdded}
              initialMedia={state.values.media}
              className="w-full"
              maxMediaCount={4}
              onUploadsChange={onUploadsChange}
              reserveSlots={reserveSlots}
              releaseSlot={releaseSlot}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {state.values.media.length > 0
                ? `${state.values.media.length}/4 media items added - Add photos or videos to make your update stand out`
                : 'Add photos or videos to make your update stand out'}
            </p>
          </div>
          {err('media') && <FieldError message={err('media')!} />}
        </div>
      </div>

      <footer className="mt-8 flex items-center justify-end gap-3">
        <Button type="button" onClick={handleSave} disabled={!canSubmit(state) || isUploading || !state.values.text.trim()}>
          {state.status === 'saving' ? 'Saving…' : caps.submitLabel}
        </Button>
      </footer>

      <ConfirmationDialog
        isOpen={!!leaveDialog}
        onClose={() => setLeaveDialog(null)}
        onConfirm={() => {
          const d = leaveDialog;
          setLeaveDialog(null);
          if (d) void performLeave(d.action);
        }}
        title={leaveDialog ? DIALOG_COPY[leaveDialog.mode].title : ''}
        description={leaveDialog ? DIALOG_COPY[leaveDialog.mode].description : ''}
        variant="destructive"
        confirmLabel={leaveDialog ? DIALOG_COPY[leaveDialog.mode].confirm : 'Discard'}
        cancelLabel={leaveDialog ? DIALOG_COPY[leaveDialog.mode].cancel : 'Keep editing'}
      />
    </div>
  );
}

const FieldError = ({ message }: { message: string }) => (
  <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
    <AlertCircle className="h-4 w-4" />
    {message}
  </p>
);

/** Copy for the "couldn't confirm" state. Evidence never counts as proof. */
export function timelineAmbiguousCopy(isEdit: boolean, e: AmbiguousSaveEvidence | null) {
  const retryWarning = isEdit ? TIMELINE_COPY.editRetryWarning : TIMELINE_COPY.addRetryWarning;
  if (!e) return { title: 'Checking whether your update was saved…', body: null as string | null, found: null as string | null, retryWarning };
  if (e.status === 'candidate-found') {
    const found = (e.candidate as { comment?: string }).comment ?? null;
    if (isEdit) {
      return e.matchesAttempt
        ? { title: 'Your edit looks saved', body: 'The update now shows what you sent. Please confirm.', found, retryWarning }
        : { title: "We couldn't confirm your edit", body: 'The update differs from what you sent. Your form is kept as it is.', found, retryWarning };
    }
    return { title: 'We found a recent update — is it yours?', body: 'It may be the one you just sent. Your form is kept as it is.', found, retryWarning };
  }
  if (e.status === 'not-observed') return { title: "We couldn't confirm your save", body: 'Nothing has shown up yet. Your form is kept as it is.', found: null, retryWarning };
  return { title: "We couldn't check whether this saved", body: 'Your form is kept as it is.', found: null, retryWarning };
}

function TimelineAmbiguousPanel(p: {
  isEdit: boolean;
  evidence: AmbiguousSaveEvidence | null;
  retryAllowed: boolean;
  onCheckAgain: () => void;
  onAllowRetry: () => void;
  onConfirmSaved: () => void;
}) {
  const c = timelineAmbiguousCopy(p.isEdit, p.evidence);
  const candidate = p.evidence?.status === 'candidate-found';
  return (
    <div role="alert" className="mb-6 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <p className="font-medium text-foreground">{c.title}</p>
      {c.body && <p className="text-sm text-muted-foreground">{c.body}</p>}
      {c.found && <blockquote className="border-l-2 border-border pl-3 text-sm text-foreground">{c.found}</blockquote>}
      {p.evidence && (
        <div className="flex flex-wrap gap-2">
          {candidate && (
            <Button size="sm" onClick={p.onConfirmSaved}>
              Yes, it saved
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={p.onCheckAgain}>
            Check again
          </Button>
          {!p.retryAllowed && (
            <Button size="sm" variant="ghost" onClick={p.onAllowRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
      {p.retryAllowed && (
        <p className="text-sm text-muted-foreground">
          {c.retryWarning} Save is unlocked — press it only if you're sure.
        </p>
      )}
    </div>
  );
}
