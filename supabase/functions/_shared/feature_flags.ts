// Phase 3.4B — shared feature-flag helper for edge functions.
// Uses the service-role client (no auth.uid() needed) to check the same
// app_config key that the DB-side is_non_admin_entity_creation_enabled() reads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TTL_MS = 30_000; // 30s per-instance cache

interface FlagCache { value: boolean; expiresAt: number }
const cacheByKey = new Map<string, FlagCache>();

function getClient(supabaseAdmin?: ReturnType<typeof createClient>) {
  return (
    supabaseAdmin ??
    createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
  );
}

async function readBooleanFlag(
  rpcName: string,
  supabaseAdmin?: ReturnType<typeof createClient>,
): Promise<boolean> {
  const now = Date.now();
  const cached = cacheByKey.get(rpcName);
  if (cached && cached.expiresAt > now) return cached.value;

  const client = getClient(supabaseAdmin);
  const { data, error } = await client.rpc(rpcName);
  if (error) {
    console.warn(
      `[feature_flags] ${rpcName} RPC failed, defaulting to disabled:`,
      error.message,
    );
  }
  const value = !error && data === true;
  cacheByKey.set(rpcName, { value, expiresAt: now + TTL_MS });
  return value;
}

export async function isNonAdminEntityCreationEnabled(
  supabaseAdmin?: ReturnType<typeof createClient>,
): Promise<boolean> {
  return readBooleanFlag("is_non_admin_entity_creation_enabled", supabaseAdmin);
}

// Phase 3.5a — Search-to-Draft gate for non-admin users.
export async function isNonAdminSearchToDraftEnabled(
  supabaseAdmin?: ReturnType<typeof createClient>,
): Promise<boolean> {
  return readBooleanFlag("is_non_admin_search_to_draft_enabled", supabaseAdmin);
}

// v8b — Firecrawl fallback for enrich-candidate-image. Default OFF.
export async function isSearchImageFirecrawlEnabled(
  supabaseAdmin?: ReturnType<typeof createClient>,
): Promise<boolean> {
  return readBooleanFlag("is_search_image_firecrawl_enabled", supabaseAdmin);
}
