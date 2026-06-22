## Verdict on your 2 new URL tests

**Not working as intended — but the bug is in deployment, not in the 1.8c.6-B logic.**

### What the logs show

Two `fetch-url-metadata-lite` calls were made:
- 07:37:24 — `tirabeauty.com` (Lakme foundation)
- 07:38:43 — `maccaron.in` (Isntree green tea toner)

Both URLs are **non-brand product pages**. With 1.8c.6-B working, each should have:
1. Logged `🧭 entityType: product (source=caller, path=non_brand_page_first)`
2. Logged `🌐 Bounded HTML fetch for page-owned image: success`
3. Logged `🖼️ Page-owned image won on path=non_brand_page_first`
4. Returned `images[0].source === "page-owned"` (the actual Tira/Maccaron product photo)
5. Included `image_priority_path`, `entityTypeSource`, `pageOwnedImageWon`, `pageHtmlFetchedForImage` in the `📦 Response structure` log

**None of that happened.** Both calls show the pre-1.8c.6-B sequence:
- No `🧭` line at all
- "No HTML available - skipping description/favicon extraction"
- Response structure has only the old 5 keys (`hasTitle, hasDescription, hasFavicon, imageCount, imageSources`)
- All 5 images came from Google, none page-owned

### Root cause

The source code is correct. I verified:
- `supabase/functions/fetch-url-metadata-lite/index.ts` contains the new logic (lines 70–270) — confirmed `🧭 entityType:` log at line 92, bounded fetch at line 124–133, page-owned promotion at line 199–218, telemetry in response at line 293–298.
- `image_validation.ts` exists (modified 07:00).
- `index_test.ts` exists (modified 07:03).
- Frontend caller is correctly wired at `CreateEntityDialog.tsx` line 977–984 — passes `entityType: resolvedEntityType` from AI prediction with the agreed fallback.
- `use-entity-operations.ts` also passes `entityType` correctly.

But the deployed Supabase Edge Function at 07:37 was still serving the **pre-1.8c.6-B build**. This is a deployment-sync issue, not a code issue. Most likely cause: the auto-deploy didn't pick up the new `image_validation.ts` sibling file, so the new `index.ts` either fails its `import './image_validation.ts'` at boot and silently falls back to a cached older bundle, or the bundler skipped the rebuild entirely.

## Plan

### Step 1 — Force a fresh deploy of both functions
Use `supabase--deploy_edge_functions` to redeploy:
- `fetch-url-metadata-lite`
- `enrich-brand-data`

This forces the bundler to pick up the new sibling files (`image_validation.ts`) and any boot-time import failure will surface in the deploy output where we can see it instead of silently reverting.

### Step 2 — Smoke-test with a direct curl
Hit `fetch-url-metadata-lite` once with `entityType: "product"` and the Maccaron URL, once with `entityType: "brand"` and `https://www.nykaa.com`. Inspect the `metadata` block in the response for the 5 new telemetry keys. If they appear, the new code is live.

### Step 3 — Pull fresh logs and confirm
Read the latest `fetch-url-metadata-lite` logs immediately after the curls and confirm:
- `🧭 entityType: product (source=caller, path=non_brand_page_first)` appears for the Maccaron call
- `🌐 Bounded HTML fetch for page-owned image: success` appears
- `🖼️ Page-owned image won on path=non_brand_page_first` appears
- For the Nykaa brand call: `path=brand_first_google` and `pageHtmlFetchedForImage: false`

### Step 4 — Re-run your Tira + Maccaron analyze flow from the UI
Now that the function is live, repeat your two-URL test from the Admin dialog. Confirm logs show:
- `entityTypeSource: caller`
- The primary image in the UI is the actual product photo from Tira/Maccaron, not a Google search result.

### Step 5 — Report
Produce a short verdict per URL with `image_priority_path`, `pageOwnedImageWon`, primary image source, and a side-by-side of before-vs-after image. If any URL still hits Google first when it shouldn't, that becomes a follow-up patch.

## Out of scope

- No source-code changes to 1.8c.6-B logic. The code is correct; this is a deploy operation.
- No changes to `analyze-entity-url-v2`, merge, or any other flow.
- If the redeploy surfaces a real bundling error (e.g. relative import unsupported in deployed runtime), that fix becomes a separate small patch — most likely inlining `image_validation.ts` into `index.ts` for now and revisiting the shared module split in Phase 1.8c.7.

## Risk

Low. Redeploying the function only re-bundles existing committed source. If it succeeds, behavior matches the intended 1.8c.6-B plan. If it fails, the deploy output tells us exactly what's wrong (no silent regression).
