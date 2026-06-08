## Firecrawl Recovery QA Pass (pre-Phase 8)

Goal: verify the deterministic Firecrawl recovery is actually following its own contract on the Nykaa-class URL before layering Phase 8 (Gemini merge) on top. Driven entirely by **sanitized parser diagnostics** — never raw scraped content.

Scope: `supabase/functions/analyze-entity-url-v2/` only. No V1, DB, fetcher, extractor, Gemini, response-envelope, or frontend changes (except a possibly-separate image-fallback ticket — see Step 4).

---

### Logging discipline (applies everywhere)

**Never log in production:** markdown previews, metadata values, metadata keys, product names, descriptions, image URLs, price values, page URLs, headers, API keys, Gemini prompts/outputs.

**Safe to log:** booleans, integer byte sizes, key *counts*, durations, deterministic enum-like source labels (`"markdown_h1"`, `"metadata_title"`, …), and our own internal type enum (`"product"`, `"book"`, …).

Raw inspection, if ever needed, happens in the Firecrawl playground or a local Deno run — never in production Edge logs.

---

### Step 1 — Add sanitized observability (one deploy, combined)

**Files:** `supabase/functions/analyze-entity-url-v2/index.ts`, `firecrawl_recovery.ts`.

#### 1a. Success log
On both Firecrawl recovery-success branches in `index.ts`:
```ts
console.log("[analyze-entity-url-v2] firecrawl recovery succeeded", {
  html_present: fc.html.length > 0,
  markdown_present: fc.markdown !== null,
  metadata_present: fc.metadata !== null,
  html_bytes: fc.html.length,
  markdown_bytes: fc.markdown?.length ?? 0,
  metadata_key_count: fc.metadata ? Object.keys(fc.metadata).length : 0,
  durationMs: fc.durationMs,
  recovered_type: predictions?.type ?? null,
});
```

#### 1b. Parser-source diagnostics
Inside `extractFromFirecrawl`, compute:
```ts
interface FirecrawlRecoveryDiagnostics {
  name_source: "markdown_h1" | "metadata_title" | null;
  markdown_h1_found: boolean;
  markdown_h1_within_main_region: boolean;
  markdown_price_found: boolean;
  metadata_price_found: boolean;
  price_conflict: boolean;            // both present, >5% delta
  selected_price_source: "metadata" | "markdown" | "omitted" | "none";
  image_source: "metadata_og_image" | "markdown_image" | null;
  image_present: boolean;
}
```

`index.ts` logs them on the same recovery-success branches:
```ts
console.log("[analyze-entity-url-v2] firecrawl recovery diagnostics", diag);
```

#### 1c. Critical: diagnostics must NOT leak into the V2 response envelope

The current `ExtractMetadata` shape is serialized to clients via `metadata.extract`. Diagnostics must therefore live on a **separate sibling object**, never on `ExtractMetadata`.

Change `extractFromFirecrawl`'s return type from `ExtractResult` to:
```ts
{ result: ExtractResult, diagnostics: FirecrawlRecoveryDiagnostics }
```

Update the two call sites in `index.ts` to destructure and log `diagnostics` while passing `result` onward unchanged. No new field on `ExtractMetadata`. No diagnostics in the JSON response.

Ship 1a + 1b + 1c in **one deploy**.

---

### Step 2 — Re-run Nykaa, read logs

Re-run `https://www.nykaa.com/dior-homme-intense-eau-de-parfum-intense/p/950905?skuId=768775` via the AI Analysis modal. Read Edge logs. The two log lines together answer:

- Was markdown preserved end-to-end? → `markdown_present`, `markdown_bytes`
- Why did og:title beat the H1? → `markdown_h1_found`, `markdown_h1_within_main_region`, `name_source`
- Why did price 14900 win? → `markdown_price_found`, `metadata_price_found`, `price_conflict`, `selected_price_source`
- Where did the image come from? → `image_source`, `image_present`

---

### Step 3 — Data-driven fixes (only what diagnostics prove)

