// Phase 3.4B — shared feature-flag helper for edge functions.
// Uses the service-role client (no auth.uid() needed) to check the same
// app_config key that the DB-side is_non_admin_entity_creation_enabled() reads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let cached: { value: boolean; expiresAt: number } | null = null;
const TTL_MS = 30_000; // 30s per-instance cache

export async function isNonAdminEntityCreationEnabled(
  supabaseAdmin?: ReturnType<typeof createClient>,
): Promise<boolean> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const client =
    supabaseAdmin ??
    createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

  const { data, error } = await client.rpc("is_non_admin_entity_creation_enabled");
  if (error) {
    console.warn(
      "[feature_flags] is_non_admin_entity_creation_enabled RPC failed, defaulting to disabled:",
      error.message,
    );
  }
  const value = !error && data === true;
  cached = { value, expiresAt: now + TTL_MS };
  return value;
}
