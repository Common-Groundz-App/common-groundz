/**
 * Central composer state: one reducer, keyed by a session key.
 *
 * Every action except START_SESSION carries the session key it was created
 * for. Actions whose key isn't the active one are dropped, so a slow load,
 * lookup, validation or save from an earlier session can never mutate the
 * current one.
 */
import { useCallback, useReducer, useState } from 'react';
import { getCapabilities, type ComposerMode } from './modes';
import {
  SECTIONS,
  hydrateValues,
  sectionAvailability,
  type HydrationRecord,
  type SectionContext,
} from './sections';
import { toBlockedReason, type BlockedReason, type ComposerServerResult } from './serverErrors';
import type { AmbiguousSaveEvidence } from './reconcile';
import {
  SECTION_IDS,
  emptyComposerValues,
  valuesEqual,
  type ComposerSubject,
  type ReviewComposerValues,
  type SectionId,
  type SectionValueMap,
  type StoredReviewRecord,
  type StoredTimelineUpdateRecord,
} from './values';
import type { SubjectOrigin } from '@/components/profile/reviews/categoryPersistence';
import type { CuratedTagAnswer } from '@/components/profile/reviews/questionnaire/curatedTagInput';
import { generateUUID } from '@/lib/uuid';

/* ------------------------------ session keys ------------------------------ */

export type ComposerSessionTarget =
  | { mode: 'create-review'; nonce: string }
  | { mode: 'edit-review'; reviewId: string }
  | { mode: 'create-timeline-update'; reviewId: string }
  | { mode: 'edit-timeline-update'; reviewId: string; updateId: string };

export function composerSessionKey(t: ComposerSessionTarget): string {
  switch (t.mode) {
    case 'create-review':
      return `create-review:${t.nonce}`;
    case 'edit-review':
      return `edit-review:${t.reviewId}`;
    case 'create-timeline-update':
      return `create-timeline-update:${t.reviewId}`;
    case 'edit-timeline-update':
      return `edit-timeline-update:${t.reviewId}:${t.updateId}`;
  }
}

/* --------------------------------- state --------------------------------- */

export type ComposerStatus = 'loading' | 'ready' | 'saving' | 'ambiguous' | 'blocked' | 'saved';

export interface SectionMeta {
  touched: boolean;
  error: string | null;
}

export interface ComposerState {
  sessionKey: string;
  mode: ComposerMode;
  status: ComposerStatus;
  blockedReason: BlockedReason | null;
  values: ReviewComposerValues;
  initial: ReviewComposerValues;
  meta: Record<SectionId, SectionMeta>;
  questionnaireTouched: string[];
  subjectOrigin: SubjectOrigin;
  subjectLocked: boolean;
  stored: StoredReviewRecord | null;
  storedUpdate: StoredTimelineUpdateRecord | null;
  lastResult: ComposerServerResult | null;
  evidence: AmbiguousSaveEvidence | null;
  /** Set only by an explicit user decision after an ambiguous save. */
  manualRetryAllowed: boolean;
}

const freshMeta = (): Record<SectionId, SectionMeta> =>
  Object.fromEntries(SECTION_IDS.map((id) => [id, { touched: false, error: null }])) as Record<SectionId, SectionMeta>;

export function initialComposerState(input: {
  sessionKey: string;
  mode: ComposerMode;
  preselectedSubject?: ComposerSubject | null;
}): ComposerState {
  const values = emptyComposerValues();
  const isCreateReview = input.mode === 'create-review';
  if (isCreateReview && input.preselectedSubject) values.subject = input.preselectedSubject;
  return {
    sessionKey: input.sessionKey,
    mode: input.mode,
    status: isCreateReview ? 'ready' : input.mode === 'create-timeline-update' ? 'ready' : 'loading',
    blockedReason: null,
    values,
    initial: structuredCloneValues(values),
    meta: freshMeta(),
    questionnaireTouched: [],
    subjectOrigin: isCreateReview ? (input.preselectedSubject ? 'entity-page' : 'none') : 'loaded',
    subjectLocked: !isCreateReview || !!input.preselectedSubject,
    stored: null,
    storedUpdate: null,
    lastResult: null,
    evidence: null,
    manualRetryAllowed: false,
  };
}

function structuredCloneValues(v: ReviewComposerValues): ReviewComposerValues {
  return JSON.parse(JSON.stringify(v)) as ReviewComposerValues;
}

