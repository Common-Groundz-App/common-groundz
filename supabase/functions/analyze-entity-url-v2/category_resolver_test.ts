// Phase 8: category_resolver.ts unit tests (offline).

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { resolveCategory } from "./category_resolver.ts";

Deno.test("resolveCategory: suggested path maps to root (Product → product)", () => {
  const r = resolveCategory({ type: "product", suggested_category_path: "Product" });
  assertEquals(r.matched_category_name, "Products");
  assertEquals(r.category_id, null);
});

Deno.test("resolveCategory: TVSeries → tv_show root", () => {
  const r = resolveCategory({ type: "tv_show", suggested_category_path: "TVSeries" });
  assertEquals(r.matched_category_name, "TV Shows");
});

Deno.test("resolveCategory: fallback to type when path is null (recovery path)", () => {
  const r = resolveCategory({ type: "book", suggested_category_path: null });
  assertEquals(r.matched_category_name, "Books");
});

Deno.test("resolveCategory: unknown path falls back to type", () => {
  const r = resolveCategory({ type: "place", suggested_category_path: "some.unknown.thing" });
  assertEquals(r.matched_category_name, "Places");
});

Deno.test("resolveCategory: total miss returns both null", () => {
  const r = resolveCategory({ type: null, suggested_category_path: null });
  assertEquals(r, { category_id: null, matched_category_name: null });
});

Deno.test("resolveCategory: unverified snapshot entries return category_id null", () => {
  // All snapshot entries currently store category_id: null (unverified).
  const r = resolveCategory({ type: "product", suggested_category_path: null });
  assertEquals(r.category_id, null);
  assertEquals(r.matched_category_name, "Products");
});
