// Phase 2.1 — allow-lists for the funnel telemetry endpoint, extracted so they
// are testable on their own (Deno tests) instead of living inside `serve`.
//
// Privacy contract is unchanged: no raw query text ever enters this endpoint.
// Only enumerated event/source/type values and numeric or boolean diagnostics.

import { CANONICAL_ENTITY_TYPES } from "../_shared/entityTypes.ts";

export const ALLOWED_EVENTS = new Set([
  // Search-to-Draft (Phase 3.5c)
  "search_run",
  "candidate_pick",
  "review_opened",
  "entity_created",
  // Review subject selection (Phase 2.1 / 2.4)
  "review_subject_step_shown",
  "review_subject_selected",
  "review_subject_attached_late",
  "review_submitted",
  // Phase 2.4 — subject requirement enforcement telemetry.
  "review_subject_legacy_unlinked",
  "review_subject_type_divergence",
  // Phase 2.3 — quick-create subject drawer inside the review form.
  "subject_create_started",
  "subject_create_completed",
  "subject_create_duplicate_exact",
  "subject_create_duplicate_possible",
]);

export const ALLOWED_SOURCES = new Set([
  "search",
  "existing_match",
  // Phase 2.1 — the review form wizard.
  "review_form",
]);

/**
 * Legacy 8-value list kept intact so existing surfaces keep logging, plus the
 * 15 canonical entity types used by review subjects.
 */
export const ALLOWED_ENTITY_TYPES = new Set<string>([
  "product",
  "brand",
  "place",
  "book",
  "movie",
  "food",
  "app",
  "tv",
  ...CANONICAL_ENTITY_TYPES,
]);

export const FORBIDDEN_PAYLOAD_KEYS = ["query", "q", "raw", "text", "prompt"];

/** Clamp a query LENGTH (never the query itself) into a sane integer range. */
export function clampQueryLength(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(512, Math.round(value)));
}
