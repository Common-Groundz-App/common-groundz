# Fix Pack v2: duplicate false-positives + brand logo cropping

Applying ChatGPT's revisions. Both fixes stay narrowly scoped.

---

## Issue 1 — "Did you mean one of these?" shows unrelated maccaron products

**Root cause** (`supabase/functions/check-entity-duplicates/index.ts`):

- Step 4 ("Same website") uses `ilike('%host%')` — hostname-only match, so every `maccaron.in` product looks like a duplicate of every other one.
- Step 5 has a fallback that adds low-confidence "Created from same site" hits based on hostname alone, and even its strict branch uses only `host + first-path-segment`. Maccaron URLs all start with `/en`, so the "strict" branch is also noise.

**Fix**:

- **`normalizeFullUrl(url)`** helper: lowercase host, strip `www.`, drop `#hash` + `?query`, drop trailing `/`. Return `null` on parse failure.
- **Step 4** — replace host-only match with **exact normalized full-URL equality**:
  - Query `entities` by `website_url ilike '%host%'` to shrink the set, then in JS keep only rows where `normalizeFullUrl(r.website_url) === normalizeFullUrl(body.websiteUrl)`. Reason label stays "Same website", score 0.85.
- **Step 5** — remove entirely:
  - Both the 0.6 "Created from same site" fallback and the 0.8 "host + first-path-segment" branch are unreliable for retailer URLs (`/en/products/...` collides across brands).
  - The legitimate signal — same source URL exactly — is already covered by extending step 5's replacement to also compare `normalizeFullUrl(metadata.created_from_url) === normalizeFullUrl(body.sourceUrl)` when `sourceUrl` is present. Same 0.8 score, label "Created from same source URL". No path-prefix branch, no host-only fallback.
- **Steps 1 (name similarity), 2 (slug), 3 (slug history), 6 (api_source+api_ref) — unchanged.**
- Parent-boost logic unchanged.

Result: Medicube pore pad no longer surfaces S.NATURE / Axis-Y. Re-submitting the exact same maccaron URL still triggers a duplicate. URL variants with `?utm=...`, `#frag`, or trailing `/` still normalize-match.

---

## Issue 2 — Medicube logo is cropped on entity page

Wide brand marks get cropped by `object-cover` on a square tile — correct for product photos, wrong for logos.

**Fix** in `src/components/entity-v4/EntityHeader.tsx` (line 167):

- When `entity.type === 'brand'`, use `object-contain bg-muted`. All other types keep `object-cover` untouched.

Explore search dropdown: **not changed in this pass** — the user hasn't confirmed it looks broken there for other brands. If they later spot the same cropping in the dropdown for a brand row, we'll apply the identical `type === 'brand' ? contain : cover` conditional to that component only.

---

## Files changed

- `supabase/functions/check-entity-duplicates/index.ts` — add `normalizeFullUrl`; rewrite step 4 to exact full-URL equality; delete step 5's path-prefix branch and 0.6 fallback, replace with exact full-URL match on `metadata.created_from_url` when `body.sourceUrl` is provided.
- `src/components/entity-v4/EntityHeader.tsx` — conditional `object-contain bg-muted` for brand entities on line ~167.

## Not touched

- Analyze pipeline (v1/v2), brand_logo_lookup, entity_draft, BrandPicker, DraftReviewBody, DuplicateConfirmDialog UI, migrations, RLS, other entity cards, explore dropdown component, name-similarity / slug / api-ref duplicate paths.

## Validation

- Analyze Medicube pore pad → duplicate dialog does not appear (or only shows genuine name matches).
- Submit the same maccaron URL twice → duplicate dialog shows the first entity as "Same website" (via `website_url`) or "Created from same source URL" (via `metadata.created_from_url`).
- Same URL with `?utm_source=x` or trailing `/` → still matches after normalization.
- Medicube entity page header → full "medicube BEAUTY" logo visible, letterboxed against neutral background.
- Any product entity page → image still fills tile via `object-cover` (unchanged).
