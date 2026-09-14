// supabase/functions/update-trending-scores/index.ts
//
// Phase 4.2B.4A-bis: protected hourly incremental refresh of entities.trending_score_v2.
// Scheduled exclusively by the Supabase cron job 'refresh-trending-scores-v2-hourly'.
//
// HTTP boundary:
//   1. Cron path:   x-cron-secret header validated by the service-role-only SQL
//                   validator is_valid_trending_cron_secret(), which compares the
//                   presented value against the Vault entry 'trending_refresh_cron_secret'
//                   inside the database (the value is never hard-coded or persisted
//                   outside Vault; it travels only over HTTPS in the cron request).
//   2. Manual path: x-cron-secret equal to the TRENDING_REFRESH_CRON_SECRET env secret.
//   3. Admin path:  Bearer JWT + has_role('admin') via service client.
// All paths then execute the service-role-only update_all_trending_scores_v2() routine.
// Scheduled runs always use incremental mode (p_bootstrap = false); bootstrap is admin-only.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const presented = req.headers.get('x-cron-secret');
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let authorized = false;

    // Path 1: cron secret (Vault-backed validator, with env fallback for manual triggers)
    if (presented) {
      const envSecret = Deno.env.get('TRENDING_REFRESH_CRON_SECRET');
      if (envSecret && presented === envSecret) {
        authorized = true;
      } else {
        const { data: valid, error: validErr } = await adminClient.rpc(
          'is_valid_trending_cron_secret',
          { p_presented: presented },
        );
        if (!validErr && valid === true) authorized = true;
      }
    }

    // Path 2: admin JWT
    if (!authorized) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const token = authHeader.replace('Bearer ', '');
        const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
        if (!claimsErr && claimsData?.claims?.sub) {
          const { data: isAdmin, error: roleErr } = await adminClient.rpc('has_role', {
            _user_id: claimsData.claims.sub,
            _role: 'admin',
          });
          if (!roleErr && isAdmin) authorized = true;
        }
      }
    }

    if (!authorized) {
      return json({ error: 'unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    // Phase 4.2B.3: incremental v2 orchestrator. Bootstrap mode already ran once in
    // 4.2B.2, so scheduled runs stay incremental.
    const { data: updatedCount, error } = await adminClient.rpc('update_all_trending_scores_v2', {
      p_bootstrap: false,
    });

    if (error) {
      console.error('[update-trending-scores] rpc failed', error);
      return json({ error: 'refresh_failed', code: 'RPC_FAILED' }, 500);
    }

    console.log(`[update-trending-scores] updated trending scores for ${updatedCount} entities`);

    return json({ ok: true, updatedCount: updatedCount || 0, timestamp: new Date().toISOString() }, 200);
  } catch (err) {
    console.error('[update-trending-scores] error', err);
    return json({ error: 'internal_error' }, 500);
  }
});