Decided after Step 2. Mutually exclusive paths:

- **A. `markdown_present: false`** → markdown wiring broken. Verify `firecrawl.ts` still requests `formats: ["html","markdown"]` and that `index.ts` passes `fc.markdown` into `extractFromFirecrawl`. No regex changes.
- **B. `markdown_present: true` but `markdown_h1_found: false` or `markdown_h1_within_main_region: false`** → widen `MAIN_REGION_BYTES` (4 KB → 8 KB) and/or relax `firstH1` to skip leading non-H1 noise lines. Synthesized fixture in `firecrawl_recovery_test.ts`.
- **C. `markdown_price_found: false`** while real markdown contained the price → extend `firstMarkdownPrice` to accept `Rs\.?\s?` and `Price[:\s]+(?:₹|Rs\.?)?\s?` lead-ins. Keep the ≤5% conflict rule intact. Synthesized fixture.
- **D. Everything matches the contract** → screenshot was stale, no logic change.

Fixtures are synthesized to model the diagnostic signal — no raw captured markdown pasted into the repo.

---

### Step 4 — Image investigation (kept split per Codex)

Do **not** mix with Step 3 deploy.

- **Backend half** (already answered by Step 2): if `image_present: false` or `image_source: null` while metadata was present, og:image was malformed / rejected by `safeAbsoluteUrl`. Fix in `firecrawl_recovery.ts` (optionally prefer `firstMarkdownImage` when og:image fails). Ship as its own small backend deploy.
- **Frontend half**: only if the backend-returned URL opens standalone in a browser but the AI Analysis modal still renders broken. Then a separate frontend ticket: add `onError` placeholder fallback, prevent 0×0 collapse. Located via `rg "image_url" src/components` in build mode. Not bundled with backend work.

---

### Step 5 — Validate, deploy, then trim

1. `supabase--test_edge_functions analyze-entity-url-v2` — all green.
2. Deploy whichever subset of `index.ts` / `firecrawl_recovery.ts` / `firecrawl.ts` actually changed.
3. Re-run Nykaa. Confirm via diagnostics that name / price / image now follow the contract.
4. **Review log verbosity:** keep the Step 1a success log permanent (cheap, always useful). Step 1b parser diagnostics — keep if still cheap and likely to help future debugging, otherwise trim to a minimal permanent summary (e.g. just `name_source`, `selected_price_source`, `image_source`).
5. Hand off to Phase 8 with a clean deterministic baseline.

---

### Out of scope (explicitly)

- V1 (Gemini URL grounding).
- Phase 8 Gemini merge — separate plan after this ships.
- V2 response envelope shape, `extractor.ts`, `fetcher.ts`, SSRF, Gemini client.
- Any DB migration.
- Loosening the 5% price-conflict rule.
- Logging any raw scraped content, ever.

### Technical summary

- `firecrawl_recovery.ts`: new `FirecrawlRecoveryDiagnostics` interface; change return type of `extractFromFirecrawl` to `{ result: ExtractResult, diagnostics: FirecrawlRecoveryDiagnostics }`; compute the diagnostic fields inline as the existing logic already chooses each source. No change to `ExtractMetadata`. Possible Step 3 region/regex tweak conditional on data. Possible Step 4 image fallback conditional on data.
- `index.ts`: update the two `extractFromFirecrawl` call sites to destructure `{ result, diagnostics }`; add two `console.log` lines per recovery-success branch (success log + diagnostics). No response-shape change.
- `firecrawl.ts`: likely no change. Only touched if Step 3 path A applies.
- `firecrawl_recovery_test.ts`: existing tests updated for new return shape (`r.predictions` becomes `r.result.predictions`, etc.); +1–3 synthesized fixture tests covering whichever Step 3 path activated.
- Frontend: zero changes unless Step 4 backend confirms a frontend-only issue, in which case a separate small ticket.
- `.lovable/plan.md`: replaced with this plan's summary on completion.
