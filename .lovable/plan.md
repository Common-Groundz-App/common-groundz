
# Phase 7.1 Hotfix — Fix Gemini `GEMINI_HTTP_ERROR 400` in `analyze-entity-url-v2`

## Diagnosis

Edge logs show Phase 7 wiring fires exactly as designed, but Google rejects the Gemini request with HTTP 400 before any URL Context / Search work happens:

```
fetch failed { code: FETCH_BAD_STATUS }
firecrawl recovery failed: weak extraction
gemini { ok: false, code: GEMINI_HTTP_ERROR, status: 400, durationMs: 702 }
```

The current code drains the 400 body without logging it, so the real reason is hidden. Two suspects, both fixable in one deploy:

1. **`generationConfig.responseMimeType: "application/json"` combined with built-in tools.** Per Google docs, structured outputs + grounding tools is a Gemini 3 capability, not 2.5. Our working V1 (`analyze-entity-url`) does not send `responseMimeType`.
2. **Tool key casing.** V2 currently uses SDK-style `urlContext` / `googleSearch`. Google's official REST docs for URL Context and Google Search show `url_context` / `google_search`. V1 proves `googleSearch` camelCase works **for Google Search alone**, but does **not** prove `urlContext` camelCase works in a combined REST request. Align V2 with the documented REST shape.

## Scope

Phase 7.1 only. Touches `supabase/functions/analyze-entity-url-v2/gemini.ts` and its test file. Nothing else.

**Out of scope (do not touch):**
- **V1 (`analyze-entity-url`) — leave the working version alone.**
- Frontend, predictions merge, V2 response envelope, `V2ErrorCode` union
- Firecrawl trigger rules, SSRF, fetcher, deterministic extractor, weak-signal logic, host hints
- DB, schemas, migrations
- Phase 8 (predictions merge stays deferred)

## Changes

### 1. Capture and log Google's sanitized 400 message

In `runGeminiJsonMode`, on `!res.ok` stop discarding the body. Read it as text, try `JSON.parse`, and extract only safe fields:

- `error.status` (string, e.g. `INVALID_ARGUMENT`)
- `error.code` (number)
- `error.message` collapsed whitespace, truncated to **400 chars**

If body isn't JSON, log first 400 chars of raw text (whitespace collapsed) as `error_message_truncated`.

Log via existing `logLine` helper as:

```
{ ok: false, code: "GEMINI_HTTP_ERROR", status, error_status,
  error_code, error_message_truncated, durationMs, modelUsed }
```

The returned `GeminiFailure` shape stays unchanged — diagnostics live in logs only.

**Never log:** URL, prompt, evidence HTML, API key, request body, request headers, tool args, full response body, or any candidate text.

### 2. Switch REST tool names to documented snake_case

Change V2's request body from:

```ts
tools: [{ urlContext: {} }, { googleSearch: {} }]
```

to the documented REST shape:

```ts
tools: [{ url_context: {} }, { google_search: {} }]
```

This matches Google's REST docs for both URL Context and Google Search. V1 stays untouched.

### 3. Remove `responseMimeType` and keep JSON enforcement via prompt + parser

In `generationConfig`:
- **Remove** `responseMimeType: "application/json"`.
- **Keep** `temperature: 0.15`.
- Do **not** add `responseSchema`, `topP`, `topK`, `maxOutputTokens`, or a body-level `timeout`.

JSON output continues to be enforced through:
- strict JSON instructions in `systemPrompt` (already in `prompt-generator-v2.ts`)
- existing `stripCodeFences`
- `JSON.parse`
- `buildGeminiRawPredictionSchema` Zod validation

### 4. Split `systemInstruction` from user prompt

Stop concatenating `systemPrompt + "\n\n" + userPrompt` into one user message. Send:

```ts
systemInstruction: { role: "system", parts: [{ text: args.systemPrompt }] },
contents: [{ role: "user", parts: [{ text: args.userPrompt }] }],
```

Mirrors V1's working shape, slightly improves prompt-injection isolation.

### 5. Tests (`gemini_test.ts`)

Update existing assertions and add new ones. Keep file fully runnable with no network.

**Update** the body-shape test to assert:
- `captured.generationConfig.responseMimeType === undefined`
- `captured.generationConfig.responseSchema === undefined`
- `captured.timeout === undefined`
- `captured.systemInstruction.parts[0].text === "s"`
- `captured.contents[0].parts[0].text === "u"` (no concatenation)
- `captured.tools` contains an object with key `url_context` and one with key `google_search`
- `captured.tools` does **not** contain keys `urlContext` or `googleSearch`

**Add** three sanitized-logging tests by capturing `console.log`:
- 400 with JSON body `{ error: { status: "INVALID_ARGUMENT", code: 400, message: "Request contains an invalid argument." } }` → logged payload contains `error_status: "INVALID_ARGUMENT"`, `error_code: 400`, truncated message; **no** `prompt` / `body` / `headers` keys.
- 400 with non-JSON text body → `error_message_truncated` is the collapsed text.
- 400 with a body longer than 400 chars → logged `error_message_truncated.length <= 400`.

All other existing tests (timeouts, safety blocks, grounding parsing, image normalization, fenced JSON, invalid shape, missing API key) must still pass unchanged.

## Validation after deploy

1. Run `supabase--test_edge_functions` for `analyze-entity-url-v2`. All tests (existing + new) must pass.
2. Re-analyze `https://www.nykaa.com/dior-sauvage-eau-forte/p/20232222?root=cav_pd&skuId=20232221` from the UI.
3. Pull edge logs. Acceptable Phase 7.1 outcomes:
   - `gemini { ok: true, ... }` with grounding metadata, **or**
   - `gemini { ok: false, code: "GEMINI_INVALID_JSON" | "GEMINI_INVALID_SHAPE", ... }` (Gemini responded 200, output unusable), **or**
   - `gemini { ok: false, code: "GEMINI_HTTP_ERROR", status: 400, error_status, error_message_truncated, ... }` — Google's real reason is now visible and we iterate one more time (e.g. flip a single field) based on the message.
4. Top-level UI response for Nykaa stays `FETCH_BAD_STATUS` (expected — Phase 8 is what surfaces Gemini's data to the UI).
5. Re-analyze a strong-direct page (e.g. a public Wikipedia article) and confirm Gemini is **skipped** (no `[analyze-entity-url-v2] gemini` log line).
6. Do not start Phase 8 until Gemini returns 200 at least once on an eligible URL.

## Why this is safe

- V1 stays completely untouched.
- All changes mirror documented Google REST shapes or V1's known-good shape.
- Even if Gemini still 400s after this deploy, the sanitized error log makes the next iteration a one-line fix.
- Zero changes to V2 contract, predictions, or any other subsystem.

## Files touched

- `supabase/functions/analyze-entity-url-v2/gemini.ts` — sanitized 400 logging; snake_case tool keys; remove `responseMimeType`; split `systemInstruction` from user prompt.
- `supabase/functions/analyze-entity-url-v2/gemini_test.ts` — update body-shape assertions; add 3 sanitized-error-logging tests.

No other files change. V1 (`analyze-entity-url`) is not modified.
