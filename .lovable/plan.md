## Goal

Make the `analyze-entity-url-v2` edge function read its Gemini key from a new secret `GEMINI_API_KEY_V2` instead of the shared `GEMINI_API_KEY`. No other functions are affected.

## Steps

1. **Add secret** `GEMINI_API_KEY_V2` via the secrets tool (you'll paste the new key in the secure form).
2. **Edit `supabase/functions/analyze-entity-url-v2/gemini.ts`** (line 163):
   - Change `Deno.env.get("GEMINI_API_KEY")` → `Deno.env.get("GEMINI_API_KEY_V2")`.
3. **Edit `supabase/functions/analyze-entity-url-v2/index.ts`** (line 355):
   - Change the `geminiConfigured` check to read `GEMINI_API_KEY_V2`.

## Out of scope

- All other edge functions continue using `GEMINI_API_KEY` unchanged.
- No changes to pricing logic, merge, schema, UI, DB, or V1.

## Security note

The key you pasted in chat is exposed — please rotate it in Google AI Studio before entering the new value into the secrets form.
