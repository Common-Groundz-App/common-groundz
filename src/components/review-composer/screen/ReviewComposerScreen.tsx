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
import StepOne from '@/components/profile/reviews/steps/StepOne';
import SubjectSelectStep from '@/components/profile/reviews/steps/SubjectSelectStep';
import StepFour from '@/components/profile/reviews/steps/StepFour';
import { MediaUploader } from '@/components/media/MediaUploader';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';
import type { EntityAdapter } from '@/components/profile/circles/types';
import type { QuestionnaireConfig } from '@/components/profile/reviews/questionnaire/registry';
import type { MediaItem } from '@/types/media';
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
import { fromCreateReviewError, fromUpdateReviewError } from '../serverErrors';
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
      onPickAnother?: never;
    }
  | {
      mode: 'edit-review';
      userId: string;
      loaded: LoadedReview;
      cancelTo: string;
    };

type ExistingCheck = { entityId: string; state: 'checking' | 'found' | 'none' | 'error'; reviewId: string | null };

const SID = { rating: 'rating', subject: 'subject', media: 'media', text: 'text' } as const satisfies Record<string, SectionId>;

const STEP_TITLES = ['Rating', 'Subject', 'Photos', 'Details'];

export function ReviewComposerScreen(props: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
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
  const [confirmLeave, setConfirmLeave] = useState(false);
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
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

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

  const handleMediaAdded = (media: MediaItem) => {
    uploads.recordUpload(sessionKey, media.url);
    setValue('media', [...state.values.media, { ...media, order: state.values.media.length }]);
  };
  const handleMediaRemove = (media: MediaItem) =>
    setValue('media', state.values.media.filter((m) => m.url !== media.url));

  /* ---------------- step navigation ---------------- */
  const focusSection = (id: SectionId | null) => {
    if (!id) return;
    requestAnimationFrame(() => document.getElementById(`composer-section-${id}`)?.focus());
  };

  const onStep = (id: SectionId) => (caps.steps[step] as readonly SectionId[]).indexOf(id) >= 0;

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
      const result = isEdit ? fromUpdateReviewError(error) : fromCreateReviewError(error);
      uploads.send({ type: 'SAVE_FAILED' });
      dispatch({ type: 'SAVE_RESULT', sessionKey, result });
      if (result.status === 'existing_review' && subjectId) runExistingCheck(subjectId);
      if (result.status === 'error') {
        toast({ title: "Couldn't save your review", description: 'Please try again.', variant: 'destructive' });
      }
      return;
    }
    if (outcome === TIMEOUT) {
      uploads.send({ type: 'AMBIGUOUS' });
      dispatch({ type: 'SAVE_TIMEOUT', sessionKey });
      void gatherEvidence();
      return;
    }
    uploads.send({ type: 'COMMITTED' });
    dispatch({ type: 'SAVE_RESULT', sessionKey, result: { status: 'ok' } });
    await goToEntity(subjectId, isEdit ? 'Your changes were saved' : 'Your review was published');
  };

  /* ---------------- leaving ---------------- */
  const leave = async () => {
    const preexisting = (state.stored?.media ?? []).map((m) => m.url);
    const candidates = uploads.cleanupCandidates(preexisting);
    // Best-effort; never blocks leaving.
    void Promise.allSettled(candidates.map((url) => deleteMedia(url)));
    navigate(props.cancelTo);
  };
  const requestCancel = () => (dirty && state.status !== 'saved' ? setConfirmLeave(true) : void leave());

  const openTimeline = async (reviewId: string | null) => {
    if (!subjectId) return;
    setIsOpening(true);
    const r = await openExistingReviewTimelineUpdate({ entityId: subjectId, expectedReviewId: reviewId, navigate });
    setIsOpening(false);
    setOpenResult(r);
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
          onContinue={() => void goToEntity(subjectId, isEdit ? 'Your changes were saved' : 'Your review exists')}
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
          <div id="composer-section-media" tabIndex={-1} className="outline-none space-y-4">
            <h2 className="text-center text-xl font-medium">
              Tell us about your {renderedConfig?.subjectLabel ?? 'experience'}
            </h2>
            {contextLine && <p className="text-center text-sm text-muted-foreground">{contextLine}</p>}
            <MediaUploader
              sessionId={uploads.sessionId}
              onMediaUploaded={handleMediaAdded}
              initialMedia={state.values.media}
              maxMediaCount={4}
              onUploadsChange={(list: unknown[]) => setIsUploading(Array.isArray(list) && list.length > 0)}
            />
            <CompactMediaGrid media={state.values.media} onRemove={handleMediaRemove} />
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
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          void leave();
        }}
        title={isEdit ? 'Discard your changes?' : 'Discard this review?'}
        description="Your changes will not be saved."
        variant="destructive"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
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
