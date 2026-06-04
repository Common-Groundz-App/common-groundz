# Phase 3 — Route `Analyze URL` via `useAnalyzeUrlEngine()` (final)

## Phase 2 completion ✅
V2 scaffold + locked envelope live, `verify_jwt = false` parity in `config.toml`, V1 untouched, `useAnalyzeUrlEngine` has zero callers. Ready to wire.

## Decisions on latest review
| Reviewer ask | Verdict |
|---|---|
| Treat `aiResult.data?.success === false` as V2 failure | **Adopt** — V2 returns this envelope by design. |
| Loading gate must not get stuck | **Adopt** — combine `engineLoading` with a single-render guard so an errored `useIsAdmin` (`isLoading=false, isAdmin=false`) still leaves the button enabled (hook already returns `engine='v1', isLoading=false` in that case — verified). |
| Update stale admin flag panel copy | **Adopt** — tiny copy-only edit in `AdminFeatureFlagsPanel.tsx`. Scope grows from 1 → 2 files; no behavior change in the panel. |
| Wording: "non-admins keep using V1" | **Fix** — say *"non-admin behavior is unchanged"*. V1 is still admin-gated server-side; this phase makes no claim about non-admin Analyze succeeding. |
| Future: open Analyze to non-admins | Deferred to a later phase (SSRF + rate limits + cost controls first). |

## Goal
Wire `entity_extraction.version` end-to-end so admins toggling the flag actually route the Analyze URL button to V1 or V2. Routing only. V2 still returns the locked Phase-2 stub.

## Non-goals
No changes to `supabase/functions/analyze-entity-url/**`, `supabase/functions/analyze-entity-url-v2/**`, DB, `supabase/config.toml`, secrets, Gemini, Firecrawl, SSRF, exact-page extraction, category matching, image extraction, brand logic. No silent V2 → V1 fallback.

## Scope (two files)

### 1. `src/components/admin/CreateEntityDialog.tsx` (routing + UX)

1. **Import the hook:**
   ```ts
   import { useAnalyzeUrlEngine } from '@/hooks/useAnalyzeUrlEngine';
   ```
2. **Read once in component:**
   ```ts
   const { engine: analyzeEngine, isLoading: engineLoading } = useAnalyzeUrlEngine();
   ```
3. **Loading gate:** extend the existing `disabled={...}` on the Analyze button to also include `engineLoading`. The hook already short-circuits to `{ engine: 'v1', isLoading: false }` for non-admins and on `has_role` error (verified in `useIsAdmin.ts` and `useAnalyzeUrlEngine.ts`), so the button cannot stay stuck. No spinner copy change required.
4. **Route the invoke** (around line 939):
   ```ts
   const fnName = analyzeEngine === 'v2' ? 'analyze-entity-url-v2' : 'analyze-entity-url';
   let urlHost = 'unknown';
   try { urlHost = new URL(analyzeUrl).host; } catch {}
   console.log(`🔍 [engine=${analyzeEngine}] invoking ${fnName} (host=${urlHost})`);
   const aiResult = await supabase.functions.invoke(fnName, { body: { url: analyzeUrl } });
   ```
   Never log the full URL or query string.
5. **Detect V2 failure (both shapes), no V1 retry:**
   ```ts
   const v2Failed =
     analyzeEngine === 'v2' &&
     (aiResult.error || (aiResult.data && aiResult.data.success === false));

   if (v2Failed) {
     console.error('⚠️ V2 analysis failed:', aiResult.error ?? aiResult.data);
     toast({
       title: 'V2 engine failed',
       description: 'analyze-entity-url-v2 returned an error. Not falling back to V1. Switch the engine flag to v1 to retry with the stable engine.',
       variant: 'destructive',
     });
     // Do NOT invoke V1. Metadata-lite still loads via the existing path.
   } else if (aiResult.error) {
     // V1 path: keep today's generic toast verbatim
     console.error('⚠️ AI analysis error:', aiResult.error);
     toast({
       title: 'AI Analysis Unavailable',
       description: 'Using basic metadata only. You can still create the entity.',
     });
   }
   ```
