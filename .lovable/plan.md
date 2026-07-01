# Fix Pack v3.3 (Final) — Modal Layout + V2-Only Logo Filtering

Final revision. Incorporates both reviewers' last-round asks: (1) tighter, budget-capped favicon fallback with HEAD→ranged-GET, (2) realistic legacy validation wording.

---

## Issue 1 — Review Draft modal clips content

Manual "Selected" pill clips right; primary action sits below the viewport.

### Fix — proper Dialog flex layout

In the dialog wrapper that renders `DraftReviewBody`:

```tsx
<DialogContent className="max-h-[85vh] flex flex-col p-0">
  <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b" />
  <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 pb-6">
    <DraftReviewBody ... footerActions={actions} />
  </div>
  <DialogFooter className="shrink-0 border-t bg-background px-6 py-3">
    {actions /* Stage 1 or Stage 2 buttons */}
  </DialogFooter>
</DialogContent>
```

- Lift Stage 1 / Stage 2 action rows out of `DraftReviewBody` into a footer slot the wrapper renders. Footer sits outside the scroll region — no "sticky inside scroll" hack.
- `pb-6` on the scroll body prevents the last field from hugging the footer border.

### BrandPicker row overflow — IN scope, styling-only

- **In scope:** `min-w-0` on flex rows, `overflow-hidden` on cards, `truncate` (or `break-all` for long URL lines) on text spans, `flex-shrink-0` on the `Selected` pill and action buttons.
- **Out of scope:** any behavior, selection logic, state, validation, or copy changes.

### Files
- `src/components/admin/entity-create/DraftReviewBody.tsx` — remove footer JSX, expose `footerActions` prop.
- Dialog wrapper mounting it (locate at build time) — apply flex layout.
- `src/components/admin/entity-create/BrandPicker.tsx` — CSS classes only on the affected rows.

---

## Issue 2 — Bad logo sources (V2-only)

**Hard scope:** all changes live inside `supabase/functions/analyze-entity-url-v2/entity_draft.ts`. Helpers defined at module top of that same file — NOT under `_shared/`, so zero possibility of a legacy caller picking them up.

### Step A — `normalizeLogoUrl(raw)` before anything else
1. Parse; reject non-`http(s)`, `data:`, `blob:`, `javascript:`.
2. Unwrap known redirect wrappers: `google.com/url?q=…`, `google.com/imgres?imgurl=…`, `share.google/…` — extract inner URL if present, else reject.
3. Strip tracking params: `srsltid`, `utm_*`, `_gl`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`. Drop `#fragment`.
4. Return cleaned URL or `null`.

### Step B — Reject only by explicit bad patterns
- Hosts: `share.google`, `encrypted-tbn[0-9].gstatic.com`, `www.bing.com/th`, `tse*.mm.bing.net`, `external-content.duckduckgo.com`, `proxy.duckduckgo.com`.
- Paths (any host): `/s2/favicons`, `/imgres`, `/url`, `/thumbnail`, `/thumb?`, `/proxy?`.
- **Not** blanket-blocked: bare `gstatic.com`, bare `googleusercontent.com` — only their search/proxy sub-hosts.

### Step C — Accept path (priority order)
1. Same-origin as candidate `websiteUrl` (both normalized) → trusted, accept.
2. Source is one of `official_site`, `firecrawl`, `page_metadata`, `open_food_facts` → trusted, accept.
3. Otherwise accept if: image-like extension (`.png/.jpg/.jpeg/.webp/.svg/.avif/.gif/.ico`) OR extractor-reported `content-type: image/*`. Missing both → soft reject.

Extension is a positive signal, never the sole gate.

### Step D — Dedupe on the normalized URL
Move image/logo dedupe to run on the normalized form so `logo.png?srsltid=A` and `logo.png?srsltid=B` collapse to one.

### Step E — Reject behavior
- On reject: set `logoUrl = undefined` on the candidate (32px placeholder slot handles the blank).
- Candidate itself is preserved.
- `console.log(JSON.stringify({ event: 'v2_logo_rejected', reason, rawHost }))` server-side only.
- **No** new field on `BrandCandidate` — public wire contract unchanged.

### Step F — Own-origin favicon fallback (tightly bounded)

Applies **only to the top 1 candidate** that survived without a `logoUrl` and has a normalized `websiteUrl` whose host isn't rejected.

**Single global budget:** 2 seconds for the entire Analyze run's favicon work. Implemented with one `AbortController` created before the fallback stage and `signal`-passed to every probe. When it aborts, whatever hasn't resolved is dropped and the candidate stays blank.

**Probe order (all racing against the same abort signal):**
1. `HEAD https://<host>/apple-touch-icon.png`
2. `HEAD https://<host>/favicon.ico`
3. If either HEAD returns `405 / 403 / 501` or a non-image / missing `content-type`: retry that same URL with a **ranged GET** (`Range: bytes=0-511`) to sniff the response — accept if status is `200/206` and `content-type` starts with `image/`.

All probes run in parallel via `Promise.all` on `[apple-touch, favicon]` × `[HEAD, rangedGET-on-fallback]`. First image-verified 2xx wins; anything still pending when the 2s budget expires is aborted and dropped.

Never call `google.com/s2/favicons`. Never persist an unverified favicon URL.

### Files
- `supabase/functions/analyze-entity-url-v2/entity_draft.ts` — add helpers, apply in the brand-candidate loop, move dedupe onto normalized URL, run bounded HEAD/ranged-GET fallback for the top candidate only.

### Explicitly NOT touched
- `supabase/functions/enrich-brand-data/**`
- `supabase/functions/fetch-url-metadata-lite/**`
- `supabase/functions/_shared/**`
- Legacy pipeline, Stage 2 image grid, `ImageCandidateGrid`, `ExtraImageInput`, host form, any other dialog.

---

## Validation

1. Sub-800px viewport: modal footer always visible, "Selected" pill unclipped, long URL doesn't force horizontal scroll.
2. Re-run the Axis-Y URL: previous `share.google/...` logo is now blank with placeholder.
3. If `axis-y.com` is the website: own-origin `/apple-touch-icon.png` or `/favicon.ico` attaches within 2s; site with neither leaves logo blank without stalling the modal.
4. Same product image with two different `srsltid` values → deduped to one candidate.
5. **Legacy smoke test:** flip pipeline feature flag to legacy, analyze one URL, confirm response returns successfully. `git diff` confirms zero changes under `enrich-brand-data/`, `fetch-url-metadata-lite/`, `_shared/`.
6. Server logs show `v2_logo_rejected` entries with reasons; frontend Network tab confirms no new fields on the draft payload.
7. Timing: analyze the same URL 3× and confirm P95 duration does not increase by more than ~2s vs. pre-patch.

## Out of scope
Legacy pipeline, image grid, new logo providers, BrandPicker behavior changes, schema/type extensions to `BrandCandidate`.
