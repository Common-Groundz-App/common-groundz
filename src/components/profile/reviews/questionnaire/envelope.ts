/**
 * Phase 3C Stage 2 — the `metadata.questionnaire` envelope.
 *
 * Pure module: no React, no network. This is the ONLY place that decides what is
 * written into `reviews.metadata.questionnaire`, and it mirrors the strictness of
 * the Stage 1 SQL resolver exactly:
 *
 *   - `version` is the JSON NUMBER `1` (the string `"1"` is malformed);
 *   - `type` strictly equals `reviews.category` (never a display resolver);
 *   - `answers` is a plain object; unanswered fields are OMITTED, never `""`,
 *     `null` or `[]`.
 *
 * Field-level dirty tracking: only fields the user actually edited are rewritten.
 * Every untouched key — including fields this build cannot render (future
 * versions of the matrix, unknown tag ids) — is carried through byte-identical.
 * The whole `answers` object is never replaced.
 */
import { isPlainMetadataObject } from './metadata';
import type { QuestionnaireConfig } from './registry';
import { CURATED_TAG_VOCABULARIES, type CuratedTagSet } from './vocabularies';
import type { CuratedTagAnswer } from './curatedTagInput';

export const QUESTIONNAIRE_VERSION = 1;
export const QUESTIONNAIRE_METADATA_KEY = 'questionnaire';

export type StoredAnswers = Record<string, unknown>;

export type EnvelopeRead =
  /** No `metadata.questionnaire` at all. */
  | { status: 'absent' }
  /** A v1 envelope whose `type` matches `reviews.category`. */
  | { status: 'valid'; answers: StoredAnswers }
  /**
   * Present but not readable by this build (wrong version, type mismatch,
   * malformed). NEVER rendered and NEVER destroyed — carried through untouched.
   */
  | { status: 'incompatible' };

export function readQuestionnaireEnvelope(
  metadata: unknown,
  category: string | null | undefined,
): EnvelopeRead {
  if (!isPlainMetadataObject(metadata)) return { status: 'absent' };
  const raw = (metadata as Record<string, unknown>)[QUESTIONNAIRE_METADATA_KEY];
  if (raw === undefined || raw === null) return { status: 'absent' };
  if (!isPlainMetadataObject(raw)) return { status: 'incompatible' };

  const envelope = raw as Record<string, unknown>;
  // Strict numeric version — `"1"` is malformed, exactly as the SQL resolver says.
  if (typeof envelope.version !== 'number' || envelope.version !== QUESTIONNAIRE_VERSION) {
    return { status: 'incompatible' };
  }
  if (typeof envelope.type !== 'string' || !category || envelope.type !== category) {
    return { status: 'incompatible' };
  }
  if (!isPlainMetadataObject(envelope.answers)) return { status: 'incompatible' };

  return { status: 'valid', answers: envelope.answers as StoredAnswers };
}

/* ------------------------------------------------------------------ *
 * Hydration — stored values → renderable answers
 * ------------------------------------------------------------------ */

export interface HydratedAnswers {
  choices: Record<string, string>;
  curated: Record<string, CuratedTagAnswer>;
}

function hydrateCurated(value: unknown, tagSet: CuratedTagSet): CuratedTagAnswer {
  if (!isPlainMetadataObject(value)) return { selected: [], custom: [] };
  const vocabulary = CURATED_TAG_VOCABULARIES[tagSet].map((t) => t.value);
  const rawSelected = Array.isArray((value as any).selected) ? (value as any).selected : [];
  const rawCustom = Array.isArray((value as any).custom) ? (value as any).custom : [];
  return {
    // Grandfathered: every RECOGNIZED value is rendered, even beyond the cap.
    // Unrecognized ids are not rendered; they survive because an untouched
    // field is written back byte-identical.
    selected: rawSelected.filter((v: unknown): v is string =>
      typeof v === 'string' && vocabulary.includes(v),
    ),
    // Custom entries are shown intact — never truncated, never re-cased.
    custom: rawCustom.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0),
  };
}