/* -------------------------------- actions -------------------------------- */

type Keyed<T> = T & { sessionKey: string };

export type ComposerAction =
  | { type: 'START_SESSION'; state: ComposerState }
  | Keyed<{ type: 'HYDRATED'; record: HydrationRecord }>
  | Keyed<{ type: 'HYDRATE_FAILED'; result: ComposerServerResult }>
  | Keyed<{ type: 'SET_VALUE'; id: Exclude<SectionId, 'subject' | 'questionnaire'>; value: unknown }>
  | Keyed<{ type: 'SET_QUESTIONNAIRE_CHOICE'; fieldId: string; value: string | null }>
  | Keyed<{ type: 'SET_QUESTIONNAIRE_CURATED'; fieldId: string; value: CuratedTagAnswer }>
  | Keyed<{ type: 'SUBJECT_CHANGED'; subject: ComposerSubject | null }>
  | Keyed<{ type: 'VALIDATED'; errors: Partial<Record<SectionId, string | null>> }>
  | Keyed<{ type: 'SAVE_STARTED' }>
  | Keyed<{ type: 'SAVE_RESULT'; result: ComposerServerResult }>
  | Keyed<{ type: 'SAVE_TIMEOUT' }>
  | Keyed<{ type: 'EVIDENCE'; evidence: AmbiguousSaveEvidence }>
  | Keyed<{ type: 'ALLOW_MANUAL_RETRY' }>;

function setTyped<K extends SectionId>(values: ReviewComposerValues, id: K, value: SectionValueMap[K]) {
  return { ...values, [id]: value } as ReviewComposerValues;
}

function touch(state: ComposerState, id: SectionId): Record<SectionId, SectionMeta> {
  return { ...state.meta, [id]: { ...state.meta[id], touched: true } };
}

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  if (action.type === 'START_SESSION') return action.state;
  if (action.sessionKey !== state.sessionKey) return state; // stale — ignore

  switch (action.type) {
    case 'HYDRATED': {
      const caps = getCapabilities(state.mode);
      const values = hydrateValues(action.record, caps);
      return {
        ...state,
        status: 'ready',
        values,
        initial: structuredCloneValues(values),
        meta: freshMeta(),
        questionnaireTouched: [],
        stored: action.record.review ?? null,
        storedUpdate: action.record.update ?? null,
        subjectOrigin: action.record.review?.entity_id ? 'loaded' : state.mode.endsWith('review') ? 'none' : 'loaded',
      };
    }
    case 'HYDRATE_FAILED': {
      const reason = toBlockedReason(action.result);
      return { ...state, status: 'blocked', blockedReason: reason ?? 'not_found', lastResult: action.result };
    }
    case 'SET_VALUE': {
      if (state.status !== 'ready') return state;
      return {
        ...state,
        values: setTyped(state.values, action.id, action.value as SectionValueMap[typeof action.id]),
        meta: touch(state, action.id),
      };
    }
    case 'SET_QUESTIONNAIRE_CHOICE': {
      if (state.status !== 'ready') return state;
      const choices = { ...state.values.questionnaire.choices };
      if (action.value === null) delete choices[action.fieldId];
      else choices[action.fieldId] = action.value;
      return questionnaireTouched(state, { ...state.values.questionnaire, choices }, action.fieldId);
    }
    case 'SET_QUESTIONNAIRE_CURATED': {
      if (state.status !== 'ready') return state;
      const curated = { ...state.values.questionnaire.curated, [action.fieldId]: action.value };
      return questionnaireTouched(state, { ...state.values.questionnaire, curated }, action.fieldId);
    }
    case 'SUBJECT_CHANGED': {
      // Subject is immutable outside a fresh create session.
      if (state.subjectLocked || state.status !== 'ready') return state;
      return {
        ...state,
        values: {
          ...state.values,
          subject: action.subject,
          // Answers given for the previous subject never carry over.
          questionnaire: { choices: {}, curated: {} },
          foodTags: [],
        },
        questionnaireTouched: [],
        subjectOrigin: action.subject ? 'user-selected' : 'none',
        meta: {
          ...touch(state, 'subject'),
          questionnaire: { touched: false, error: null },
          foodTags: { touched: false, error: null },
        },
      };
    }
    case 'VALIDATED': {
      const meta = { ...state.meta };
      for (const id of SECTION_IDS) meta[id] = { ...meta[id], error: action.errors[id] ?? null };
      return { ...state, meta };
    }
    case 'SAVE_STARTED': {
      const canSave =
        state.status === 'ready' || (state.status === 'ambiguous' && state.manualRetryAllowed);
      if (!canSave) return state;
      return { ...state, status: 'saving', manualRetryAllowed: false, lastResult: null };
    }
    case 'SAVE_RESULT': {
      if (state.status !== 'saving') return state;
      if (action.result.status === 'ok') return { ...state, status: 'saved', lastResult: action.result };
      const reason = toBlockedReason(action.result);
      if (reason) return { ...state, status: 'blocked', blockedReason: reason, lastResult: action.result };
      return { ...state, status: 'ready', lastResult: action.result };
    }
    case 'SAVE_TIMEOUT': {
      if (state.status !== 'saving') return state;
      return { ...state, status: 'ambiguous', evidence: null, manualRetryAllowed: false };
    }
    case 'EVIDENCE': {
      // Evidence informs the user; it never changes status or unlocks Save.
      if (state.status !== 'ambiguous') return state;
      return { ...state, evidence: action.evidence };
    }
    case 'ALLOW_MANUAL_RETRY': {
      if (state.status !== 'ambiguous') return state;
      return { ...state, manualRetryAllowed: true };
    }
  }
}

