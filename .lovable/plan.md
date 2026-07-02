# V2 Brand Logo Lookup — Option B (revised, top-5 website eval, V2-only)

Scope: `supabase/functions/analyze-entity-url-v2/brand_logo_lookup.ts` only. Legacy (`enrich-brand-data`, `fetch-url-metadata-lite`, analyze-entity-url v1) is not touched. No public shape or frontend changes.

## 1. Website resolution — evaluate top 5 CSE results (not just rank 1)

Rewrite `findOfficialBrandWebsite` so the top-N (N = 5, matching current `num=5`) results are all considered:

1. **Score every result** with the existing `scoreWebsiteResult`. Preserve original CSE rank (1–5) for telemetry.
2. **Hard-reject** (regardless of score) any result whose hostname or path falls into a block bucket:
   - Hostname or apex-domain matches `MAJOR_MARKETPLACES`, `BEAUTY_RETAILERS`, `SOCIAL_MEDIA`, `REVIEW_SITES`, or `AGGREGATOR_HOSTS`.
   - Subdomain of a known marketplace (`*.amazon.*`, `*.ebay.*`, `*.walmart.*`, etc.).
   - Path is a product/listing page: `/product`, `/products/`, `/p/`, `/item`, `/pd/`, `/dp/`, `/sku`, `/collections/`, `/catalog/`, `/shop/`, `/store/`.
   - Log with reason enum: `blocked_retailer` | `blocked_social` | `blocked_review` | `blocked_aggregator` | `blocked_marketplace_subdomain` | `blocked_product_path`.
3. **Sort survivors** by score desc; on ties prefer the shorter hostname (fewer labels; secondary tiebreak = shorter full string). Rationale: `medicube.us` beats `shop.medicube.us` / `medicube.co.kr`.
4. **Acceptance** walks the sorted survivors:
   - First survivor with `score >= 10` → accept (tier `"high"`).
   - Else first survivor with `score >= 6` AND `isBrandOwnedDomain(host, brand)` → accept (tier `"medium"`).
   - Else return `null`.
5. `isBrandOwnedDomain(host, brand)`: take the first hostname label (`domainBase`), compare against `normalizeBrandName(brand)`:
   - exact match, `brand + s`, `brand - s`, `official-<brand>` / `<brand>-official`, `get<brand>`, `<brand>hq`, `<brand>cosmetics`, `<brand>beauty` → true.
   - Combined with the score-≥-6 gate this admits `medicube.us` even when its CSE title lacks the word "official".

This fixes Medicube: rank 1 (Maccaron / retailer) is rejected as `blocked_retailer`, rank 2 (`medicube.us`) is accepted.

## 2. Site-scoped logo search — unchanged, still preferred

`"{brand}" logo site:{officialHost}` remains phase 1 when a website is resolved. Scoring unchanged.

## 3. Broad fallback query — simplified

Replace the current `"{brand}" official brand logo -site:{host} -product -buy -shop` and `transparent png` variants with a single query: `"{brand}" brand logo`. Legacy still runs its own richer broad queries — we're not touching that path.

## 4. Broad fallback runs only if site-scoped fails

After scoring the site-scoped batch, walk candidates in score order through the caller's `filter(...)`. If any survivor has `score > 0`, return it and skip broad entirely. Broad runs only when:
- No website was resolved, OR
- Site-scoped produced zero filter-surviving candidates with `score > 0`.

## 5. V2 filters — unchanged

All existing v3.3 filters remain active via the caller-provided `filter(...)` closure: `share.google`, `google.com/url`, `encrypted-tbn*.gstatic.com`, `/s2/favicons`, `/imgres`, proxy hosts, non-image URLs, `srsltid`/UTM stripping. No new filter code inside this module.

## 6. Session cache — cache negatives too

The per-Analyze cache already stores accepted website URLs. Extend to also cache `null` under the same key (`normalizeBrandName(brand) + '|' + host`) when website resolution returns `null`. Prevents a second candidate with the same normalized brand in one Analyze from re-issuing CSE just to be rejected again. Applied wherever the cache currently lives (no relocation).

## 7. Validation telemetry (server-side `console.log`, no PII, no full URLs)

Add / extend inside `brand_logo_lookup.ts`:

- `v2_brand_website_evaluated` — `{ brand, count }` once per resolution.
- `v2_brand_website_candidate` — `{ rank, host, score, tier: "high"|"medium"|"none" }` per top-5 result.
- `v2_brand_website_rejected` — `{ rank, host, score, reason: "blocked_retailer"|"blocked_social"|"blocked_review"|"blocked_aggregator"|"blocked_marketplace_subdomain"|"blocked_product_path"|"low_score"|"not_brand_owned" }` per rejected result.
- `v2_brand_website_accepted` — `{ rank, host, score, tier }` when a survivor is chosen.
- `v2_brand_logo_phase` — `{ phase: "site_scoped"|"broad"|"none", ok, score }` once per resolved logo.
- Keep existing `v2_brand_logo_quota_exhausted`.

Log only hostname (never full URL), integer rank, numeric score, and reason enum.

## 8. Explicitly NOT changed

- `enrich-brand-data/*`, `fetch-url-metadata-lite/*`, `analyze-entity-url` v1 — untouched.
- `entity_draft.ts` — untouched except for the negative-cache line if the cache lives there.
- `pickTopBrandCandidate`, retailer suppression, 4 s global budget, feature flag `entity_extraction.v2_brand_logo_lookup_enabled`, own-origin favicon fallback — unchanged.
- `BrandCandidate` shape, migrations, frontend — unchanged.
- `scoreWebsiteResult` / `scoreLogoImage` formulas — unchanged; only the acceptance gate around `scoreWebsiteResult` changes.

## 9. Validation

1. Re-analyze `maccaron.in/.../medicube_...`:
   - `v2_brand_website_evaluated { count: 5 }`.
   - `v2_brand_website_rejected { rank: 1, host: "maccaron.in", reason: "blocked_retailer" }`.
   - `v2_brand_website_accepted { rank: 2|3, host: "medicube.us", tier: "high"|"medium" }`.
   - `v2_brand_logo_phase { phase: "site_scoped", ok: true }`; broad phase does not run.
   - Final logo comes from `medicube.us`.
2. Brand with no brand-owned site in top 5 → all rejected, `null` returned, broad fallback runs `"{brand}" brand logo`.
3. Top 5 contains both `brand.com` (score 12) and `shop.brand.com` (score 12) → tiebreak picks `brand.com`.
4. Second candidate with same normalized brand in one Analyze → negative-cache hit, no duplicate CSE call.
5. Google 429 → `v2_brand_logo_quota_exhausted` still fires; Analyze completes.
6. `git diff` shows changes only in `brand_logo_lookup.ts` (and one cache-key line in `entity_draft.ts` if that's where the map lives).