6. **V2 scaffold info toast** (success path, stub-only signal):
   ```ts
   if (
     analyzeEngine === 'v2' &&
     !v2Failed &&
     aiResult.data?.success === true &&
     aiResult.data?.predictions == null
   ) {
     toast({
       title: 'V2 engine (scaffold only)',
       description: 'analyze-entity-url-v2 is still a stub. No AI prefill yet — metadata-only result.',
     });
   }
   ```
7. **Downstream guards:** existing prefill / brand auto-select already use optional chaining (`aiResult.data?.predictions?.…`) and `if (aiBrandName && aiBrandName.length >= 2)`, so a `null` `predictions` short-circuits cleanly. No extra guards needed.

No other lines in `CreateEntityDialog.tsx` change.

### 2. `src/components/admin/AdminFeatureFlagsPanel.tsx` (copy only)

Two stale strings reference "routing wires up later" — both become inaccurate the moment Phase 3 ships. Update only the copy, no logic:

- `CardDescription` for the engine card:
  - **From:** "…Admin-only. Routing wires up in a later phase — Phase 1 only stores the selection."
  - **To:** "…Admin-only. Affects only the Create Entity dialog's Analyze URL button for admins."
- `confirmDesc` for `entity_extraction.version` → `v2`:
  - **From:** "…This is admin-only and may be unstable. Routing wires up in a later phase — for now this only changes the selected engine."
  - **To:** "…This is admin-only and may be unstable. V2 is currently a scaffold and returns no AI prefill yet."
- `confirmDesc` for `entity_extraction.version` → `v1`: unchanged.

No other lines in `AdminFeatureFlagsPanel.tsx` change.

## Behavior matrix
| Caller | Flag | Function | UX |
|---|---|---|---|
| Admin | `v1` | `analyze-entity-url` | Unchanged from today. |
| Admin | `v2` (stub OK) | `analyze-entity-url-v2` | Info toast "scaffold only", metadata-only prefill, no brand auto-select. |
| Admin | `v2` (error OR `success:false`) | `analyze-entity-url-v2` | Destructive toast, **no** V1 retry. Metadata-lite still attempted. |
| Non-admin | (hook returns `v1`) | `analyze-entity-url` | **Unchanged from today.** (V1 is admin-gated server-side — Phase 3 makes no claim about non-admin success.) |
| Anyone, engine flag loading | — | none | Button disabled until hook resolves; cannot get stuck (verified). |

## Testing checklist
- [ ] Admin + `v1` → network shows `POST …/analyze-entity-url`; V1 prefill + brand auto-select unchanged.
- [ ] Admin + `v2` (stub success) → `POST …/analyze-entity-url-v2`, 200, info toast, no brand auto-select, no console errors.
- [ ] Admin + `v2` with forced failure (revoke admin temporarily, or POST `{}` via devtools) → destructive toast; network shows zero retries to `analyze-entity-url`.
- [ ] Admin + `v2` returning `{ success: false, ... }` (simulated) → handled by the same destructive toast (not the generic V1 toast).
- [ ] Flip back to `v1` → next click hits V1.
- [ ] Non-admin → behavior unchanged from today.
- [ ] Loading gate: hard refresh + immediate click → button disabled briefly, then enabled. Errored `useIsAdmin` → button still enabled.
- [ ] Console logs show `host=…` only; no full URL, no query string.
- [ ] `git diff` shows changes only in `CreateEntityDialog.tsx` and `AdminFeatureFlagsPanel.tsx` (copy-only).
- [ ] V1 and V2 function bodies byte-identical to before Phase 3.

## Rollback
Revert the two files. Hook, V2 function, and config block remain inert.

## Deliverables when Phase 3 completes
- Diff of `CreateEntityDialog.tsx` and `AdminFeatureFlagsPanel.tsx`.
- Network proof: admin+v1, admin+v2 stub success, admin+v2 failure (no V1 retry).
- Confirmation V1 output unchanged when flag is `v1`.
- Confirmation V2 function body unchanged from Phase 2.
- Confirmation console logs contain no full URL / query string.
- Confirmation non-admin behavior is unchanged.

## Phase boundaries
Phase 1 ✅ (flag+UI) → Phase 2 ✅ (V2 scaffold) → **Phase 3** (routing + stale-copy fix) → Phase 4+ (SSRF, exact-page, Firecrawl, Gemini URL Context, category matching, brand parity, eventual non-admin access decision).

Awaiting approval to implement.