function questionnaireTouched(
  state: ComposerState,
  questionnaire: ReviewComposerValues['questionnaire'],
  fieldId: string,
): ComposerState {
  return {
    ...state,
    values: { ...state.values, questionnaire },
    questionnaireTouched: state.questionnaireTouched.includes(fieldId)
      ? state.questionnaireTouched
      : [...state.questionnaireTouched, fieldId],
    meta: touch(state, 'questionnaire'),
  };
}

/* ------------------------------- selectors ------------------------------- */

export function sectionContextOf(state: ComposerState): SectionContext {
  return {
    caps: getCapabilities(state.mode),
    values: state.values,
    stored: state.stored,
    subjectOrigin: state.subjectOrigin,
  };
}

export function isSectionDirty(state: ComposerState, id: SectionId): boolean {
  if (sectionAvailability(id, sectionContextOf(state)) !== 'enabled') {
    // Inert sections never count — except a subject change itself.
    return false;
  }
  return !valuesEqual(state.values[id], state.initial[id]);
}

export function isComposerDirty(state: ComposerState): boolean {
  return SECTION_IDS.some((id) => isSectionDirty(state, id));
}

/** One signal for every mode: dirty values, or uploads made this session. */
export function hasUnsavedChanges(state: ComposerState, sessionUploadCount: number): boolean {
  if (state.status === 'saved') return false;
  return isComposerDirty(state) || sessionUploadCount > 0;
}

export function canSubmit(state: ComposerState): boolean {
  return state.status === 'ready' || (state.status === 'ambiguous' && state.manualRetryAllowed);
}

export { SECTIONS };

/* -------------------------------- controller ------------------------------- */

/**
 * Owns the logical session. The create-review nonce is created once here,
 * never by a child mount. `resetSession` starts a genuinely new session.
 */
export function useComposerController(target: Omit<ComposerSessionTarget, 'nonce'> & { nonce?: string }, preselectedSubject?: ComposerSubject | null) {
  const [nonce, setNonce] = useState<string>(() => target.nonce ?? generateUUID());
  const resolved = (target.mode === 'create-review' ? { mode: 'create-review', nonce } : target) as ComposerSessionTarget;
  const sessionKey = composerSessionKey(resolved);
  const [state, dispatch] = useReducer(composerReducer, undefined, () =>
    initialComposerState({ sessionKey, mode: resolved.mode, preselectedSubject }),
  );
  if (state.sessionKey !== sessionKey) {
    dispatch({
      type: 'START_SESSION',
      state: initialComposerState({ sessionKey, mode: resolved.mode, preselectedSubject }),
    });
  }
  const resetSession = useCallback(() => setNonce(generateUUID()), []);
  return { state: state.sessionKey === sessionKey ? state : initialComposerState({ sessionKey, mode: resolved.mode, preselectedSubject }), dispatch, sessionKey, resetSession };
}
