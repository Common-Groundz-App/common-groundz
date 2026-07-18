
## Phase v8b.1 — Firecrawl cleanup (FINAL)

Scope is tight and frozen. Two reviewer corrections folded in:
1. Seed a synthetic `no_image` result before the Firecrawl gate on Firecrawl-only hosts, so the gate can't accidentally skip Firecrawl.
2. Use whatever timeout mechanism the client already has (Promise.race or AbortController) — don't rewrite it.

### Files touched (exactly 3)
- `supabase/functions/enrich-candidate-image/index.ts`
- `supabase/functions/enrich-candidate-image/firecrawl.ts`
- `src/components/admin/entity-create/SearchEntryPanel.tsx` (timeout line only)

### Not touched
`analyze-entity-url-v2/*`, `search-entity-candidates/*`, admin UI, schema, secrets, `ImageCandidateGrid.tsx`, `applyEntityDraft.ts`, `useAppFlagsAdmin.ts`, `_shared/feature_flags.ts`.

---

### Backend: `enrich-candidate-image/index.ts`

1. **Single source of truth for host set.** Keep `FIRECRAWL_ONLY_HOSTS` as the canonical set. Currently: `{"vertexaisearch.cloud.google.com"}`. Export it so the client helper mirrors the exact same list (via a small const duplication with a comment reminding to keep in sync — no cross-boundary import).

2. **Compute the fast-path flag once, from the normalized URL host:**
   ```
   const host = safeHost(normalizedSourceUrl);
   const isFirecrawlOnlyHost = firecrawlEnabled && FIRECRAWL_ONLY_HOSTS.has(host);
   ```
   Use `safeHost(normalizedSourceUrl)` — never the versioned cache key.

3. **Fast path when `isFirecrawlOnlyHost` is true:**
   - Skip Step 1 (direct fetch), Step 2 (soft redirect), Step 3 (clean-URL retry).
   - Push one synthetic telemetry attempt: `{ kind: "direct", skipped: true, skipReason: "firecrawl_only_host", latencyMs: 0 }`. Extend the `AttemptEntry` type with optional `skipped?: boolean` and `skipReason?: string`. Do NOT add an `errorCode` here — public error-code union stays clean.
   - **Seed the pre-Firecrawl result explicitly** so the eligibility gate passes:
     ```
     result = { imageUrl: null, source: null, method: null, errorCode: "no_image" };
     ```
   - Then fall through to Step 4 (Firecrawl).
   - Flag-OFF path is byte-identical to today.

4. **Budget.** Keep base `TOTAL_BUDGET_MS = 6_000`. For `isFirecrawlOnlyHost`, extend deadline by `FIRECRAWL_EXTRA_BUDGET_MS = 5_000` (was 2_000). Total ~11s. Non-Firecrawl-only hosts unchanged.

5. **Firecrawl eligibility tightening.** Allow Firecrawl only when the current `result.errorCode` is `"no_image"` or `"invalid_content_type"`. Remove `"blocked"` and `"timeout"` from the eligible set. (The fast-path seed above ensures Vertex rows always qualify.)

6. **`waitFor: 4000` only for Firecrawl-only hosts.** When invoking `runFirecrawlScrape`, pass `waitFor: isFirecrawlOnlyHost ? 4000 : 1500`. See firecrawl.ts change below.

7. **Cache prefix bump `v8b|` → `v8b1|`** so old negative hits from v8b don't shadow the new eligibility/skip behavior.

8. **Telemetry (log-only, contract unchanged):**
   - Top-level: `skippedDirect: boolean`.
   - Each Firecrawl attempt: `firecrawlReason: "resolved_ok" | "resolved_no_image" | "unresolved_interstitial"`, computed as:
     - `resolved_ok` — an image was extracted from the Firecrawl HTML/metadata.
     - `unresolved_interstitial` — `fc.ok === true` but `safeHost(fc.finalUrl)` is still in `FIRECRAWL_ONLY_HOSTS`.
     - `resolved_no_image` — otherwise.
   - `finalOutcome` values stay exactly as today. No new public values.

---

### Backend: `enrich-candidate-image/firecrawl.ts`

9. Add optional `waitFor?: number` to `FirecrawlOpts`. In `runFirecrawlScrape`, use `opts.waitFor ?? 1500` in the request body `waitFor`. Default preserved. Do NOT touch `analyze-entity-url-v2/firecrawl.ts`.

---

### Client: `SearchEntryPanel.tsx`

10. **Host-aware timeout using the existing mechanism.** Don't refactor the client's timeout — read what's there (Promise.race vs AbortController) and reuse it. Add a tiny helper mirroring the backend set:
    ```
    const FIRECRAWL_ONLY_HOSTS_FE = new Set(["vertexaisearch.cloud.google.com"]);
    // Keep in sync with enrich-candidate-image/index.ts FIRECRAWL_ONLY_HOSTS.
    function isFirecrawlOnlyHost(url: string | null | undefined): boolean {
      if (!url) return false;
      try { return FIRECRAWL_ONLY_HOSTS_FE.has(new URL(url).host.toLowerCase()); }
      catch { return false; }
    }
    ```
    Per-row before invoking enrichment:
    ```
    const timeoutMs = isFirecrawlOnlyHost(candidate.sourceUrl) ? 12_000 : ENRICH_CLIENT_TIMEOUT_MS; // 8_500
    ```
    Pass `timeoutMs` into whatever the current timeout wrapper accepts. Keep `ENRICH_CLIENT_TIMEOUT_MS = 8_500` unchanged.

---

### Manual verification (you)

- **Flag OFF, 3 recent searches:** identical behavior to today. Latencies, images, initials all match.
- **Flag ON, same 3 searches:** in edge logs check
  - `skippedDirect: true` on every Vertex row,
  - `attempts[]` contains the synthetic skip entry with `skipReason: "firecrawl_only_host"`,
  - `firecrawlReason` distribution across rows (mostly `unresolved_interstitial` is the expected/known limit),
  - `finalOutcome` values are still the ones you see today (no new labels).
- **Row UX:** normal (non-Vertex) rows load in ~1–2s; Vertex rows may now wait up to ~11s before showing image or initials.

### Decision gate (post-v8b.1)

- `unresolved_interstitial` dominates → ship v8b.2 (conservative citation-URL promotion in `search-entity-candidates`) and v8c (Google CSE image fallback, auto-applied to row thumbnail with "From image search — verify" chip per your override).
- Firecrawl surprises us and resolves most Vertex rows → skip v8c, ship only v8b.2.

I'll write v8b.2 and v8c as separate plans once you've run the manual verification and shared the log excerpt.
