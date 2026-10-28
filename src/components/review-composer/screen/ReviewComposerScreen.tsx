import { useUnavailableComposerVideo, scrollToUnavailableMedia } from '@/hooks/useUnavailableComposerVideo';
import { UnavailableComposerVideo } from '@/components/feed/composer/UnavailableComposerVideo';
import { VideoRecheckLink } from '@/components/feed/composer/VideoRecheckLink';
/**
 * Step 3B — the full-page composer for new review / edit review.
 *
 * State, validation, steps and payloads come only from the 3A foundation
 * (store, stepEngine, saveBuilders). Only low-level inputs are reused from the
 * legacy steps; the legacy popup's orchestration is never imported.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronDown } from 'lucide-react';
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
import { ComposerMediaPreview } from '@/components/feed/composer/ComposerMediaPreview';
import { composerMuxState, isNewMuxVideo, mediaIdentity, preparedComposerMedia } from '@/utils/composerVideoReadiness';
import { LocationAccessPrompt } from '@/components/profile/reviews/LocationAccessPrompt';
import { useLocation as useLocationAccess } from '@/contexts/LocationContext';
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
import { abandonMuxUploads, flushMuxAbandonments, sessionNewMuxIds } from '@/services/muxAbandonment';
import { supabase } from '@/integrations/supabase/client';
import { useReviewVideoFlags } from '@/hooks/useAppConfig';
import { useMuxStatus } from '@/hooks/useMuxStatus';
import { MuxUploadChip } from '@/components/feed/composer/MuxUploadChip';
import { hasVideo, muxUploadIds, videoPickPolicy, videoSaveBlocker, visibilityLockReason } from '../reviewVideo';
import { getCapabilities } from '../modes';
import { getQuestionnaireContext, sectionAvailability } from '../sections';
import {
  canSubmit,
  hasUnsavedChanges,
  sectionContextOf,
  useComposerController,
} from '../store';
import { validateForSubmit } from '../stepEngine';
import { buildCreateReviewPayload, buildEditReviewPayload } from '../saveBuilders';
import { fromCreateReviewError, fromUpdateReviewError, MEDIA_RETIRED_TOAST, reviewVideoErrorMessage } from '../serverErrors';
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

/** Sections shown inside the collapsed "Add more details" area. */
const DETAIL_SECTIONS: readonly SectionId[] = ['headline', 'experienceDate', 'questionnaire', 'foodTags'];

