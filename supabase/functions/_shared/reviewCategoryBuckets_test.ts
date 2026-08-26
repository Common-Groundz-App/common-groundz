// Deno-side coverage for the review-category bucket mirror. Runs independently
// of Vitest so edge-function typechecking/bundling of this module is exercised.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CANONICAL_ENTITY_TYPES } from "./entityTypes.ts";
import {
  CANONICAL_TO_BUCKET,
  expandBucketsToCanonical,
  expandBucketToCanonical,
  normalizeToReviewBucket,
  REVIEW_BUCKETS,
} from "./reviewCategoryBuckets.ts";

Deno.test("every canonical type maps into exactly one bucket", () => {
  for (const t of CANONICAL_ENTITY_TYPES) {
    const bucket = CANONICAL_TO_BUCKET[t];
    assertEquals(REVIEW_BUCKETS.includes(bucket), true, `${t} → ${bucket}`);
  }
  assertEquals(Object.keys(CANONICAL_TO_BUCKET).length, CANONICAL_ENTITY_TYPES.length);
});

Deno.test("normalizeToReviewBucket is idempotent", () => {
  for (const v of [...CANONICAL_ENTITY_TYPES, ...REVIEW_BUCKETS]) {
    const once = normalizeToReviewBucket(v);
    assertEquals(normalizeToReviewBucket(once), once, `idempotent for ${v}`);
  }
});

Deno.test("normalizeToReviewBucket examples", () => {
  assertEquals(normalizeToReviewBucket("product"), "product");
  assertEquals(normalizeToReviewBucket("course"), "product");
  assertEquals(normalizeToReviewBucket("tv_show"), "movie");
  assertEquals(normalizeToReviewBucket("movie"), "movie");
  assertEquals(normalizeToReviewBucket("experience"), "place");
});

Deno.test("unknown values are dropped, never bucketed as product", () => {
  assertEquals(normalizeToReviewBucket("skincare"), null);
  assertEquals(normalizeToReviewBucket(""), null);
  assertEquals(normalizeToReviewBucket(null), null);
  assertEquals(normalizeToReviewBucket(42), null);
});

Deno.test("expandBucketToCanonical is the exact inverse", () => {
  for (const bucket of REVIEW_BUCKETS) {
    const members = expandBucketToCanonical(bucket).filter((v) =>
      (CANONICAL_ENTITY_TYPES as readonly string[]).includes(v)
    );
    const expected = CANONICAL_ENTITY_TYPES.filter((t) => CANONICAL_TO_BUCKET[t] === bucket);
    assertEquals([...members].sort(), [...expected].sort());
    // The legacy bucket value itself must remain searchable.
    assertEquals(expandBucketToCanonical(bucket).includes(bucket), true);
  }
});

Deno.test("expandBucketsToCanonical de-duplicates and passes unknowns through", () => {
  const out = expandBucketsToCanonical(["movie", "movie"]);
  assertEquals(new Set(out).size, out.length);
  assertEquals(expandBucketsToCanonical(["skincare"]), ["skincare"]);
});
