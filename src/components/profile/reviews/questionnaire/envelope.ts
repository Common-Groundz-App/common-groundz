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
import { CURATED_ID_RE, type CuratedTagAnswer } from './curatedTagInput';

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
 * Phase 7B — attribute ratings
 *
 * Draft state rides inside `choices` under composite keys
 * (`attribute_ratings:<attributeId>` → "1".."5") so it inherits the existing
 * dirty tracking, subject reset and save plumbing. Only the composite keys
 * the reviewer touched are rewritten; every other stored entry (retired ids,
 * even malformed values) is carried through untouched.
 * ------------------------------------------------------------------ */

export function attributeRatingKey(fieldId: string, attributeId: string): string {
  return `${fieldId}:${attributeId}`;
}

/** The only shape treated as a valid rating: an integer 1–5. */
export function isValidAttributeRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Valid entries only — for display and any future insight/analytics reader. */
export function readValidAttributeRatings(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isPlainMetadataObject(value)) return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (CURATED_ID_RE.test(k) && isValidAttributeRating(v)) out[k] = v;
  }
  return out;
}

function parseDraftRating(value: string | undefined): number | undefined {
  if (typeof value !== 'string' || !/^[1-5]$/.test(value)) return undefined;
  return Number(value);
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
    // Every saved curated id is kept — current ones and retired ones that are
    // still well-formed codes — even beyond the cap, so editing never drops
    // a selection. Duplicates collapse; malformed values are not rendered.
    selected: rawSelected.filter((v: unknown, i: number, arr: unknown[]): v is string =>
      typeof v === 'string' &&
      (vocabulary.includes(v) || CURATED_ID_RE.test(v)) &&
      arr.indexOf(v) === i,
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
      } else if (field.kind === 'attribute-ratings') {
        const valid = readValidAttributeRatings(stored);
        for (const attr of field.attributes ?? []) {
          if (valid[attr.id] !== undefined) {
            hydrated.choices[attributeRatingKey(field.id, attr.id)] = String(valid[attr.id]);
          }
        }
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
      if (field.kind === 'attribute-ratings') {
        const touchedAttrs = (field.attributes ?? []).filter((attr) =>
          touchedFieldIds.has(attributeRatingKey(field.id, attr.id)),
        );
        if (touchedAttrs.length === 0) continue; // byte-identical passthrough
        const existing = answers[field.id];
        const map: Record<string, unknown> = isPlainMetadataObject(existing)
          ? { ...(existing as Record<string, unknown>) }
          : {};
        for (const attr of touchedAttrs) {
          const rating = parseDraftRating(choices[attributeRatingKey(field.id, attr.id)]);
          if (rating !== undefined) map[attr.id] = rating;
          else delete map[attr.id];
        }
        if (Object.keys(map).length > 0) answers[field.id] = map;
        else delete answers[field.id];
        continue;
      }
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
