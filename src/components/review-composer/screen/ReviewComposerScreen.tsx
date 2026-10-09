/**
 * Step 3B — the full-page composer for new review / edit review.
 *
 * State, validation, steps and payloads come only from the 3A foundation
 * (store, stepEngine, saveBuilders). Only low-level inputs are reused from the
 * legacy steps; the legacy popup's orchestration is never imported.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useToast } from '@/hooks/use-toast';
import { useSearchFunnel } from '@/hooks/useSearchFunnel';
import StepOne from '@/components/profile/reviews/steps/StepOne';
import SubjectSelectStep from '@/components/profile/reviews/steps/SubjectSelectStep';
import StepFour from '@/components/profile/reviews/steps/StepFour';
import { MediaUploader } from '@/components/media/MediaUploader';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';
import { LocationAccessPrompt } from '@/components/profile/reviews/LocationAccessPrompt';
import { useLocation as useLocationAccess } from '@/contexts/LocationContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  decideFinishedUpload,
  endSession,
  releaseSlot as registryReleaseSlot,
  reserveSlots as registryReserveSlots,
  setSettlement,
  syncCommitted,
} from '../uploadRegistry';
import { DIALOG_COPY, type GuardMode } from './historyGuard';
import { useHistoryGuard } from './useHistoryGuard';
import { markLocationPromptShown, markLocationPromptSkipped, shouldShowLocationPrompt } from './locationPromptPolicy';
import type { EntityAdapter } from '@/components/profile/circles/types';
import type { QuestionnaireConfig } from '@/components/profile/reviews/questionnaire/registry';
import type { MediaItem, MediaUploadState } from '@/types/media';
import { parseEntityTypeAtBoundary } from '@/services/entityType';
import { createReview, updateReview } from '@/services/review/core';
import { findOwnReviewForEntity } from '@/services/review/ownReview';
import { deleteMedia } from '@/services/mediaService';
import { getCapabilities } from '../modes';
import { getQuestionnaireContext, sectionAvailability } from '../sections';
import {
  canSubmit,
  hasUnsavedChanges,
  sectionContextOf,
  useComposerController,
} from '../store';
import { nextStep, stepCount, validateForSubmit } from '../stepEngine';
import { buildCreateReviewPayload, buildEditReviewPayload } from '../saveBuilders';
import { fromCreateReviewError, fromUpdateReviewError, MEDIA_RETIRED_TOAST } from '../serverErrors';
import { gatherAmbiguousSaveEvidence } from '../reconcile';
import { useUploadSession } from '../useUploadSession';
import type { SectionId } from '../values';
import { reloadReviewRecord, resolveProvider, toSubject, type LoadedReview, type LoadedSubject } from './loaders';
import { isRetryableOpenResult, openExistingReviewTimelineUpdate, type OpenTimelineResult } from './openExistingReviewTimelineUpdate';

export const SAVE_TIMEOUT_MS = 20_000;
const TIMEOUT = Symbol('timeout');

type Props =
  | {
      mode: 'create-review';
      userId: string;
      preselected: LoadedSubject | null;
      cancelTo: string;
      fromKnown?: boolean;
      onPickAnother?: never;
    }
  | {
      mode: 'edit-review';
      userId: string;
      loaded: LoadedReview;
      cancelTo: string;
      fromKnown?: boolean;
    };

type ExistingCheck = { entityId: string; state: 'checking' | 'found' | 'none' | 'error'; reviewId: string | null };

const SID = { rating: 'rating', subject: 'subject', media: 'media', text: 'text' } as const satisfies Record<string, SectionId>;

const STEP_TITLES = ['Rating', 'Subject', 'Photos', 'Details'];

export function ReviewComposerScreen(props: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { log: logFunnel } = useSearchFunnel();
  const isEdit = props.mode === 'edit-review';
  const target = useMemo(
    () => (isEdit ? { mode: 'edit-review' as const, reviewId: (props as any).loaded.record.id } : { mode: 'create-review' as const }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEdit],
  );
  const preselected = props.mode === 'create-review' ? props.preselected : null;
  const { state, dispatch, sessionKey } = useComposerController(target, preselected?.subject ?? null);
  const uploads = useUploadSession(sessionKey);
  const caps = getCapabilities(state.mode);
  const [step, setStep] = useState(0);
  const [display, setDisplay] = useState<EntityAdapter | null>(
    props.mode === 'edit-review' ? props.loaded.display : preselected?.display ?? null,
  );
  const [contextLine, setContextLine] = useState<string | null>(
    props.mode === 'edit-review' ? props.loaded.contextLine : preselected?.contextLine ?? null,
  );
  const [isResolvingContext, setIsResolvingContext] = useState(false);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [existing, setExisting] = useState<ExistingCheck | null>(null);
  const [openResult, setOpenResult] = useState<OpenTimelineResult | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState<{ mode: Exclude<GuardMode, 'clean'>; action: () => void | Promise<void> } | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const subjectReq = useRef(0);
  const existingReq = useRef(0);

  /* ---------------- edit hydration (record already loaded by the page) ---------------- */
  useEffect(() => {
    if (props.mode !== 'edit-review' || state.status !== 'loading') return;
    dispatch({ type: 'HYDRATED', sessionKey, record: { review: props.loaded.record } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, state.status]);

  const ctx = sectionContextOf(state);
  const subjectId = isEdit ? state.stored?.entity_id ?? null : state.values.subject?.id ?? null;

  /* ---------------- one review per person: check before the form ---------------- */
  const runExistingCheck = useCallback(
    (entityId: string) => {
      const id = ++existingReq.current;
      setExisting({ entityId, state: 'checking', reviewId: null });
      findOwnReviewForEntity(entityId).then((r) => {
        if (id !== existingReq.current) return;
        setExisting({
          entityId,
          state: r.status === 'found' ? 'found' : r.status === 'none' ? 'none' : 'error',
          reviewId: r.status === 'found' ? r.review.id : null,
        });
      });
    },
    [],
  );
  useEffect(() => {
    if (isEdit) return;
    if (!subjectId) {
      existingReq.current += 1;
      setExisting(null);
      return;
    }
    runExistingCheck(subjectId);
  }, [isEdit, subjectId, runExistingCheck]);

  /* ---------------- leave warnings ---------------- */
  const dirty = hasUnsavedChanges(state, uploads.uploads.length);
  const guardMode: GuardMode =
    state.status === 'saving' ? 'saving' : state.status === 'ambiguous' ? 'ambiguous' : dirty && state.status !== 'saved' ? 'dirty' : 'clean';
  const guard = useHistoryGuard({
    mode: guardMode,
    sessionId: uploads.sessionId,
    fromKnown: !!props.fromKnown,
    fallback: props.cancelTo,
    onBlocked: (mode) => setLeaveDialog({ mode, action: () => navigate(props.cancelTo, { replace: true }) }),
  });

  /* ---------------- upload registry (outlives this screen) ---------------- */
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

  /* ---------------- section handlers ---------------- */
  const setValue = (id: Exclude<SectionId, 'subject' | 'questionnaire'>, value: unknown) =>
    dispatch({ type: 'SET_VALUE', sessionKey, id, value });

  const handleSubjectChange = (adapter: EntityAdapter | null) => {
    const req = ++subjectReq.current;
    if (!adapter) {
      setDisplay(null);
      setContextLine(null);
      setIsResolvingContext(false);
      dispatch({ type: 'SUBJECT_CHANGED', sessionKey, subject: null });
      return;
    }
    if (!parseEntityTypeAtBoundary(adapter.type)) {
      toast({ title: "We can't use this one yet", description: 'Pick something else to review for now.', variant: 'destructive' });
      return;
    }
    logFunnel({ event: isEdit ? 'review_subject_attached_late' : 'review_subject_selected', source: 'review_form', entityType: adapter.type as never });
    setDisplay(adapter);
    setContextLine(null);
    setIsResolvingContext(true);
    dispatch({ type: 'SUBJECT_CHANGED', sessionKey, subject: toSubject(adapter, null) });
    resolveProvider(adapter.id, adapter.type).then(({ providerName, contextLine: line }) => {
      if (req !== subjectReq.current) return;
      setIsResolvingContext(false);
      setContextLine(line);
      if (providerName) dispatch({ type: 'SUBJECT_CHANGED', sessionKey, subject: toSubject(adapter, providerName) });
    });
  };

  const q = getQuestionnaireContext(ctx);
  const qEnabled = sectionAvailability('questionnaire', ctx) === 'enabled';
  const foodEnabled = sectionAvailability('foodTags', ctx) === 'enabled';
  const renderedConfig: QuestionnaireConfig | null = useMemo(() => {
    if (!q.resolution || q.resolution.mode === 'invalid') return null;
    const config = q.resolution.config;
    const sections = config.sections
      .map((s) => ({ ...s, fields: s.fields.filter((f) => (f.id === 'food_tags' ? foodEnabled : qEnabled)) }))
      .filter((s) => s.fields.length > 0);
    return { ...config, sections };
  }, [q.resolution, qEnabled, foodEnabled]);

  // Captures this render's session: a late finish is decided against the
  // session the upload started in, even after the screen has closed.
  const handleMediaAdded = (media: MediaItem) => {
    const decision = decideFinishedUpload(uploadSid, media.url, aliveRef.current);
    uploads.recordUpload(sessionKey, media.url);
    if (decision === 'add') dispatch({ type: 'MEDIA_ADDED', sessionKey, media });
    else if (decision === 'delete') void deleteMedia(media.url).catch(() => undefined);
  };
  const handleMediaRemove = (media: MediaItem) => dispatch({ type: 'MEDIA_REMOVED', sessionKey, url: media.url });
  const reserveSlots = useCallback((n: number) => registryReserveSlots(uploadSid, n), [uploadSid]);
  const releaseSlot = useCallback(() => registryReleaseSlot(uploadSid), [uploadSid]);
  const onUploadsChange = useCallback(
    (list: MediaUploadState[]) => setIsUploading(list.some((u) => u.status === 'uploading')),
    [],
  );

  /* ---------------- location prompt (questionnaire-driven) ---------------- */
  const { permissionStatus, locationEnabled } = useLocationAccess();
  const onMediaStep = (caps.steps[step] as readonly SectionId[] | undefined)?.indexOf('media') !== undefined &&
    (caps.steps[step] as readonly SectionId[]).indexOf('media') >= 0;
  const locationEligible = !!renderedConfig?.showLocationPrompt;
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  useEffect(() => {
    if (!onMediaStep) return;
    if (showLocationPrompt) {
      if (locationEnabled || permissionStatus === 'granted') setShowLocationPrompt(false);
      return;
    }
    const now = Date.now();
    const show = shouldShowLocationPrompt({ eligible: locationEligible, locationEnabled, permissionStatus, now, storage: localStorage });
    if (show) {
      markLocationPromptShown(localStorage, now);
      setShowLocationPrompt(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMediaStep, locationEligible, locationEnabled, permissionStatus]);
  const skipLocationPrompt = () => {
    setShowLocationPrompt(false);
    markLocationPromptSkipped(localStorage, Date.now());
  };

  /* ---------------- step navigation ---------------- */
  const focusSection = (id: SectionId | null) => {
    if (!id) return;
    requestAnimationFrame(() => document.getElementById(`composer-section-${id}`)?.focus());
  };

  const onStep = (id: SectionId) => (caps.steps[step] as readonly SectionId[]).indexOf(id) >= 0;

  // Parity with the popup: fires each time the subject step becomes visible.
  const subjectStepVisible = onStep(SID.subject);
  useEffect(() => {
    if (subjectStepVisible) logFunnel({ event: 'review_subject_step_shown', source: 'review_form' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectStepVisible]);

  const subjectBlocked =
    !isEdit && (isAddingSubject || isResolvingContext || (!!subjectId && existing?.entityId === subjectId && existing.state !== 'none'));

  const goNext = () => {
    const r = nextStep(state, step);
    dispatch({ type: 'VALIDATED', sessionKey, errors: r.validation.errors });
    if (!r.validation.ok) return focusSection(r.validation.firstInvalid);
    if (onStep(SID.subject) && subjectBlocked) return;
    setStep(r.stepIndex);
  };

  /* ---------------- saving ---------------- */
  const attemptRef = useRef<Record<string, unknown> | undefined>(undefined);

  const gatherEvidence = useCallback(async () => {
    const evidence = await gatherAmbiguousSaveEvidence(
      {
        mode: state.mode,
        entityId: subjectId ?? undefined,
        reviewId: state.stored?.id,
        attempt: attemptRef.current,
      },
      {
        findOwnReview: findOwnReviewForEntity,
        loadReview: reloadReviewRecord,
        loadUpdate: async () => null,
        loadLatestUpdate: async () => null,
      },
    );
    dispatch({ type: 'EVIDENCE', sessionKey, evidence });
  }, [state.mode, state.stored?.id, subjectId, sessionKey, dispatch]);

  const goToEntity = async (entityId: string | null, fallbackToast: string) => {
    if (!aliveRef.current) return;
    await guard.release();
    if (!aliveRef.current) return;
    if (entityId) {
      const found = await findOwnReviewForEntity(entityId);
      if (found.status === 'found' && found.canonicalPath) return navigate(found.canonicalPath, { replace: true });
    }
    toast({ title: fallbackToast });
    navigate(props.cancelTo, { replace: true });
  };

  const handleSave = async () => {
    if (!canSubmit(state)) return;
    const v = validateForSubmit(state);
    dispatch({ type: 'VALIDATED', sessionKey, errors: v.errors });
    if (!v.ok) {
      const idx = caps.steps.findIndex((s) => (s as readonly SectionId[]).includes(v.firstInvalid!));
      if (idx >= 0) setStep(idx);
      return focusSection(v.firstInvalid);
    }
    const touched = new Set(state.questionnaireTouched);
    const built = isEdit
      ? buildEditReviewPayload({ values: state.values, stored: state.stored, questionnaireTouched: touched })
      : buildCreateReviewPayload({
          values: state.values,
          userId: props.userId,
          subjectOrigin: state.subjectOrigin === 'entity-page' ? 'entity-page' : 'user-selected',
          questionnaireTouched: touched,
        });
    if (!built.ok) {
      toast({ title: "We can't save this review yet", description: 'Please check the subject and try again.', variant: 'destructive' });
      return;
    }
    attemptRef.current = { ...built.payload } as Record<string, unknown>;
    if (attemptRef.current.metadata === undefined) delete attemptRef.current.metadata;
    dispatch({ type: 'SAVE_STARTED', sessionKey });
    uploads.send({ type: 'SAVING' });

    const write = isEdit
      ? updateReview(state.stored!.id, built.payload as never)
      : createReview(built.payload as never);
    let outcome: unknown;
    try {
      outcome = await Promise.race([
        write,
        new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), SAVE_TIMEOUT_MS)),
      ]);
    } catch (error) {
      if (!aliveRef.current) return; // left while saving: background only
      const result = isEdit ? fromUpdateReviewError(error) : fromCreateReviewError(error);
      uploads.send({ type: 'SAVE_FAILED' });
      dispatch({ type: 'SAVE_RESULT', sessionKey, result });
      if (result.status === 'existing_review' && subjectId) runExistingCheck(subjectId);
      if (result.status === 'media_retired') toast(MEDIA_RETIRED_TOAST);
      if (result.status === 'error') {
        toast({ title: "Couldn't save your review", description: 'Please try again.', variant: 'destructive' });
      }
      return;
    }
    // Left while saving: the service already emitted the background
    // "reviews changed" signal; no navigation, toast or form change.
    if (!aliveRef.current) return;
    if (outcome === TIMEOUT) {
      uploads.send({ type: 'AMBIGUOUS' });
      dispatch({ type: 'SAVE_TIMEOUT', sessionKey });
      void gatherEvidence();
      return;
    }
    uploads.send({ type: 'COMMITTED' });
    // Photos uploaded here but removed before saving are referenced by nothing.
    void Promise.allSettled(
      uploads
        .committedLeftovers(state.values.media.map((m) => m.url), (state.stored?.media ?? []).map((m) => m.url))
        .map((url) => deleteMedia(url)),
    );
    logFunnel({ event: 'review_submitted', source: 'review_form', entityType: (display?.type ?? undefined) as never });
    dispatch({ type: 'SAVE_RESULT', sessionKey, result: { status: 'ok' } });
    await goToEntity(subjectId, isEdit ? 'Your changes were saved' : 'Your review was published');
  };

  /* ---------------- leaving ---------------- */
  /** Every exit goes through here. Cleanup only ever runs for an open session. */
  const performLeave = async (action: () => void | Promise<void>) => {
    const ok = await guard.release();
    if (!ok) {
      if (aliveRef.current) toast({ title: "Couldn't leave this page — try again." });
      return;
    }
    const preexisting = (state.stored?.media ?? []).map((m) => m.url);
    const candidates = uploads.cleanupCandidates(preexisting); // [] unless open
    void Promise.allSettled(candidates.map((url) => deleteMedia(url)));
    await action();
  };
  const requestLeave = (action: () => void | Promise<void>) => {
    if (guardMode === 'clean') return void performLeave(action);
    setLeaveDialog({ mode: guardMode, action });
  };
  const requestCancel = () => requestLeave(() => navigate(props.cancelTo, { replace: true }));

  const openTimeline = (reviewId: string | null) => {
    // Step 3C — inside the gated page, a known review opens the timeline page.
    if (reviewId) {
      return requestLeave(() => navigate(`/review/${reviewId}/timeline/new`, { replace: true, state: { from: props.cancelTo } }));
    }
    if (!subjectId) return;
    const entityId = subjectId;
    requestLeave(async () => {
      setIsOpening(true);
      const r = await openExistingReviewTimelineUpdate({ entityId, expectedReviewId: reviewId, navigate });
      if (!aliveRef.current) return;
      setIsOpening(false);
      setOpenResult(r);
    });
  };

  /* ---------------- render ---------------- */
  if (state.status === 'loading') return <ComposerSkeleton />;

  const total = stepCount(state);
  const isLast = step === total - 1;
  const stepIds = caps.steps[step] as readonly SectionId[];
  const err = (id: SectionId) => state.meta[id].error;
  const showExistingNotice =
    (!isEdit && !!subjectId && existing?.entityId === subjectId && existing.state !== 'none' && step >= 1) ||
    (state.status === 'blocked' && state.blockedReason === 'existing_review');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4">
      <header className="flex items-center justify-between gap-3 py-2">
        <Button type="button" variant="ghost" onClick={requestCancel}>
          Cancel
        </Button>
        <h1 className="text-base font-semibold text-foreground">{isEdit ? 'Edit review' : 'Write a review'}</h1>
        <span className="w-16 text-right text-sm text-muted-foreground" aria-live="polite">
          {step + 1} / {total}
        </span>
      </header>
      <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>
      <p className="sr-only">Step {step + 1} of {total}: {STEP_TITLES[step]}</p>

      {showExistingNotice && (
        <ExistingNotice
          state={state.status === 'blocked' ? (existing?.state === 'error' ? 'error' : existing?.state === 'checking' ? 'checking' : 'found') : (existing!.state as 'checking' | 'found' | 'error')}
          onAdd={() => openTimeline(existing?.reviewId ?? null)}
          onCancel={requestCancel}
          onRetry={() => subjectId && runExistingCheck(subjectId)}
          isOpening={isOpening}
          openResult={openResult}
        />
      )}

      {state.status === 'blocked' && state.blockedReason === 'expired' && (
        <div role="alert" className="mb-6 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          <p className="font-medium text-foreground">The edit window has closed</p>
          <p className="text-sm text-muted-foreground">You can edit for 1 hour after publishing. Share how it's going now with a timeline update.</p>
          {subjectId && (
            <Button size="sm" onClick={() => openTimeline(state.stored?.id ?? null)} disabled={isOpening}>
              {isOpening ? 'Opening…' : 'Add timeline update'}
            </Button>
          )}
          {openResult && openResult.status !== 'opened' && <OpenError result={openResult} />}
        </div>
      )}

      {state.status === 'ambiguous' && (
        <AmbiguousPanel
          isEdit={isEdit}
          evidence={state.evidence}
          retryAllowed={state.manualRetryAllowed}
          onCheckAgain={() => void gatherEvidence()}
          onAllowRetry={() => dispatch({ type: 'ALLOW_MANUAL_RETRY', sessionKey })}
          onContinue={() => requestLeave(() => goToEntity(subjectId, isEdit ? 'Your changes were saved' : 'Your review exists'))}
        />
      )}

      <div className="min-h-[360px] space-y-6">
        {onStep(SID.rating) && (
          <div id="composer-section-rating" tabIndex={-1} className="outline-none">
            <StepOne rating={state.values.rating ?? 0} onChange={(r) => setValue('rating', r)} showError={!!err('rating')} />
          </div>
        )}

        {onStep(SID.subject) && (
          <div id="composer-section-subject" tabIndex={-1} className="outline-none space-y-2">
            <SubjectSelectStep
              subject={display}
              onSubjectChange={handleSubjectChange}
              disabled={state.subjectLocked}
              locked={state.subjectLocked && !!subjectId}
              lockedStatus="ready"
              requirement={state.subjectLocked ? 'locked' : 'required'}
              contextLine={contextLine}
              isResolvingContext={isResolvingContext}
              onAddingChange={setIsAddingSubject}
              isAdding={isAddingSubject}
            />
            {isEdit && !state.stored?.entity_id && (
              <div className="space-y-1 rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground">{state.stored?.title}</p>
                {state.stored?.venue && <p className="text-sm text-muted-foreground">{state.stored.venue}</p>}
                <p className="text-xs text-muted-foreground">The subject of a review can't be changed.</p>
              </div>
            )}
            {err('subject') && <FieldError message={err('subject')!} />}
          </div>
        )}

        {onStep(SID.media) && (
          <div id="composer-section-media" tabIndex={-1} className="w-full space-y-8 py-2 outline-none">
            <h2 className="text-center text-xl font-medium">
              Tell us about your {renderedConfig?.subjectLabel ?? 'experience'}
            </h2>

            {showLocationPrompt && locationEligible && <LocationAccessPrompt onCancel={skipLocationPrompt} className="mb-8" />}

            {subjectId && display && (
              <div className="space-y-2" data-testid="composer-subject-preview">
                <EntityPreviewCard
                  entity={{ ...display, image_url: display.image_url?.replace(/^http:\/\//i, 'https://') }}
                  type={display.type ?? ''}
                  onChange={() => {
                    /* subject changes happen on the subject step only */
                  }}
                  disableChange
                />
                {contextLine && <p className="text-sm text-muted-foreground">{contextLine}</p>}
              </div>
            )}

            {isEdit && !state.stored?.entity_id && (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="composer-legacy-title">What this review is about</Label>
                  <Input id="composer-legacy-title" value={state.stored?.title ?? ''} readOnly disabled aria-readonly="true" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="composer-legacy-venue">Where</Label>
                  <Input id="composer-legacy-venue" value={state.stored?.venue ?? ''} readOnly disabled aria-readonly="true" />
                </div>
                <p className="text-xs text-muted-foreground md:col-span-2">The subject of a review can't be changed.</p>
              </div>
            )}

            {state.values.media.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <span className="text-lg">🖼️</span>
                  <span>Your media ({state.values.media.length}/4)</span>
                </Label>
                <CompactMediaGrid
                canRemove={(m) => m.type !== 'video'} media={state.values.media} onRemove={handleMediaRemove} maxVisible={4} className="group" />
              </div>
            )}

            <div className="space-y-2">
              <Label className="mb-1 flex items-center gap-2 font-medium">
                <span className="text-lg">📸</span>
                <span>Add photos</span>
              </Label>
              <MediaUploader
                allowVideo={false}
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
                  ? `${state.values.media.length}/4 media items added - Add photos to make your review stand out`
                  : 'Add photos to make your review stand out'}
              </p>
            </div>
            {err('media') && <FieldError message={err('media')!} />}
          </div>
        )}

        {onStep(SID.text) && renderedConfig && (
          <div id="composer-section-headline" tabIndex={-1} className="outline-none">
            <StepFour
              config={renderedConfig}
              answers={{
                tags: { food_tags: state.values.foodTags },
                text: {},
                choices: state.values.questionnaire.choices,
                curated: state.values.questionnaire.curated,
              }}
              onAddTag={(fieldId, tag) =>
                fieldId === 'food_tags' &&
                !state.values.foodTags.includes(tag) &&
                setValue('foodTags', [...state.values.foodTags, tag])
              }
              onRemoveTag={(fieldId, tag) =>
                fieldId === 'food_tags' && setValue('foodTags', state.values.foodTags.filter((t) => t !== tag))
              }
              onAnswerTextChange={() => {}}
              onAnswerChoiceChange={(fieldId, value) =>
                dispatch({ type: 'SET_QUESTIONNAIRE_CHOICE', sessionKey, fieldId, value: value ?? null })
              }
              onAnswerCuratedChange={(fieldId, value) =>
                dispatch({ type: 'SET_QUESTIONNAIRE_CURATED', sessionKey, fieldId, value })
              }
              title={state.values.headline}
              onTitleChange={(v) => setValue('headline', v)}
              description={state.values.text}
              onDescriptionChange={(v) => setValue('text', v)}
              experienceDate={state.values.experienceDate ? new Date(state.values.experienceDate) : undefined}
              onExperienceDateChange={(d) => setValue('experienceDate', d.toISOString())}
              visibility={state.values.visibility}
              onVisibilityChange={(v) => setValue('visibility', v)}
            />
            {err('visibility') && <FieldError message={err('visibility')!} />}
          </div>
        )}
      </div>

      <footer className="mt-8 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || state.status === 'saving'}>
          Back
        </Button>
        {isLast ? (
          <Button type="button" onClick={handleSave} disabled={!canSubmit(state) || isUploading || subjectBlocked}>
            {state.status === 'saving' ? 'Saving…' : caps.submitLabel}
          </Button>
        ) : (
          <Button type="button" onClick={goNext} disabled={isUploading || (onStep(SID.subject) && subjectBlocked)}>
            Next
          </Button>
        )}
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

/* --------------------------------- pieces --------------------------------- */

const FieldError = ({ message }: { message: string }) => (
  <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
    <AlertCircle className="h-4 w-4" />
    {message}
  </p>
);

const OpenError = ({ result }: { result: OpenTimelineResult }) => (
  <p role="status" className="text-sm text-destructive">
    {isRetryableOpenResult(result)
      ? "We couldn't open your timeline right now. Please try again."
      : "We couldn't find your review anymore."}
  </p>
);

function ExistingNotice(p: {
  state: 'checking' | 'found' | 'error';
  onAdd: () => void;
  onCancel: () => void;
  onRetry: () => void;
  isOpening: boolean;
  openResult: OpenTimelineResult | null;
}) {
  if (p.state === 'checking') {
    return (
      <div className="mb-6 space-y-2 rounded-lg border border-border p-4" aria-busy="true">
        <span className="sr-only">Checking whether you've already reviewed this</span>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (p.state === 'error') {
    return (
      <div role="alert" className="mb-6 space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm text-foreground">We couldn't check whether you've already reviewed this. Please try again.</p>
        <Button size="sm" variant="outline" onClick={p.onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div role="alert" className="mb-6 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <div>
        <p className="font-medium text-foreground">You've already reviewed this</p>
        <p className="text-sm text-muted-foreground">Add a timeline update to share how it's going now.</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={p.onAdd} disabled={p.isOpening}>
          {p.isOpening ? 'Opening…' : 'Add timeline update'}
        </Button>
        <Button size="sm" variant="ghost" onClick={p.onCancel} disabled={p.isOpening}>
          Cancel
        </Button>
      </div>
      {p.openResult && p.openResult.status !== 'opened' && <OpenError result={p.openResult} />}
    </div>
  );
}

function AmbiguousPanel(p: {
  isEdit: boolean;
  evidence: import('../reconcile').AmbiguousSaveEvidence | null;
  retryAllowed: boolean;
  onCheckAgain: () => void;
  onAllowRetry: () => void;
  onContinue: () => void;
}) {
  const e = p.evidence;
  let title = 'Checking whether your review was saved…';
  let body: string | null = null;
  let canContinue = false;
  if (e?.status === 'candidate-found') {
    if (!p.isEdit) {
      title = 'A review for this already exists';
      body = "It may be the one you just sent. Open it to check what was saved.";
      canContinue = true;
    } else if (e.matchesAttempt) {
      title = 'Your changes were saved';
      canContinue = true;
    } else {
      title = "We couldn't confirm your changes";
      body = 'What we found differs from what you sent. Your form is kept as it is.';
    }
  } else if (e?.status === 'not-observed') {
    title = "We couldn't confirm your save";
    body = 'Nothing has shown up yet. Your form is kept as it is.';
  } else if (e?.status === 'lookup-failed') {
    title = "We couldn't check whether this saved";
    body = 'Your form is kept as it is.';
  }
  return (
    <div role="alert" className="mb-6 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <p className="font-medium text-foreground">{title}</p>
      {body && <p className="text-sm text-muted-foreground">{body}</p>}
      {e && (
        <div className="flex flex-wrap gap-2">
          {canContinue && (
            <Button size="sm" onClick={p.onContinue}>
              {p.isEdit ? 'Continue' : 'View it'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={p.onCheckAgain}>
            Check again
          </Button>
          {!canContinue && !p.retryAllowed && (
            <Button size="sm" variant="ghost" onClick={p.onAllowRetry}>
              I'll try saving again
            </Button>
          )}
          {p.retryAllowed && <p className="text-sm text-muted-foreground">Save is unlocked. Press it when you're ready.</p>}
        </div>
      )}
    </div>
  );
}

export function ComposerSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-6" aria-busy="true">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-1 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
