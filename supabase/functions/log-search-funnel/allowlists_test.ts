import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CANONICAL_ENTITY_TYPES } from "../_shared/entityTypes.ts";
import {
  ALLOWED_ENTITY_TYPES,
  ALLOWED_EVENTS,
  ALLOWED_SOURCES,
  clampQueryLength,
  FORBIDDEN_PAYLOAD_KEYS,
} from "./allowlists.ts";

Deno.test("review subject events are accepted", () => {
  for (
    const e of [
      "review_subject_step_shown",
      "review_subject_selected",
      "review_subject_attached_late",
      "review_submitted",
      "review_subject_legacy_unlinked",
      "review_subject_type_divergence",
    ]
  ) {
    assertEquals(ALLOWED_EVENTS.has(e), true, e);
  }
});

Deno.test("existing search-to-draft events still accepted", () => {
  for (const e of ["search_run", "candidate_pick", "review_opened", "entity_created"]) {
    assertEquals(ALLOWED_EVENTS.has(e), true, e);
  }
  assertEquals(ALLOWED_EVENTS.has("anything_else"), false);
});

Deno.test("review_form source accepted alongside legacy sources", () => {
  assertEquals(ALLOWED_SOURCES.has("review_form"), true);
  assertEquals(ALLOWED_SOURCES.has("search"), true);
  assertEquals(ALLOWED_SOURCES.has("existing_match"), true);
  assertEquals(ALLOWED_SOURCES.has("reviews"), false);
});

Deno.test("all 15 canonical entity types accepted, legacy values retained", () => {
  for (const t of CANONICAL_ENTITY_TYPES) {
    assertEquals(ALLOWED_ENTITY_TYPES.has(t), true, t);
  }
  // Legacy value that is not canonical must still be accepted.
  assertEquals(ALLOWED_ENTITY_TYPES.has("tv"), true);
});

Deno.test("raw text keys remain forbidden", () => {
  assertEquals(FORBIDDEN_PAYLOAD_KEYS.includes("query"), true);
  assertEquals(FORBIDDEN_PAYLOAD_KEYS.includes("q"), true);
  assertEquals(FORBIDDEN_PAYLOAD_KEYS.includes("prompt"), true);
});

Deno.test("clampQueryLength clamps and rejects non-numbers", () => {
  assertEquals(clampQueryLength(12), 12);
  assertEquals(clampQueryLength(-5), 0);
  assertEquals(clampQueryLength(10_000), 512);
  assertEquals(clampQueryLength("cetaphil"), null);
  assertEquals(clampQueryLength(undefined), null);
});
