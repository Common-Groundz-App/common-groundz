// supabase/functions/admin-media-cleanup-execute-trigger/index.ts
//
// Admin-gated trigger for an on-demand DESTRUCTIVE EXECUTE of
// cleanup-orphan-media-execute. Three independent guardrails:
//   1. Admin JWT + has_role('admin') check (this function)
//   2. Body must contain { confirm: 'DELETE', maxDeletions } and pass preflight
//      against latest dry-run row (this function)
//   3. Upstream cleanup-orphan-media-execute enforces hard cap of 50
//
// Browser → this function (admin JWT) → cleanup-orphan-media-execute (x-cron-secret)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const HARD_CAP = 50;
const STALE_DRY_RUN_HOURS = 24;

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
    // === Auth gate ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'unauthorized', code: 'MISSING_AUTH' }, 401);
    }

    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: 'unauthorized', code: 'INVALID_TOKEN' }, 401);
    }
    const userId = claimsData.claims.sub;

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: isAdmin, error: roleErr } = await adminClient.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    if (roleErr || !isAdmin) {
      return json({ error: 'forbidden', code: 'NOT_ADMIN' }, 403);
    }

    // === Body validation ===
    let body: { confirm?: unknown; maxDeletions?: unknown } = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      return json({ error: 'bad_request', code: 'INVALID_JSON' }, 400);
    }
    if (body.confirm !== 'DELETE') {
      return json({ error: 'bad_request', code: 'MISSING_CONFIRM' }, 400);
    }
    const rawMax = Number(body.maxDeletions);
    if (!Number.isFinite(rawMax) || !Number.isInteger(rawMax) || rawMax < 1) {
      return json({ error: 'bad_request', code: 'INVALID_MAX_DELETIONS' }, 400);
    }
    const maxDeletions = Math.min(rawMax, HARD_CAP);

    // === Secret presence ===
    const cronSecret = Deno.env.get('CLEANUP_CRON_SECRET');
    if (!cronSecret) {
      return json({ error: 'misconfigured', code: 'NO_CLEANUP_CRON_SECRET' }, 500);
    }

    // === Preflight against latest dry-run row ===
    const { data: latestDryRun, error: dryRunErr } = await adminClient
      .from('media_cleanup_runs')
      .select('id,started_at,would_delete')
      .eq('mode', 'dry-run')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dryRunErr) {
      console.error('[admin-media-cleanup-execute-trigger] dry-run lookup failed', dryRunErr);
      return json({ error: 'internal_error', code: 'DRY_RUN_LOOKUP_FAILED' }, 500);
    }
    if (!latestDryRun) {
      return json({ error: 'preflight_failed', code: 'NO_DRY_RUN' }, 409);
    }
    const ageHours =
      (Date.now() - new Date(latestDryRun.started_at).getTime()) / (1000 * 60 * 60);
    if (ageHours > STALE_DRY_RUN_HOURS) {
      return json({ error: 'preflight_failed', code: 'STALE_DRY_RUN', ageHours }, 409);
    }
    const wouldDelete = Number(latestDryRun.would_delete ?? 0);
    if (wouldDelete <= 0) {
      return json({ error: 'preflight_failed', code: 'NOTHING_TO_DELETE' }, 409);
    }
    if (wouldDelete > maxDeletions * 4) {
      return json(
        { error: 'preflight_failed', code: 'DRY_RUN_DRIFT', wouldDelete, maxDeletions },
        409
      );
    }

    // === Server-side fetch to upstream execute ===
    const triggerStartedAt = new Date().toISOString();
    const upstreamUrl = `${SUPABASE_URL}/functions/v1/cleanup-orphan-media-execute`;
    const upstreamResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ mode: 'execute', maxDeletions }),
    });

    const upstreamText = await upstreamResp.text();
    let upstreamJson: unknown;
    try {
      upstreamJson = JSON.parse(upstreamText);
    } catch {
      upstreamJson = { raw: upstreamText };
    }

    if (!upstreamResp.ok) {
      console.error(
        '[admin-media-cleanup-execute-trigger] upstream failed',
        upstreamResp.status,
        upstreamJson
      );
      return json(
        { error: 'upstream_failed', status: upstreamResp.status, detail: upstreamJson },
        502
      );
    }

    // === Audit read-back ===
    let auditWritten = false;
    let runId: string | null = null;
    try {
      const { data: auditRow } = await adminClient
        .from('media_cleanup_runs')
        .select('id')
        .eq('mode', 'execute')
        .gte('started_at', triggerStartedAt)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      auditWritten = !!auditRow;
      runId = (auditRow as any)?.id ?? null;
    } catch (e) {
      console.error('[admin-media-cleanup-execute-trigger] audit read-back threw', e);
    }

    return json({ ok: true, auditWritten, runId, result: upstreamJson }, 200);
  } catch (err) {
    console.error('[admin-media-cleanup-execute-trigger] error', err);
    return json({ error: 'internal_error', detail: (err as Error).message }, 500);
  }
});
