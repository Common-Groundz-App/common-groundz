# v8d (revised) — CSE fallback for non-Vertex rows, gated

Both reviewers approved v8d with the same refinements: keep source naming as `google_images`, update the admin label, add stronger eligibility for non-Vertex rows, add `hostClass` telemetry, keep Firecrawl OFF. Merged below, plus two small guards I'd add.

## Root cause (confirmed by logs)

Non-Vertex rows like `cetaphil.com` fail because:
- `direct` fetch returns 200,
- `extractImage` finds no `og:image` / `twitter:image` / JSON-LD image,
- CSE step exits with `skipReason: "not_vertex_host"`.

Firecrawl would not help this class — the tags aren't there. CSE with brand+name context is the right fallback.

## Changes

### 1. `supabase/functions/enrich-candidate-image/index.ts`

- Remove the Vertex-only gate on CSE. New trigger — CSE runs when ALL are true:
  - `cseEnabled` flag ON
  - `winningAttempt` is still null after direct + soft-redirect + clean-URL retry (+ Firecrawl if it ran)
  - `buildCseQuery` returns `{ reason: "ok" }` (already requires ≥2 alphanumeric tokens; for non-Vertex we additionally require **brand present OR name length ≥ 3 tokens** to avoid burning quota on vague rows)
  - CSE not disabled / not quota-throttled
- **Source naming stays as-is** — the existing code already emits `source: "google_images"`, `method: "google_cse"`, `winningAttempt: "google_cse"`. No rename. (`applyEntityDraft.ts` and `ImageCandidateGrid.tsx` are already aligned to `google_images`.)
- Replace `skipReason: "not_vertex_host"` with the real reason (`no_usable_query`, `quota_throttled`, `budget_exhausted`, `flag_off`, `cse_disabled`, `already_have_image`).
- Keep existing validation and ranking unchanged: `assertSafeUrl`, `isValidPageImageUrl`, logo/banner/favicon/SVG filter, MIME `image/*` probe, tiny-image reject, low-trust host penalty, brand+name relevance score.

### 2. Telemetry (same log line, added fields)

Add to every `cseAttempt`:
- `hostClass: "vertex" | "other"`
- `cseUsed: boolean` (true when we actually called the API, false for cache/skip)
- `cseAdopted: boolean` (true when `winningAttempt === "google_cse"`)
- `selectedImageHost: string | null` (host only, no path/query)

Kept: `queryHashPrefix`, `resultCount`, `cached`, `quotaThrottled`, `skipReason`.
Never logged: raw query text, full image URLs.

### 3. Admin UI — `AdminFeatureFlagsPanel.tsx`

Update label + description for the CSE toggle only (no schema, no new flag):
- Label: **Google image search fallback**
- Description: *When ON, Search-to-Draft rows with no page-owned image may fall back to Google Custom Search Images. Auto-applied with a "From image search — verify" chip. Uses the existing Google CSE daily quota.*

### 4. Frontend

No changes. `SearchEntryPanel.tsx` row thumbnail already picks `page_metadata > firecrawl > google_images` and shows the verify chip (v8c). `ImageCandidateGrid.tsx` ranking already includes `google_images`.

## Admin flag guidance for testing

- Firecrawl fallback: **OFF**
- Google image search fallback: **ON**

## Verification

Rerun with CSE ON, Firecrawl OFF:
- `cetaphil gentle cleanser` → non-Vertex rows should render CSE thumbnails with verify chip. Logs: `hostClass:"other"`, `cseUsed:true`, `resultCount>0`, `winningAttempt:"google_cse"`.
- `chemist at play roll on` → Vertex path unchanged, `hostClass:"vertex"`.
- `babe laboratorios healthy aging serum` → Vertex path unchanged.
- Real product pages with valid `og:image` → still win via `page_metadata`, no CSE call (`skipReason:"already_have_image"` never appears because we short-circuit before entering the CSE branch).

Watch:
- Daily CSE count in logs; if non-Vertex burns quota quickly, tighten the non-Vertex gate (e.g. require brand present) — no redeploy of flags needed, just code.
- `cseAdopted` rate per `hostClass` — this tells us whether non-Vertex CSE is actually useful or mostly returning noise.

## Out of scope

- Firecrawl-for-all. Revisit only when logs show a specific JS-rendered non-Vertex host that Firecrawl demonstrably resolves.
- New feature flag for non-Vertex CSE. One flag is enough; the code-level eligibility gate is the safety net.
- Any change to page-metadata extraction, ranking, verify chip, proxy allowlist.

## Files touched

- `supabase/functions/enrich-candidate-image/index.ts` — remove Vertex-only gate, add eligibility guard, add telemetry fields.
- `src/components/admin/AdminFeatureFlagsPanel.tsx` — CSE toggle label + description.

Nothing else changes. No schema, no new flag, no frontend rendering edits.
