# analyze-entity-url-v2

**Status:** Phase 5 — deterministic exact-page extraction.

## What this is

A brand-new, isolated edge function that will eventually replace
`analyze-entity-url` (V1). Phase 4B introduces a safe HTTP fetcher
(`validateAndFetchUrl`) and wires it into the handler. V2 now performs
**one safe fetch operation** per Analyze call, which may issue **up to
`1 + maxRedirects` HTTP requests** internally (default: up to 4). The
response still carries `predictions: null` and `method: 'stub'` — no
extraction yet.

## What this is NOT (Phase 4B)

- **No extraction.** Body is fetched and discarded; `predictions: null`.
- No Gemini, no Firecrawl, no exact-page extraction.
- No category matching, no brand creation, no image extraction.
- No DB reads/writes, no RPC calls beyond admin check, no new secrets.
- Does not import anything from `supabase/functions/analyze-entity-url/`.

## Auth model (matches V1)

`supabase/config.toml` sets `verify_jwt = false` for this function so we can
return our own CORS-safe error envelope. Auth is enforced manually:

| Scenario | Status | Code |
|---|---|---|
| Admin + valid public http(s) URL, fetch OK | 200 | success envelope (with `metadata.fetch`) |
| Non-admin authenticated user | 403 | `NOT_ADMIN` |
| Missing `Authorization` header | 401 | `MISSING_AUTH` |
| Invalid / expired bearer token | 401 | `INVALID_TOKEN` |
| Non-POST request | 405 | `METHOD_NOT_ALLOWED` |
| Body is not JSON | 400 | `INVALID_JSON` |
| Body fails Zod validation | 400 | `INVALID_URL` (with `details`) |
| URL has userinfo / private IP / blocked host / blocked port | 400 | `BLOCKED_HOST` |
| DNS unavailable in runtime | 503 | `DNS_RESOLUTION_FAILED` |
| DNS lookup hard-fails | 400/503 | `DNS_RESOLUTION_FAILED` |
| Fetch total budget exceeded | 504 | `FETCH_TIMEOUT` |
| Response body > maxBytes | 413 | `FETCH_TOO_LARGE` |
| More than `maxRedirects` hops | 400 | `FETCH_TOO_MANY_REDIRECTS` |
| Non-HTML content type | 415 | `FETCH_BAD_CONTENT_TYPE` |
| Upstream non-2xx | 502 | `FETCH_BAD_STATUS` |
| Generic network error | 502 | `FETCH_NETWORK_ERROR` |
| Unhandled exception | 500 | `INTERNAL_ERROR` |

## SSRF rules (preflight + per-redirect re-check)

`ssrf.ts` exposes `normalizeUrl` and `assertSafeUrl`. `fetcher.ts` invokes
`assertSafeUrl` on the initial URL **and on every redirect target**.
Normalization, port allowlist, hostname suffix blocklist, IP-literal blocks
(v4 + v6), and DNS A/AAAA checks are unchanged from Phase 4A — see
`ssrf.ts` for the full rule set.

## Phase 4B — safe fetch helper

- V2 transitions from **stub-only → safe-fetch-only**. Still no extraction.
- V2 performs **one safe fetch operation** per call, which may issue
  **up to `1 + maxRedirects` HTTP requests** internally (default: up to 4).
- `validateAndFetchUrl` requires `resolveDns`. The production handler
  enforces it — if `Deno.resolveDns` is missing in the runtime, the handler
  returns `503 DNS_RESOLUTION_FAILED` **before any fetch**. The Phase-4A
  `dns_check_skipped` warning is **gone in Phase 4B** and MUST NOT appear
  in production responses.

### Timeout model — single total budget

- `timeoutMs` is a **single total budget** covering preflight DNS, every
  redirect-hop DNS re-check, request headers, and full body streaming.
  **Default 8000ms. No per-hop reset.**
- Implementation: one `AbortController` started at the top; its `signal` is
  passed to every `fetchImpl()` call. **Body-stream timeout is enforced by
  an explicit `withDeadline` / `readWithDeadline` race around
  `reader.read()`** — not by relying on `AbortSignal` propagating into the
  stream. This guarantees the budget is honored even when a stream ignores
  the signal entirely (e.g. a `ReadableStream` with a never-resolving
  `pull()`).
- Preflight timeout maps to `FETCH_TIMEOUT` (not `DNS_RESOLUTION_FAILED`):
  the resolver didn't fail, the operation ran out of time. Internal
  `reason` values (`preflight_timeout`, `redirect_preflight_timeout`,
  `body_stream_timeout`) aid diagnostics but are **never exposed to clients**.

### Privacy

- **`bodyText` and `redirectChain` are internal-only.** They live on
  `FetchResult` for Phase-5 consumers but are **never** returned in the API
  response and **never** logged.
