// supabase/functions/refresh-social-influence-v2/index.ts
//
// Phase 4.2B.2: reconciling refresh of the additive social_influence_scores_v2 cache.
// Deployed UNSCHEDULED — the cron schedule is added in 4.2B.3.
//
// HTTP boundary (either path authorizes):
//   1. Cron path:    x-cron-secret header must equal INFLUENCE_REFRESH_CRON_SECRET
//   2. Admin path:   Bearer JWT + has_role('admin') via service client
// Both paths then execute the service-role-only refresh_social_influence_scores_v2() routine,
// which upserts current eligible (user, canonical_type) rows and removes stale v2 rows only.

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
    // Path 1: cron secret. The pg_cron job presents the Vault entry
    // 'influence_refresh_cron_secret' as the x-cron-secret header; the presented
    // value is validated by the service-role-only SQL validator so the stored
    // secret never needs to be duplicated outside Vault.
    // INFLUENCE_REFRESH_CRON_SECRET (env) remains accepted for manual triggers.
    const presented = req.headers.get('x-cron-secret');
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let authorized = false;

    if (presented) {
      const envSecret = Deno.env.get('INFLUENCE_REFRESH_CRON_SECRET');
      if (envSecret && presented === envSecret) {
        authorized = true;
      } else {
        const { data: valid, error: validErr } = await adminClient.rpc(
          'is_valid_influence_cron_secret',
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

    const { data, error } = await adminClient.rpc('refresh_social_influence_scores_v2');
    if (error) {
      console.error('[refresh-social-influence-v2] rpc failed', error);
      return json({ error: 'refresh_failed', code: 'RPC_FAILED' }, 500);
    }

    return json({ ok: true, rowsWritten: data }, 200);
  } catch (err) {
    console.error('[refresh-social-influence-v2] error', err);
    return json({ error: 'internal_error' }, 500);
  }
});
