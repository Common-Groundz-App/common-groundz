/**
 * Phase 2.5A — honest subject-relation states for reviews.
 *
 * Plain TypeScript, no React and no UI concerns, so both services and
 * components can import it.
 *
 * The problem this solves: every review loader used to map its entity join to
 * `entity: entity ? {...} : undefined`. That single `undefined` conflated three
 * completely different situations —
 *
 *   1. the loader never queried entities at all,
 *   2. the query ran and FAILED (network / auth / transient error),
 *   3. the query succeeded and the row genuinely is not there.
 *
 * Only (3) is evidence that a subject is missing. Treating (1) or (2) as
 * "missing" makes a transient error strip the type badge off every linked
 * review on the page.
 */

export type SubjectRelation =
  /** This code path never fetched entities. Nothing is known either way. */
  | { status: 'not-loaded' }
  /** The lookup ran and errored. Nothing is known either way. */
  | { status: 'failed' }
  /** The lookup succeeded and returned a row. */
  | { status: 'resolved'; type: string; isDeleted: boolean }
  /** The lookup SUCCEEDED and returned no row for this entity_id. */
  | { status: 'absent' };

export const SUBJECT_RELATION_NOT_LOADED: SubjectRelation = { status: 'not-loaded' };
export const SUBJECT_RELATION_FAILED: SubjectRelation = { status: 'failed' };
export const SUBJECT_RELATION_ABSENT: SubjectRelation = { status: 'absent' };

/** Minimal shape a loader needs from an `entities` row to build a relation. */
export interface SubjectRelationRow {
  id: string;
  type?: string | null;
  is_deleted?: boolean | null;
}

/**
 * The outcome of a batch entity lookup, from the loader's point of view.
 *
 * `attempted: false` means the loader deliberately did not query (there were no
 * linked reviews, or the path never joins entities).
 */
export type SubjectLookupOutcome =
  | { attempted: false }
  | { attempted: true; failed: true }
  | { attempted: true; failed: false; rows: SubjectRelationRow[] };

/**
 * Map one review's `entity_id` to its relation, given the batch lookup outcome.
 *
 * A review with no `entity_id` has no relation to resolve — callers get
 * `not-loaded`, and the resolver falls back to the stored category, which is
 * the only truthful source for an unlinked legacy review.
 */
export function resolveSubjectRelation(
  entityId: string | null | undefined,
  outcome: SubjectLookupOutcome
): SubjectRelation {
  if (!entityId) return SUBJECT_RELATION_NOT_LOADED;
  if (!outcome.attempted || outcome.failed) return SUBJECT_RELATION_FAILED;
  if (!('rows' in outcome)) return SUBJECT_RELATION_NOT_LOADED;

  const row = outcome.rows.find((candidate) => candidate.id === entityId);
  if (!row) return SUBJECT_RELATION_ABSENT;

  return {
    status: 'resolved',
    type: typeof row.type === 'string' ? row.type : '',
    isDeleted: row.is_deleted === true,
  };
}

/**
 * Relation for a review rendered underneath an entity page that has ALREADY
 * resolved its entity. No query is involved — it is the same entity the page
 * is built from, so reporting it as `resolved` is honest.
 */
export function subjectRelationFromKnownEntity(type: string | null | undefined): SubjectRelation {
  return { status: 'resolved', type: typeof type === 'string' ? type : '', isDeleted: false };
}
