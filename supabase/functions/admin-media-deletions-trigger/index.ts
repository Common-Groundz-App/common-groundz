// Admin-gated "Run now" for the D2 photo deletion worker.
// Browser (admin JWT) → this function → process-media-deletions (x-cron-secret).
// The worker still honours media_cleanup.processing_enabled.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await anon.auth.getClaims(authHeader.slice(7));
    if (claimsErr || !claims?.claims?.sub) return json({ error: 'unauthorized' }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', { _user_id: claims.claims.sub, _role: 'admin' });
    if (roleErr || !isAdmin) return json({ error: 'forbidden' }, 403);
    const secret = Deno.env.get('CLEANUP_CRON_SECRET');
    if (!secret) return json({ error: 'misconfigured' }, 500);
    const resp = await fetch(`${url}/functions/v1/process-media-deletions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret, Authorization: `Bearer ${service}` },
      body: '{}',
    });
    const text = await resp.text();
    let result: unknown;
    try { result = JSON.parse(text); } catch { result = { raw: text.slice(0, 200) }; }
    if (!resp.ok) return json({ error: 'worker_failed', status: resp.status }, 502);
    return json({ ok: true, result });
  } catch (e) {
    console.error('[admin-media-deletions-trigger] error', (e as Error).message);
    return json({ error: 'internal_error' }, 500);
  }
});