export function ReviewComposerScreen(props: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  /* ---------------- review video (Phase 2) ---------------- */
  const videoFlags = useReviewVideoFlags();
  const storedMedia = useMemo(() => state.stored?.media ?? [], [state.stored?.media]);
  const videoIds = useMemo(() => muxUploadIds(state.values.media), [state.values.media]);
  const muxStatuses = useMuxStatus(videoIds);
  // Videos in this review's timeline updates also keep it public (Phase 1 rule).
  const [updatesHaveVideo, setUpdatesHaveVideo] = useState(false);
  const storedReviewId = isEdit ? state.stored?.id ?? null : null;
  useEffect(() => {
    if (!storedReviewId) return;
    let live = true;
    void supabase
      .from('review_updates')
      .select('media')
      .eq('review_id', storedReviewId)
      .then(({ data }) => {
        if (!live || !data) return;
        setUpdatesHaveVideo(data.some((r) => hasVideo(Array.isArray(r.media) ? (r.media as unknown as MediaItem[]) : [])));
      });
    return () => {
      live = false;
    };
  }, [storedReviewId]);
  const videoPolicy = videoPickPolicy({ ...videoFlags, visibility: state.values.visibility });
  const visibilityLocked = visibilityLockReason(state.values.media, updatesHaveVideo);
  const unavailableVideo = useUnavailableComposerVideo(state.values.media);
  const videoBlocker = videoSaveBlocker(state.values.media, storedMedia, muxStatuses);
  const videoOverlay = (m: MediaItem) => {
    const id = m.type === 'video' ? m.mux_upload_id : undefined;
    return id ? <MuxUploadChip uploadId={id} status={composerMuxState(muxStatuses[id])} /> : null;
  };

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
  const sessionMuxByUrl = useRef(new Map<string, string>());
  const handleMediaAdded = (media: MediaItem) => {
    const decision = decideFinishedUpload(uploadSid, media.url, aliveRef.current);
    uploads.recordUpload(sessionKey, media.url);
    if (media.mux_upload_id) sessionMuxByUrl.current.set(media.url, media.mux_upload_id);
    if (decision === 'add') dispatch({ type: 'MEDIA_ADDED', sessionKey, media });
    else if (decision === 'delete') {
      void deleteMedia(media.url).catch(() => undefined);
      if (media.mux_upload_id) void abandonMuxUploads([media.mux_upload_id], aliveRef.current ? 'composer_media_removed' : 'composer_discarded');
    }
  };
  const handleMediaRemove = (media: MediaItem) => {
    // Session-new uploads only; removing saved media is handled by the committed save.
    const ids = sessionNewMuxIds([media], state.stored?.media ?? []).filter((id) => [...sessionMuxByUrl.current.values()].includes(id));
    if (ids.length) void abandonMuxUploads(ids, 'composer_media_removed');
    dispatch({ type: 'MEDIA_REMOVED', sessionKey, ...mediaIdentity(media) });
  };
  const muxIdsForUrls = (urls: readonly string[]) =>
    urls.map((u) => sessionMuxByUrl.current.get(u)).filter((id): id is string => !!id);
  const reserveSlots = useCallback((n: number) => registryReserveSlots(uploadSid, n), [uploadSid]);
  const releaseSlot = useCallback(() => registryReleaseSlot(uploadSid), [uploadSid]);
  const onUploadsChange = useCallback(
    (list: MediaUploadState[]) => setIsUploading(list.some((u) => u.status === 'uploading')),
    [],
  );

  /* ---------------- location prompt (questionnaire-driven) ---------------- */
  const { permissionStatus, locationEnabled } = useLocationAccess();
  const onMediaStep = true; // single page: the media section is always shown
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
    // Fields in the details area live in one shared container.
    if (DETAIL_SECTIONS.includes(id)) setDetailsOpen(true);
    const target = DETAIL_SECTIONS.includes(id) ? 'details' : id;
    requestAnimationFrame(() => {
      const el = document.getElementById(`composer-section-${target}`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    });
  };

  // Single page: every configured review section is rendered together.
  // Step config, validation and payloads are unchanged.
  const onStep = (id: SectionId) => (caps.steps.flat() as readonly SectionId[]).indexOf(id) >= 0;

  // Parity with the popup: fires when the subject section becomes visible.
  const subjectStepVisible = onStep(SID.subject);
  useEffect(() => {
    if (subjectStepVisible) logFunnel({ event: 'review_subject_step_shown', source: 'review_form' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectStepVisible]);

  const subjectBlocked =
    !isEdit && (isAddingSubject || isResolvingContext || (!!subjectId && existing?.entityId === subjectId && existing.state !== 'none'));


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

  const saveLock = useRef(false);
  useEffect(() => { if (state.status === 'ready') saveLock.current = false; }, [state.status]);
  const handleSave = async () => {
    if (saveLock.current || !canSubmit(state) || isUploading || videoBlocker || unavailableVideo.blocked) return;
    const v = validateForSubmit(state);
    dispatch({ type: 'VALIDATED', sessionKey, errors: v.errors });
    if (!v.ok) return focusSection(v.firstInvalid);
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
    saveLock.current = true;
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
      if (unavailableVideo.handleError(error)) {
        scrollToUnavailableMedia();
        return;
      }
      if (result.status === 'existing_review' && subjectId) runExistingCheck(subjectId);
      if (result.status === 'media_retired') toast(MEDIA_RETIRED_TOAST);
      const videoMsg = result.status === 'error' ? reviewVideoErrorMessage(error) : null;
      if (videoMsg) {
        toast({ title: "Couldn't save your review", description: videoMsg, variant: 'destructive' });
      } else if (result.status === 'error') {
        const reason = (error as { code?: string } | null)?.code;
        toast({ title: "Couldn't save your review", description: reason ? `Please try again. (Reason: ${reason})` : 'Please try again.', variant: 'destructive' });
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
    const savedReview = outcome as { id: string };
    uploads.send({ type: 'COMMITTED' });
    // The returned id is preserved; readback failure never retries the insert.
    if (videoIds.length > 0) try {
      const fresh = await reloadReviewRecord(savedReview.id);
      if (!fresh) throw new Error('Saved review not readable yet');
      await queryClient.invalidateQueries({ queryKey: ['reviews'] });
      await queryClient.invalidateQueries({ queryKey: ['entity-detail'] });
    } catch {
      if (aliveRef.current) toast({ title: 'Review saved', description: 'Refresh your saved review to recheck its video. Do not publish it again.' });
    }
    if (!aliveRef.current) return;
    // Photos uploaded here but removed before saving are referenced by nothing.
    const leftovers = uploads.committedLeftovers(state.values.media.map((m) => m.url), (state.stored?.media ?? []).map((m) => m.url));
    void Promise.allSettled(leftovers.map((url) => deleteMedia(url)));
    const leftoverMux = muxIdsForUrls(leftovers);
    if (leftoverMux.length) void abandonMuxUploads(leftoverMux, 'composer_media_removed');
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
    const discardedMux = muxIdsForUrls(candidates);
    if (discardedMux.length) void abandonMuxUploads(discardedMux, 'composer_discarded');
    await flushMuxAbandonments();
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

  const err = (id: SectionId) => state.meta[id].error;
  const showExistingNotice =
    (!isEdit && !!subjectId && existing?.entityId === subjectId && existing.state !== 'none') ||
    (state.status === 'blocked' && state.blockedReason === 'existing_review');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4">
      <header className="flex items-center justify-between gap-3 py-2">
        <Button type="button" variant="ghost" onClick={requestCancel}>
          Cancel
        </Button>
        <h1 className="text-base font-semibold text-foreground">{isEdit ? 'Edit review' : 'Write a review'}</h1>
        <span className="w-16" aria-hidden="true" />
      </header>
      <div className="mb-6 h-px w-full bg-border" aria-hidden="true" />

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

        {videoBlocker && <div className="space-y-2"><p role="status" className="text-sm text-muted-foreground">{videoBlocker}</p><VideoRecheckLink active={!!videoBlocker} /></div>}

        {onStep(SID.text) && renderedConfig && (
          <section id="composer-section-text" tabIndex={-1} className="space-y-3 rounded-2xl border border-border bg-card p-4 outline-none sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Tell us about your {renderedConfig?.subjectLabel ?? 'experience'}
            </h2>
            <StepFour
              part="text"
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
              nonPublicLockedReason={visibilityLocked}
            />
            {err('text') && <FieldError message={err('text')!} />}
          </section>
        )}

        {onStep(SID.media) && (
          <div id="composer-section-media" tabIndex={-1} className="w-full space-y-6 rounded-2xl border border-border bg-card p-4 outline-none sm:p-6">

            {showLocationPrompt && locationEligible && <LocationAccessPrompt onCancel={skipLocationPrompt} className="mb-8" />}

            {state.values.media.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-medium">
                  <span className="text-lg">🖼️</span>
                  <span>Your media ({state.values.media.length}/4)</span>
                </Label>
                {unavailableVideo.blocked || state.values.media.some((m) => isNewMuxVideo(m, storedMedia)) ? (
                  <ComposerMediaPreview
                    preserveMediaOrder
                    media={preparedComposerMedia(state.values.media, storedMedia, muxStatuses)}
                    onRemove={handleMediaRemove}
                    recoveryForItem={(item) => unavailableVideo.isUnavailable(item) ? <UnavailableComposerVideo
                      item={item} media={state.values.media} sessionId={uploads.sessionId} kind="review"
                      allowVideo={videoPolicy.allowVideo} disabled={state.status !== 'ready' || isUploading}
                      onRemove={() => handleMediaRemove(item)} onUploadsChange={onUploadsChange}
                      onUploaded={(next) => { setIsUploading(false); handleMediaRemove(item); syncCommitted(uploadSid, state.values.media.length - 1); handleMediaAdded(next); }}
                    /> : null}
                    overlayForItem={videoOverlay}
                  />
                ) : (<CompactMediaGrid
                  media={state.values.media}
                  onRemove={handleMediaRemove}
                  overlayForItem={videoOverlay}
                  maxVisible={4}
                  className="group"
                />)}
              </div>
            )}

            <div className="space-y-2">
              <Label className="mb-1 flex items-center gap-2 font-medium">
                <span className="text-lg">📸</span>
                <span>{videoPolicy.allowVideo ? 'Add photos or a short video' : 'Add photos'}</span>
              </Label>
              <MediaUploader
                truthfulVideoProgress
                allowVideo={videoPolicy.allowVideo}
                videoMuxOnly
                muxKind="review"
                videoRefusedMessage={videoPolicy.reason ?? undefined}
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
              {videoPolicy.reason && (
                <p className="text-xs text-muted-foreground" data-testid="review-video-reason">{videoPolicy.reason}</p>
              )}
              {videoBlocker && (
                <p role="alert" className="text-xs text-destructive">{videoBlocker}</p>
              )}
            </div>
            {err('media') && <FieldError message={err('media')!} />}
          </div>
        )}


        {onStep(SID.text) && renderedConfig && (
          <section id="composer-section-details" tabIndex={-1} className="rounded-2xl border border-border bg-card outline-none">
            <button
              type="button"
              id="composer-details-toggle"
              aria-expanded={detailsOpen}
              aria-controls="composer-details-panel"
              onClick={() => setDetailsOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left sm:p-6"
            >
              <span className="space-y-0.5">
                <span className="block text-lg font-semibold text-foreground">Add more details</span>
                <span className="block text-sm text-muted-foreground">Headline, when you experienced it, and {renderedConfig?.subjectLabel ?? 'experience'}-specific questions — all optional</span>
              </span>
              <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
            </button>
            {/* Kept mounted so answers and in-progress inputs survive collapsing;
                `hidden` removes it from tab order and assistive tech. */}
            <div id="composer-details-panel" role="region" aria-labelledby="composer-details-toggle" hidden={!detailsOpen} className="border-t border-border p-4 sm:p-6">
              <div id="composer-section-headline" tabIndex={-1} className="outline-none">
            <StepFour
              part="details"
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
              nonPublicLockedReason={visibilityLocked}
            />
              </div>
            </div>
          </section>
        )}

        {onStep(SID.text) && renderedConfig && (
          <section id="composer-section-visibility" tabIndex={-1} className="space-y-2 rounded-2xl border border-border bg-card p-4 outline-none sm:p-6">
            <StepFour
              part="visibility"
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
              nonPublicLockedReason={visibilityLocked}
            />
            {err('visibility') && <FieldError message={err('visibility')!} />}
          </section>
        )}
      </div>

      <footer className="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button type="button" className="w-full sm:w-auto" onClick={handleSave} disabled={!canSubmit(state) || isUploading || subjectBlocked || !!videoBlocker || unavailableVideo.blocked}>
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
