// Phase 2 — Offline helper tests for create-brand-entity.
// No network, no Supabase, no auth. Pure logic only.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { shouldBackfillLogo, normalizeBrandSlug } from "./helpers.ts";

// ─── shouldBackfillLogo ──────────────────────────────────────────────────

Deno.test("shouldBackfillLogo: true when existing is null, logo present, shouldWrite true", () => {
  assertEquals(shouldBackfillLogo(null, "https://cdn/x.png", true), true);
});

Deno.test("shouldBackfillLogo: true when existing is empty string", () => {
  assertEquals(shouldBackfillLogo("", "https://cdn/x.png", true), true);
});

Deno.test("shouldBackfillLogo: false when shouldWrite is false", () => {
  assertEquals(shouldBackfillLogo(null, "https://cdn/x.png", false), false);
});

Deno.test("shouldBackfillLogo: false when logo is empty", () => {
  assertEquals(shouldBackfillLogo(null, "", true), false);
});

Deno.test("shouldBackfillLogo: false when logo is not a string", () => {
  assertEquals(shouldBackfillLogo(null, undefined, true), false);
  assertEquals(shouldBackfillLogo(null, null, true), false);
  assertEquals(shouldBackfillLogo(null, 123 as unknown, true), false);
});

Deno.test("shouldBackfillLogo: false when existing image is already set", () => {
  assertEquals(
    shouldBackfillLogo("https://cdn/old.png", "https://cdn/new.png", true),
    false,
  );
});

// ─── normalizeBrandSlug ──────────────────────────────────────────────────

Deno.test("normalizeBrandSlug: lowercases and hyphenates spaces", () => {
  assertEquals(normalizeBrandSlug("Cetaphil Gentle Cleanser"), "cetaphil-gentle-cleanser");
});

Deno.test("normalizeBrandSlug: strips special characters", () => {
  assertEquals(normalizeBrandSlug("BABE Laboratorios!"), "babe-laboratorios");
  assertEquals(normalizeBrandSlug("L'Oréal"), "l-or-al");
});

Deno.test("normalizeBrandSlug: collapses multiple separators", () => {
  assertEquals(normalizeBrandSlug("axis--y"), "axis-y");
  assertEquals(normalizeBrandSlug("a   b"), "a-b");
});

Deno.test("normalizeBrandSlug: trims leading/trailing hyphens", () => {
  assertEquals(normalizeBrandSlug("---brand---"), "brand");
  assertEquals(normalizeBrandSlug("!!brand!!"), "brand");
});

Deno.test("normalizeBrandSlug: stable across whitespace variants", () => {
  const a = normalizeBrandSlug("  Chemist  at  Play  ");
  const b = normalizeBrandSlug("chemist at play");
  assertEquals(a, b);
});

Deno.test("normalizeBrandSlug: handles non-string input gracefully", () => {
  assertEquals(normalizeBrandSlug(undefined as unknown as string), "");
  assertEquals(normalizeBrandSlug(null as unknown as string), "");
});