/** Builds the renderable answer state for the fields this config declares. */
export function hydrateQuestionnaireAnswers(
  read: EnvelopeRead,
  config: QuestionnaireConfig,
): HydratedAnswers {
  const hydrated: HydratedAnswers = { choices: {}, curated: {} };
  if (read.status !== 'valid') return hydrated;

  for (const section of config.sections) {
    for (const field of section.fields) {
      const stored = read.answers[field.id];
      if (field.kind === 'single-choice') {
        const allowed = (field.options ?? []).map((o) => o.value);
        if (typeof stored === 'string' && allowed.includes(stored)) {
          hydrated.choices[field.id] = stored;
        }
      } else if (field.kind === 'tags' && field.tagSet && field.tagSet !== 'food') {
        hydrated.curated[field.id] = hydrateCurated(stored, field.tagSet);
      }
    }
  }
  return hydrated;
}

/* ------------------------------------------------------------------ *
 * Patch building — renderable answers → stored envelope
 * ------------------------------------------------------------------ */

export interface BuildEnvelopePatchInput {
  /** Result of reading the CURRENTLY stored envelope for this review. */
  read: EnvelopeRead;
  /** The value that will be written to `reviews.category` by this same save. */
  category: string;
  config: QuestionnaireConfig;
  choices: Record<string, string>;
  curated: Record<string, CuratedTagAnswer>;
  /** Field ids the user actually edited during this editing session. */
  touchedFieldIds: ReadonlySet<string>;
}

export type EnvelopePatch =
  /** Leave `metadata.questionnaire` exactly as it is. */
  | { action: 'none' }
  /** Write this envelope. */
  | { action: 'write'; envelope: { version: number; type: string; answers: StoredAnswers } }
  /** Delete the key entirely — absent keeps its honest meaning. */
  | { action: 'remove' };

function serializeCurated(answer: CuratedTagAnswer): StoredAnswers | undefined {
  const out: StoredAnswers = {};
  if (answer.selected.length > 0) out.selected = [...answer.selected];
  if (answer.custom.length > 0) out.custom = [...answer.custom];
  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildQuestionnairePatch({
  read,
  category,
  config,
  choices,
  curated,
  touchedFieldIds,
}: BuildEnvelopePatchInput): EnvelopePatch {
  // Compatibility mode: an envelope this build cannot read is never created,
  // updated or destroyed.
  if (read.status === 'incompatible') return { action: 'none' };
  if (touchedFieldIds.size === 0) return { action: 'none' };

  const answers: StoredAnswers =
    read.status === 'valid' ? { ...read.answers } : {};

  for (const section of config.sections) {
    for (const field of section.fields) {
      if (!touchedFieldIds.has(field.id)) continue; // byte-identical passthrough

      if (field.kind === 'single-choice') {
        const value = choices[field.id];
        const allowed = (field.options ?? []).map((o) => o.value);
        if (typeof value === 'string' && allowed.includes(value)) {
          answers[field.id] = value;
        } else {
          delete answers[field.id];
        }
      } else if (field.kind === 'tags' && field.tagSet && field.tagSet !== 'food') {
        const serialized = serializeCurated(curated[field.id] ?? { selected: [], custom: [] });
        if (serialized) answers[field.id] = serialized;
        else delete answers[field.id];
      }
    }
  }

  if (Object.keys(answers).length === 0) {
    // Nothing left — including no untouched/unknown field to preserve.
    return read.status === 'valid' ? { action: 'remove' } : { action: 'none' };
  }

  return {
    action: 'write',
    envelope: { version: QUESTIONNAIRE_VERSION, type: category, answers },
  };
}

/**
 * Whether this build may create or update an envelope at all.
 *
 * The DB validates `metadata.questionnaire.type === reviews.category`, so the
 * client writes that exact value. A linked review whose subject type disagrees
 * with the stored category is in compatibility mode: questions are not offered
 * and no envelope is written.
 */
export function isQuestionnaireWritable(
  category: string | null | undefined,
  subjectCanonicalType: string | null | undefined,
): boolean {
  if (!category) return false;
  if (!subjectCanonicalType) return false;
  return category === subjectCanonicalType;
}
