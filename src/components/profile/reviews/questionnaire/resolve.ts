/**
 * Phase 3A — questionnaire resolution. Three explicit, separate modes:
 *
 *  - `canonical`       — linked subject whose type parses to a canonical type.
 *  - `legacy-unlinked` — review with no `entity_id` (pre-Phase-2.4 rows only).
 *  - `invalid`         — linked subject whose type does NOT parse. This is an
 *                        INVARIANT FAILURE, not a presentation case: the subject
 *                        is unusable. It must never fall back to product /
 *                        others / generic, and it must block the wizard.
 *
 * Pure module: no React, no network.
 */
import { parseEntityTypeAtBoundary, type CanonicalEntityType } from '@/services/entityType';
import {
  LEGACY_UNLINKED_QUESTIONNAIRE,
  QUESTIONNAIRE_REGISTRY,
  type QuestionnaireConfig,
} from './registry';

export type QuestionnaireResolution =
  | { mode: 'canonical'; type: CanonicalEntityType; config: QuestionnaireConfig }
  | { mode: 'legacy-unlinked'; config: QuestionnaireConfig }
  | { mode: 'invalid'; rawType: string | null };

export interface ResolveQuestionnaireInput {
  /** The subject currently attached to the review, if any. */
  entityId: string | null | undefined;
  /** The subject's raw type string, as it arrived from the DB / search. */
  subjectType: unknown;
}

export function resolveQuestionnaire({
  entityId,
  subjectType,
}: ResolveQuestionnaireInput): QuestionnaireResolution {
  if (!entityId) {
    return { mode: 'legacy-unlinked', config: LEGACY_UNLINKED_QUESTIONNAIRE };
  }

  const canonical = parseEntityTypeAtBoundary(subjectType);
  if (!canonical) {
    return {
      mode: 'invalid',
      rawType: typeof subjectType === 'string' && subjectType.trim() ? subjectType : null,
    };
  }

  return { mode: 'canonical', type: canonical, config: QUESTIONNAIRE_REGISTRY[canonical] };
}

/** A linked-but-unparseable subject can never be published or navigated past. */
export function blocksSubmission(resolution: QuestionnaireResolution): boolean {
  return resolution.mode === 'invalid';
}

export function invalidSubjectMessage(resolution: QuestionnaireResolution): string | null {
  if (resolution.mode !== 'invalid') return null;
  return resolution.rawType
    ? `We can't review this subject yet (unsupported type "${resolution.rawType}"). Go back and pick a different one.`
    : "We can't review this subject yet. Go back and pick a different one.";
}
