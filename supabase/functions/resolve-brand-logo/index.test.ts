// Phase 2 — Offline helper tests for resolve-brand-logo.
// No network, no Supabase, no auth. Pure logic only.

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  normalizeBrand,
  checkRateLimit,
  buildFlagOffResponse,
  buildRateLimitedResponse,
  RATE_LIMIT_PER_HOUR,
  RATE_WINDOW_MS,
} from "./helpers.ts";

// ─── normalizeBrand ──────────────────────────────────────────────────────

Deno.test("normalizeBrand: lowercases and strips non-alphanumeric", () => {
  assertEquals(normalizeBrand("AXIS-Y"), "axisy");
  assertEquals(normalizeBrand("L'Oréal"), "loral");
  assertEquals(normalizeBrand("BABE Laboratorios!"), "babelaboratorios");
});

Deno.test("normalizeBrand: same output for equivalent inputs", () => {
  assertEquals(normalizeBrand("Axis Y"), normalizeBrand("axis_y"));
  assertEquals(normalizeBrand("axis.y"), normalizeBrand("AXISY"));
});

Deno.test("normalizeBrand: handles non-string input", () => {
  assertEquals(normalizeBrand(undefined as unknown as string), "");
  assertEquals(normalizeBrand(null as unknown as string), "");
});

// ─── checkRateLimit ──────────────────────────────────────────────────────

Deno.test("checkRateLimit: allows first hit", () => {
  assertEquals(checkRateLimit("u1", [], Date.now()), true);
});

Deno.test("checkRateLimit: allows under the limit", () => {
  const now = Date.now();
  const hits = Array.from({ length: RATE_LIMIT_PER_HOUR - 1 }, () => now - 1000);
  assertEquals(checkRateLimit("u1", hits, now), true);
});

Deno.test("checkRateLimit: blocks at the limit", () => {
  const now = Date.now();
  const hits = Array.from({ length: RATE_LIMIT_PER_HOUR }, () => now - 1000);
  assertEquals(checkRateLimit("u1", hits, now), false);
});

Deno.test("checkRateLimit: ignores hits outside the rolling hour", () => {
  const now = Date.now();
  const old = Array.from({ length: RATE_LIMIT_PER_HOUR + 5 }, () => now - RATE_WINDOW_MS - 1000);
  assertEquals(checkRateLimit("u1", old, now), true);
});

Deno.test("checkRateLimit: mixes old and recent hits correctly", () => {
  const now = Date.now();
  const hits = [
    ...Array.from({ length: RATE_LIMIT_PER_HOUR }, () => now - RATE_WINDOW_MS - 5_000), // old
    ...Array.from({ length: RATE_LIMIT_PER_HOUR - 1 }, () => now - 1_000),               // recent
  ];
  assertEquals(checkRateLimit("u1", hits, now), true);
});

// ─── response builders ───────────────────────────────────────────────────

Deno.test("buildFlagOffResponse: exact shape", () => {
  assertEquals(buildFlagOffResponse(), {
    logoUrl: null,
    source: "none",
    cached: false,
    skipReason: "flag_off",
  });
});

Deno.test("buildRateLimitedResponse: exact shape", () => {
  assertEquals(buildRateLimitedResponse(), {
    logoUrl: null,
    source: "none",
    cached: false,
    skipReason: "rate_limited",
  });
});