- Error responses include `code` + a generic human message only — no raw
  upstream messages, no body snippets, no headers, no internal `reason`.
- Server-side logs include `code` only — never URL query strings, headers,
  body, or internal `reason`.

### Known limitation — DNS rebinding / TOCTOU (honest wording)

What we have: **best-effort pre-fetch DNS revalidation.** `assertSafeUrl()`
runs before the initial fetch and before every redirect target.

What we **don't** have: **socket-level IP pinning.** Standard `fetch()`
resolves DNS again internally at connect time, so a hostile authoritative
DNS server could return a public IP during preflight and a private IP at
connect. This is a known limitation of the WHATWG fetch model in Deno;
closing it requires a custom HTTP client that connects to a pinned IP and
sets the Host header manually.

**For this reason, V2 stays admin-only in Phase 4B.** Future phases that
consume `validateAndFetchUrl` inherit this caveat.

### Safe-fetch scope rules (locked)

- ✅ **Direct HTML page fetches MUST use `validateAndFetchUrl`.** Raw
  `fetch()` to any user-submitted URL is **forbidden** anywhere under
  `supabase/functions/analyze-entity-url-v2/`.
- ✅ **Phase 5 exact-page extractor** consumes `FetchResult.bodyText`; it
  does not perform its own network I/O.
- ❌ **Gemini URL Context and Firecrawl API calls do NOT go through
  `validateAndFetchUrl`.** Those are calls to Google / Firecrawl APIs, not
  to the user-submitted URL. They receive only **SSRF-preflighted
  normalized URLs** (output of `assertSafeUrl`).

### Phase 5+ failure-mode guidance (docs only)

- Phase 4B returns fetch errors directly — proving the safe-fetch boundary
  is the point.
- Phase 5/6/7 may later convert fetch failures into warnings or partial
  extraction. `FETCH_BAD_CONTENT_TYPE` → Firecrawl fallback (6);
  `FETCH_TIMEOUT` → Gemini URL Context (7); `BLOCKED_HOST` always terminal.

## Locked response envelope

```ts
{
  success: true,
  predictions: null,                 // still null in Phase 4B
  metadata: {
    analyzed_url: string,
    normalized_url?: string,
    extraction_version: 'v2',
    edge_function: 'analyze-entity-url-v2',
    method: string,                  // 'stub' in Phase 4B
    timestamp: string,
    used_url_context: boolean,       // false in Phase 4B
    used_google_search: boolean,     // false in Phase 4B
    used_firecrawl: boolean,         // false in Phase 4B
    phase?: number,                  // DIAGNOSTIC-ONLY
    stage?: string,                  // DIAGNOSTIC-ONLY ('safe-fetch')
    fetch?: {                        // Phase 4B+: minimal fetch summary
      final_url: string,
      status: number,
      content_type: string,
      bytes: number,
      redirect_count: number,
      duration_ms: number,
    }
  },
  warnings?: string[]
}
```

**Deliberately excluded from `metadata.fetch`:** `redirect_chain`, `body`,
`body_snippet`, `headers`, `reason`, raw upstream URLs beyond `final_url`.

Error envelope:

```ts
{ success: false, error: string, code: V2ErrorCode, details?: unknown }
```

## Phase 5 — exact-page extractor

Pure deterministic parsing of `FetchResult.bodyText` into V1-compatible
predictions. **No new network, no AI, no Firecrawl, no DB, no category
resolution, no brand entity creation.**

### Taxonomy split (important)

The app has **15 canonical active entity types**, exported by
`supabase/functions/_shared/entityTypes.ts` as `CANONICAL_ENTITY_TYPES`:
`movie, book, tv_show, course, app, game, experience, food, product, place,
brand, event, service, professional, others`.

`_shared/entityTypes.ts` mirrors `getActiveEntityTypes()` in
`src/services/entityTypeHelpers.ts`. It is **NOT** the universal source of
truth — it must stay in sync with the frontend helper until a repo-level
shared module exists.

Phase 5 only extracts a **deterministic 9-type subset**,
`EXACT_PAGE_EXTRACTABLE_TYPES`, defined in `extractor.ts` (NOT in
`_shared/`, because this list is a Phase-5 policy, not part of the universal
taxonomy):
`product, book, movie, tv_show, course, app, game, food, place`.

The remaining 6 types — `experience, brand, event, service, professional,
others` — return `predictions: null` + `warnings: ['weak_signals']`. They
are deferred to later phases (AI / Firecrawl) where they can be inferred
safely.

### Type-inference rule (hard)

- `type` is set **only** from a recognized JSON-LD `@type` or recognized
  `og:type`. No keyword guessing from title, `<h1>`, meta description,
  Twitter cards, URL patterns, or hostnames.
