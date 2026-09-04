/**
 * Phase 3C Stage 2 — THE review-metadata save path.
 *
 * This is the single function that turns the review form's visible state into
 * the `reviews.metadata` value sent to the database. `ReviewForm` calls it on
 * submit and nothing else builds that object, so a verification harness that
 * calls this function is exercising the real persistence code rather than a
 * copy of it. Pure: no React, no network.
 */
import { mergeReviewMetadata } from './metadata';
import {
  buildQuestionnairePatch,
  QUESTIONNAIRE_METADATA_KEY,
  type EnvelopePatch,
  type EnvelopeRead,
} from './envelope';
import type { QuestionnaireConfig } from './registry';
import type { CuratedTagAnswer } from './curatedTagInput';

export interface BuildReviewMetadataInput {
  /** Metadata currently stored on the row (undefined for a brand new review). */
  storedMetadata: unknown;
  config: QuestionnaireConfig;
  /** Value this same save writes to `reviews.category`. */
  category: string;
  /** False in compatibility mode — no envelope is created, updated or destroyed. */
  questionnaireWritable: boolean;
  /** Envelope read for the category being saved. */
  effectiveEnvelope: EnvelopeRead;
  /** Envelope read for the row as stored (used by the subject-reset path). */
  storedEnvelope: EnvelopeRead;
  choices: Record<string, string>;
  curated: Record<string, CuratedTagAnswer>;
  touchedFieldIds: ReadonlySet<string>;
  foodTags: string[];
  /** True when `entity_id` changed during this editing session. */
  questionnaireReset: boolean;
}

export interface BuildReviewMetadataResult {
  metadata: Record<string, unknown> | undefined;
  envelopePatch: EnvelopePatch;
}

export function buildReviewMetadataForSave({
  storedMetadata,
  config,
  category,
  questionnaireWritable,
  effectiveEnvelope,
  storedEnvelope,
  choices,
  curated,
  touchedFieldIds,
  foodTags,
  questionnaireReset,
}: BuildReviewMetadataInput): BuildReviewMetadataResult {
  const hasFoodTagsField = config.sections.some((s) =>
    s.fields.some((f) => f.id === 'food_tags'),
  );

  /**
   * Field-level dirty patching. Untouched keys — including fields this build
   * cannot render — are carried through byte-identical; clearing the last
   * answer removes the envelope entirely.
   */
  const envelopePatch: EnvelopePatch = questionnaireWritable
    ? buildQuestionnairePatch({
        read: effectiveEnvelope,
        category,
        config,
        choices,
        curated,
        touchedFieldIds,
      })
    : { action: 'none' };

  const metadataPatch: Record<string, unknown> = {};
  if (hasFoodTagsField) metadataPatch.food_tags = foodTags;
  if (envelopePatch.action === 'write') {
    metadataPatch[QUESTIONNAIRE_METADATA_KEY] = envelopePatch.envelope;
  }

  const removeKeys: string[] = [];
  if (envelopePatch.action === 'remove') removeKeys.push(QUESTIONNAIRE_METADATA_KEY);
  if (questionnaireReset) {
    if (storedEnvelope.status !== 'absent') removeKeys.push(QUESTIONNAIRE_METADATA_KEY);
    if (!hasFoodTagsField) removeKeys.push('food_tags');
  }

  /**
   * Metadata is MERGED, never replaced — writing a fresh object here used to
   * wipe provenance and every other stored key on a food edit.
   */
  const metadata = mergeReviewMetadata(
    storedMetadata,
    Object.keys(metadataPatch).length > 0 ? metadataPatch : undefined,
    removeKeys,
  );

  return { metadata, envelopePatch };
}
