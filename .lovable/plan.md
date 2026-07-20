## What I found

- The v8c code is mostly present: backend helper, feature flag, admin toggle, frontend request payload, and image-source UI labels exist.
- The admin flag is currently ON: `entity_extraction.search_image_cse_fallback_enabled = true`; Firecrawl is OFF.
- The recent `enrich-candidate-image` logs still show only `direct` attempts and `firecrawlEnabled:false`; they do not show `cseEnabled` or any `google_cse` attempt.
- That means the deployed function handling your searches is not running the final v8c code path, or the new CSE telemetry/logging was not deployed/active when those searches ran.
- For `cetaphil.com`, CSE intentionally would not run because the plan scoped it to Vertex rows only. Those failures are direct-site OG-image extraction failures.
- For `babe` and `chemist at play`, the rows are Vertex interstitials, so with the CSE flag ON they should show a `google_cse` attempt in logs. They do not, which is the main issue.

## Plan to fix

1. **Confirm deployed-code mismatch**
   - Check the live `enrich-candidate-image` behavior with a Vertex-style request and verify whether the response/log includes `cseEnabled` and a `google_cse` attempt.
   - If missing, redeploy only `enrich-candidate-image` so the live function matches the repo implementation.

2. **Make v8c easier to diagnose**
   - Ensure every `enrich_candidate_image` log includes both `firecrawlEnabled` and `cseEnabled`, including cache hits and rate-limit exits.
   - Ensure CSE skip reasons are visible in telemetry: `flag_off`, `not_vertex_host`, `cse_disabled`, `quota_throttled`, `budget_exhausted`, or `no_usable_query`.

3. **Fix the likely CSE miss path**
   - Add safe logging around Google CSE failures without logging raw queries: HTTP status, Google error reason, query hash, result count, and whether secrets are missing.
   - Keep the user-facing outcome stable as `no_image` when no valid image is selected.

4. **Improve image fallback behavior for your three cases**
   - Keep CSE Vertex-only for now, so it targets `babe` / `chemist at play` style Vertex rows.
   - For non-Vertex official pages like `cetaphil.com`, keep direct OG extraction first; if needed after verification, add a separate flag/phase for non-Vertex CSE fallback because that is broader and higher-risk for generic images.

5. **Validate after implementation**
   - Test `enrich-candidate-image` directly against a Vertex URL.
   - Re-check logs for a `google_cse` attempt.
   - Confirm frontend candidates can receive `source: google_images` and display the “From image search — verify” chip.

## Manual checks after the fix

- Turn ON **Google image search fallback (Vertex rows)** in Admin → Feature Flags.
- Search `babe laboratorios healthy aging serum`; Vertex rows should either show images or logs should show why CSE skipped/failed.
- Search `chemist at play roll on`; duplicated Vertex rows should show at most one CSE-backed image per enriched candidate and the logs should include `google_cse` attempts.
- Search `cetaphil gentle cleanser`; do not expect CSE unless the result source is Vertex. If the result source is `cetaphil.com`, image success depends on that page exposing valid OG/product image metadata.