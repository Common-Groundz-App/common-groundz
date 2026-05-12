// supabase/functions/admin-media-cleanup-trigger/index.ts
//
// Admin-gated trigger for an on-demand DRY-RUN of cleanup-orphan-media.
// The browser never sees CLEANUP_CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY.
//
// Flow:
//   Browser (admin JWT) → this function → cleanup-orphan-media (x-cron-secret)
//
// Always dry-run. No destructive path.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // === Auth gate ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized', code: 'MISSING_AUTH' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'unauthorized', code: 'INVALID_TOKEN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    // === Admin role check via service role ===
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: isAdmin, error: roleErr } = await adminClient.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden', code: 'NOT_ADMIN' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Secret presence check ===
    const cronSecret = Deno.env.get('CLEANUP_CRON_SECRET');
    if (!cronSecret) {
      return new Response(
        JSON.stringify({ error: 'misconfigured', code: 'NO_CLEANUP_CRON_SECRET' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Capture window start BEFORE upstream call so audit-row read-back is reliable.
    const triggerStartedAt = new Date().toISOString();

    // === Server-side fetch to cleanup-orphan-media ===
    const upstreamUrl = `${SUPABASE_URL}/functions/v1/cleanup-orphan-media`;
    const upstreamResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });

    const upstreamText = await upstreamResp.text();
    let upstreamJson: unknown;
    try {
      upstreamJson = JSON.parse(upstreamText);
    } catch {
      upstreamJson = { raw: upstreamText };
    }

    if (!upstreamResp.ok) {
      console.error('[admin-media-cleanup-trigger] upstream failed', upstreamResp.status, upstreamJson);
      return new Response(
        JSON.stringify({
          error: 'upstream_failed',
          status: upstreamResp.status,
          detail: upstreamJson,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // === Read back the audit row to confirm it was written ===
    let auditWritten = false;
    try {
      const { data: auditRow, error: auditErr } = await adminClient
        .from('media_cleanup_runs')
        .select('id,started_at,mode')
        .eq('mode', 'dry-run')
        .gte('started_at', triggerStartedAt)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (auditErr) {
        console.error('[admin-media-cleanup-trigger] audit read-back error', auditErr);
      }
      auditWritten = !!auditRow;
    } catch (e) {
      console.error('[admin-media-cleanup-trigger] audit read-back threw', e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        auditWritten,
        result: upstreamJson,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[admin-media-cleanup-trigger] error', err);
    return new Response(
      JSON.stringify({ error: 'internal_error', detail: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