- Title/meta may fill `name` / `description` only.
- No recognized structured type → weak_signals.

### No-mapping rules

- `Organization` → never `brand`. Brand entity extraction is deferred
  (Phase 8). Raw product brand **text** (`Product.brand.name`) is allowed
  in `additional_data.brand`.
- `Person` → never `professional`.
- `Event` → deferred (event-specific schema fields not yet modeled).
- No inference of `others`.

### JSON-LD parsing details

- **`@type` arrays** (e.g. `["Thing", "Product"]`): normalize to array,
  pick the **first recognized** value from the mapping table.
- **`@graph` flattening**: iterate nodes; first node with a recognized
  `@type` wins.
- **One-level wrapper unwrap**: if top-level `@type` is `WebPage, WebSite,
  Article, NewsArticle, BlogPosting, CollectionPage, ItemPage, ProductPage`
  and a child object exists at `mainEntity` / `subjectOf` / `about` with
  its own `@type`, that child is evaluated as the entity node. **One level
  only — no recursion.** Source recorded as `jsonld:WebPage→Product` etc.
  in `metadata.extract.sources`.
- Malformed JSON-LD blocks are skipped silently; remaining blocks and OG
  fallback continue.

### `suggested_category_path` (Phase 5)

Carries the **raw schema.org/og type verbatim** — `"Product"`, `"Movie"`,
`"TVSeries"`, `"Restaurant"`, `"video.movie"`. **Never** a fabricated
taxonomy path (no `"Product>Electronics"`), never lowercased. DB category
matching that produces a real path is Phase 6's job.

### URL safety

`safeAbsoluteUrl(value, baseUrl)` allows only `http:` and `https:`. It
drops `javascript:`, `data:`, `blob:`, `file:`, `mailto:`, etc. It is
applied to `image_url`, every `images[]` entry, `additional_data.canonical_url`,
and any link/icon href.

### Confidence ladder

- JSON-LD type + name → **0.9**
- OG type + name → **0.8**
- No other tier in Phase 5.

### Privacy (still enforced)

Raw HTML, `bodyText`, and parsed JSON-LD blocks are never logged or
serialized in the response. Server logs include `code` only on errors.

## Phase roadmap

- **Phase 1 ✅** — `entity_extraction.version` admin flag.
- **Phase 2 ✅** — scaffold + locked envelope.
- **Phase 3 ✅** — `CreateEntityDialog` routes via `useAnalyzeUrlEngine()`.
- **Phase 4A ✅** — SSRF preflight + URL normalization.
- **Phase 4B ✅** — safe fetch + live integration.
- **Phase 5 ✅ (this)** — deterministic exact-page extractor (9-type subset).
- **Phase 6** — weak-signal detector + Firecrawl fallback + category resolution.
- **Phase 7** — Gemini URL Context + structured output (covers deferred types).
- **Phase 8** — brand suggestion + Save-time parent brand handling.
- **Phase 9+** — admin smoke test, logging, compare mode.

---

## Phase 8 — Gemini merge + recovery path

Phase 8 adds a strict provenance-based merge between deterministic extractor
results and Gemini raw predictions, plus a recovery path that lets V2 return
200 in the Nykaa-class case (direct fetch fails + Firecrawl extraction weak +
Gemini succeeds).

### Two paths

- **Success path** — extractor (possibly Firecrawl-improved) produced
  predictions. Gemini, when present, improves selected fields under per-field
  rules. Per-field validation only — there is NO recovery validity gate on
  the success path.
- **Recovery path** — extractor predictions are null. If Gemini passes the
  recovery validity gate, V2 returns 200 with predictions built from Gemini
  (plus any deterministic image/currency surviving from Firecrawl metadata).
  Otherwise the original error response is returned unchanged.

### Recovery validity gate

A Gemini prediction can convert a fetch failure into 200 only if:

- `type` is one of the canonical V2 subset
- `name` is non-empty and length ≥ 2 after trim
- `confidence >= 0.6`
- at least one of `description`, `image_url`, `brand`, or `tags.length >= 2`

### Field rules (success path)

| Field         | Winner                                                                |
|---------------|-----------------------------------------------------------------------|
| `type`        | extractor (Gemini never overrides)                                    |
| `name`        | extractor unless junk + Gemini `field_confidence.name >= 0.7`         |
| `description` | Gemini if length 40-600, no junk-HTML, not all-caps; else extractor   |
| `image_url`   | extractor > Gemini                                                    |
| `images`      | union, dedupe by URL                                                  |
| `tags`        | union, case-insensitive dedupe, cap 12                                |
| `brand`       | Gemini > extractor (only from `additional_data.brand`, not sources)   |
| `price`       | see Price rule below                                                  |
| `currency`    | extractor > Firecrawl > Gemini                                        |

