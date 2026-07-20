Both reviewers agree with the diagnosis and the direction. I'm folding in their two important refinements (host-only structured proxy logs; don't broaden the proxy allowlist) plus a couple of small hardening items I noticed while reading the code.

## Root cause (confirmed)

- Backend v8c is working: `cseEnabled:true`, Vertex rows skip direct fetch, Google CSE returns 5 images, `google_cse` wins.
- The row thumbnail in `SearchEntryPanel.tsx` still only accepts `source === 'page_metadata'`, so `google_images` results are dropped and the row shows initials.
- Separately, `proxy-external-image` blocked a valid product CDN (`images-static.nykaa.com`) that appeared in logs, so even the auto-applied image after "Apply to form" can fail to render.

## Changes

1. **Row thumbnail priority in `SearchEntryPanel.tsx`**
   - Select the row image using: `page_metadata` > `firecrawl` > `google_images` / `google_cse` > initials.
   - Keep `google_grounding` excluded from the row thumbnail (unreliable).
   - Preserves the existing enrichment loading skeleton + overlay behavior.

2. **"From image search — verify" chip on the row**
   - Show a small chip next to the row metadata only when the chosen row image's source is `google_images` / `google_cse`.
   - Matches the label already used in the Draft Review image picker.

3. **Draft Review picker (verify no regression)**
   - `ImageCandidateGrid.tsx` already ranks `page_metadata` > `firecrawl` > `google_images` > `google_grounding` and shows the verify chip. No change needed; just confirm auto-selected primary still prefers page metadata when present.

4. **Proxy allowlist — narrow addition only**
   - Add `images-static.nykaa.com` to `ALLOWED_DOMAINS` in `proxy-external-image` (observed valid product CDN).
   - Do NOT broaden the proxy or auto-trust CSE hosts. Future hosts get added deliberately after logs confirm.

5. **Structured, host-only proxy diagnostics**
   - Replace the current full-URL log with a structured JSON line: `{ source: "image_proxy", host, status, reason, contentType? }`.
   - `reason` values: `domain_not_allowed`, `fetch_failed`, `non_image_content_type`, `timeout`, `unhandled`.
   - No query strings, no full URLs. Makes the next blocked CDN obvious without leaking data.

6. **Small hardening in `ImageWithFallback.tsx` (row image resilience)**
   - Keep current proxy-then-direct fallback behavior. No behavior change unless a broken image is seen — then it correctly falls back to initials via the existing `brokenUrls` tracker upstream in `ImageCandidateGrid`. For `SearchEntryPanel`, on image error we already have initials as the empty state; nothing to add.

## Admin flag guidance during testing

- Firecrawl fallback: OFF
- Google CSE fallback (Vertex rows): ON

Vertex rows will skip Firecrawl entirely and go straight to CSE. Firecrawl stays available for future JS-rendered retailer pages.

## Files touched

- `src/components/admin/entity-create/SearchEntryPanel.tsx` — row image selection + verify chip.
- `supabase/functions/proxy-external-image/index.ts` — add one host + structured host-only logs.

Nothing else changes. No schema, no flag, no backend enrichment logic.

## Verification after deploy

Rerun the three searches:
- `babe laboratorios healthy aging serum` — Vertex rows should render `google_images` thumbnails with the verify chip.
- `chemist at play roll on` — same behavior; duplicated Vertex rows still show at most one CSE image per row.
- `cetaphil gentle cleanser` — thumbnails only if `page_metadata` succeeds (non-Vertex path unchanged in this phase).

Check logs:
- `enrich-candidate-image`: `winningAttempt: "google_cse"` continues to succeed.
- `proxy-external-image`: previously-failing hosts should either succeed or emit a structured `domain_not_allowed` line with `host: "..."` so we can decide next additions.