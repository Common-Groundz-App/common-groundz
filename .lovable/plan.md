## What the diagnostics proved

Latest Nykaa run:

```
name_source: "metadata_title"          ← junk og:title won
markdown_h1_found: true                 ← clean H1 exists
markdown_h1_within_main_region: false   ← but outside the 4 KB region
markdown_price_found: false             ← regex didn't match Nykaa's Indian price format
metadata_price_found: true              ← og price = 14900 (one SKU variant)
selected_price_source: "metadata"
image_source: "metadata_og_image"
image_present: true                     ← backend has a syntactically valid URL
```

UI: junk name, junk description, broken image icon, single price (14900) — PDP actually has ₹10,600 (50 ml) and ₹14,900 (100 ml).

Three small fixes + a confirmation run. No Phase 8 yet.

## Scope

**Out of scope:** Phase 8, Gemini merge, V1, `extractor.ts`, `fetcher.ts`, `prompt-generator-v2.ts`, response envelope, description priority, SSRF / Gemini client, `proxy-external-image` edits, `ImageWithFallback` edits, DB changes, loosening the 5% rule, skuId→variant mapping, name normalization (size suffix stripping, "Buy … Online" stripping, title-casing).

---

### Fix A — Widen markdown main region (fixes `name` only, not `description`)

In `supabase/functions/analyze-entity-url-v2/firecrawl_recovery.ts`:

- Raise `MAIN_REGION_BYTES` from `4 * 1024` to `16 * 1024`.
- Keep the "stop at first `## ` heading" cutoff unchanged.
- 16 KB is a hard ceiling for this pass.

**What changes / what does NOT:**
- ✅ `firstH1` finds the clean product H1 → `name_source` flips to `"markdown_h1"`.
- ❌ Description does **not** improve. Priority stays `og:description → metadata.description → markdown paragraph`. Nykaa's junk og:description still wins. Description = Phase 8.

**Guardrail — Minimal H1 cleanup:** No size-suffix stripping (`(50ml)`), no marketing-phrase stripping, no title-casing. Accept H1 verbatim. `firstH1` regex unchanged.

Regression test: fixture with clean H1 between 4 KB and 16 KB of leading nav noise, followed by `## Product Description` cutoff and junk H1 after. Assert `name` = clean H1 verbatim; post-`##` junk H1 ignored.

---

### Fix B — Extend markdown price regex; prefer sale over MRP; omit on multi-SKU conflict

Replace `firstMarkdownPrice` with a function that:

**1. Collects ALL anchored matches in the main region** (no bare-number matching ever).

Two regex branches, both strictly anchored:

```
Branch 1 — REQUIRED label, optional currency, number
  label   := (MRP | Price | Offer Price | Sale Price)
  example matches:
    "MRP: ₹14,900"  → label=MRP,         price=14900
    "Price: 2499"   → label=Price,       price=2499
    "Offer Price ₹10,600" → label=Offer Price, price=10600
    "Sale Price: Rs. 7,499" → label=Sale Price, price=7499

Branch 2 — REQUIRED currency token, number (no label needed)
  currency := (₹ | $ | € | £ | Rs. | Rs<space> | INR<space> | USD<space> | EUR<space> | GBP<space>)
  example matches:
    "₹10,600"       → label=null, price=10600
    "Rs. 14,900"    → label=null, price=14900
    "INR 1200"      → label=null, price=1200
    "$49.99"        → label=null, price=49.99
```

Neither branch ever allows both label AND currency to be optional. Bare digits never match — ratings (`4.3`), review counts (`12,450 reviews`), pack sizes (`50 ml`), pincodes, dates (`12 June`), SKU IDs (`950905`) are all unreachable by either branch.

**2. Picks one winner from collected matches by priority:**

```
Priority 1: any match with label ∈ {Offer Price, Sale Price, Price}
Priority 2: any currency-prefixed match (Branch 2) that does NOT have "MRP"
            within ~40 chars before it
Priority 3: any match with label = MRP  (last resort)
```

Within a tier, first occurrence wins. Returns a single number or null.

**Why:** On Nykaa-style PDPs the markdown often shows `MRP: ₹14,900` **before** `Offer Price ₹10,600`. Naive first-match returns MRP, which violates the existing "don't inject list price when sale price is visible" rule. The priority order ensures the sale/offer price wins.