### Image rule (recovery path)

`flags.firecrawlImageUrl` (deterministic, directly from page metadata) is
preferred over Gemini image. Gemini image is used only when no deterministic
image exists.

### Price rule (unified)

`priceConflict` is derived from deterministic Firecrawl diagnostics
(`selected_price_source === "omitted"`). Never inferred.

| Condition                                                                          | Result                                |
|------------------------------------------------------------------------------------|---------------------------------------|
| `priceConflict === true`                                                           | omit price, keep currency             |
| extractor has price (success)                                                      | extractor price, ignore Gemini        |
| no extractor price AND Gemini price defined AND `field_confidence.price >= 0.7`    | use Gemini price                      |
| otherwise                                                                          | omit price, keep currency if known    |

Price ranges, MRP, `list_price`, `sale_price`, `selected_variant_price`,
`price_min/max`, and `price_display` are deferred to Phase 8.1.

### Categories snapshot policy

`categories_snapshot.json` is a small hand-curated root-level mapping
(~9 canonical types). It is **pure JSON** — no comments, no header.

- Entries whose `category_id` is not verified against the live `categories`
  table store `category_id: null` and carry only `matched_category_name`.
- We **never** emit an unverified `category_id`.
- On miss, both `category_id` and `matched_category_name` are null, and
  `suggested_category_path` is preserved on the response.
- No live DB dump, no subcategories, no fuzzy matching in this phase.

To add a verified entry: confirm the `category_id` against the production
`categories` table, add the snapshot entry with a real UUID, and add a test
fixture in `category_resolver_test.ts`.

### `metadata.merge` diagnostic

Additive; downstream code MUST NOT branch on it. Shape:

```jsonc
{
  "path": "success" | "recovery",
  "gemini_used": true,
  "gemini_fields_used": 3,
  "field_winners": {
    "type": "extractor",
    "name": "extractor",
    "description": "gemini",
    "image_url": "extractor",     // or "firecrawl" on recovery
    "brand": "gemini",
    "price": "none",
    "currency": "firecrawl",
    "tags": "merged"
  },
  "name_junk_override_applied": false,
  "price_conflict_blocked_gemini": false,
  "recovery_gate_passed": true     // only on recovery path
}
```

## Phase 8.1A — Additive pricing block

Phase 8.1A introduces `additional_data.pricing` (mirrored as `metadata.pricing` for diagnostics). It is **purely additive**. The legacy `additional_data.price` field is never changed from what Phase 8 produced.

### Invariants (apply to Phase 8.1A and all future 8.1 sub-phases)

1. `additional_data.price` is never written, recomputed, or deleted by pricing code.
2. `additional_data.pricing` is attached whenever it carries useful info: `price_source !== "omitted"` OR `price_conflict` OR `currency !== null` OR any of `list_price/sale_price/price_min/price_max/selected_variant_price`.
3. Gemini never creates or widens a public price range. Disagreement is diagnostic-only via `gemini_observed_price`.
4. No V1, DB, Gemini prompt/model/tool, or response-envelope changes.
5. `formatPriceDisplay` never throws; falls back to `"<CODE> <amount>"` if Intl cannot resolve the symbol.
6. `price_source` is conservative — `"unknown"` (+ `price_source_used: "inferred"`) when diagnostics cannot uniquely identify the source.

### Source resolution (8.1A, conservative)

| Hint from `index.ts` (via `MergeFlags.priceSourceHint`) | `price_source` | confidence |
|---|---|---|
| `"jsonld"`               | `extractor_jsonld_offer`     | 0.90 |
| `"og"`                   | `extractor_meta_og`          | 0.80 |
| `"firecrawl_metadata"`   | `firecrawl_metadata`         | 0.75 |
| `"firecrawl_markdown"`   | `firecrawl_markdown_single`  | 0.65 |
| merge winner = gemini    | `gemini`                     | `min(0.70, gemini.field_confidence.price)` |
| `null` / `"unknown"`     | `unknown` (+ `price_source_used: "inferred"`) | 0.50 |
| conflict OR no legacy price | `omitted`                 | 0 |

### Reserved for future sub-phases (NOT in 8.1A)

- **8.1B** — JSON-LD `Product.offers[]` + `AggregateOffer` → fills `price_min`/`price_max`/`selected_variant_price`. Mixed-currency offers do NOT use majority currency. Selected variant requires explicit `selected`/`default` only.
- **8.1C** — Firecrawl labeled MRP/Sale pair → fills `list_price`/`sale_price`. Pair detection must use explicit labels; variant-size prices do not count.
- **8.1D** — Admin preview UI renders `price_display`.

All future sub-phases inherit invariants #1–#6.