**3. 5% metadata-vs-markdown conflict rule unchanged.** For Nykaa: markdown picks 10600 (Offer Price), metadata has 14900 (MRP) → diff > 5% → `selected_price_source: "omitted"`, currency kept.

Regression tests in `firecrawl_recovery_test.ts`:

**Positive (label-anchored):**
- `MRP: ₹14,900` alone → 14900.
- `Price: 2499` → 2499.
- `Offer Price ₹10,600` → 10600.
- `Sale Price: Rs. 7,499` → 7499.

**Positive (currency-anchored):**
- `Rs. 14,900` → 14900.
- `INR 1200` → 1200.
- `$49.99` → 49.99.

**Priority ordering:**
- Markdown has `MRP: ₹14,900` then later `Offer Price ₹10,600` → picks 10600.
- Markdown has only `MRP: ₹14,900` → picks 14900 (last resort).
- Markdown has `₹14,900` (no MRP label nearby) then `₹10,600` → picks first currency-anchored = 14900 (tie within Priority 2 by first occurrence).

**Conflict rule integration:**
- metadata=14900, markdown picks 10600 → `selected_price_source: "omitted"`, currency INR kept.

**Negative (must NOT match):**
- `4.3 out of 5` → no match.
- `12,450 reviews` → no match.
- `50 ml` / `100 ml` → no match.
- `Delivery by 12 June` → no match.
- Bare `950905` → no match.
- `markdown_price_found: false` for all of the above.

Existing fixture tests still pass.

---

### Fix C — AI Analysis modal image (verify URL via response body, NOT logs)

**Verification step:** On the next Nykaa re-run, open browser devtools → Network tab → find the `analyze-entity-url-v2` POST → read `predictions.image_url` from the JSON response body. We do **not** read image URLs from Edge logs.

Branch on what the response body shows:

- **If `image_url` is a valid `images-static.nykaa.com` URL** that opens directly in a browser: bug is frontend rendering. Swap the AI Analysis Results modal's Primary Image `<img>` for the existing `ImageWithFallback` component (`src/components/common/ImageWithFallback.tsx`) with `entityType="product"`. That component already routes through `proxy-external-image` via `getProxyUrlForImage`, retries direct on proxy failure, and falls back to the product placeholder. **No changes to `ImageWithFallback` itself or `proxy-external-image`.**
- **If `image_url` is malformed / relative / 404s:** bug is backend image selection in `firecrawl_recovery.ts`. Fix image fallback there. Do not also do the frontend swap in the same pass.
- **If `image_url` is valid AND `ImageWithFallback` still renders broken:** open a separate `proxy-external-image` ticket. Out of scope here.

Exact modal file located in build mode via `rg "image_url|Primary Image" src/components`.

---

### Diagnostics retention

Keep the `firecrawl recovery diagnostics` log through this confirmation run. After post-deploy Nykaa run shows expected values, decide whether to keep permanently or trim. Follow-up, not part of this pass.

---

## Verification (mandatory)

Re-run the same Nykaa URL from the AI Analysis modal. Required:
- `name_source: "markdown_h1"` ✅
- `markdown_h1_within_main_region: true` ✅
- `markdown_price_found: true` ✅
- `selected_price_source: "omitted"` ✅ (10600 vs 14900 conflict)
- Modal renders the product image, or cleanly falls back to product placeholder (no broken icon) ✅
- Description may still look like Nykaa's og:description — **expected**, Phase 8.
- Name may include `(50ml)` — **expected**, Phase 8.

All `firecrawl_recovery_test.ts` tests green including new positive, priority-ordering, conflict, and negative tests.

## Files touched

- `supabase/functions/analyze-entity-url-v2/firecrawl_recovery.ts` — `MAIN_REGION_BYTES` constant; replace `firstMarkdownPrice` with collect-all + priority-pick. Possibly image fallback (only if Fix C branches that way).
- `supabase/functions/analyze-entity-url-v2/firecrawl_recovery_test.ts` — H1-after-4KB fixture, label-anchored tests, currency-anchored tests, MRP-vs-Offer-Price priority tests, multi-SKU conflict test, negative tests (ratings / reviews / pack sizes / dates / bare numbers).
- AI Analysis Results modal component — swap Primary Image `<img>` for `ImageWithFallback` (only if Fix C branches that way; file located during build).
