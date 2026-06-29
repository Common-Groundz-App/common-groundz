import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  entityId: string;
  action: 'approve' | 'reject';
  reason?: string;
  expectedStatus?: 'approved' | 'pending' | 'rejected';
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Authorization header required' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return json(401, { error: 'Invalid authentication' });

    // Verify admin via has_role (uuid-based, not email)
    const { data: roleRows, error: roleError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .limit(1);
    if (roleError) return json(500, { error: 'Failed to verify admin status' });
    if (!roleRows || roleRows.length === 0) return json(403, { error: 'Admin access required' });

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Invalid JSON body' });
    }

    const { entityId, action, reason, expectedStatus } = body ?? {} as RequestBody;
    if (!entityId || typeof entityId !== 'string') return json(400, { error: 'entityId required' });
    if (action !== 'approve' && action !== 'reject') return json(400, { error: 'action must be approve|reject' });
    if (action === 'reject' && (!reason || reason.trim().length === 0)) {
      return json(400, { error: 'reason required when rejecting' });
    }

    const { data: updated, error: rpcError } = await admin.rpc('admin_moderate_entity', {
      _entity_id: entityId,
      _action: action,
      _actor_id: user.id,
      _reason: reason ?? null,
      _expected_status: expectedStatus ?? null,
    });

    if (rpcError) {
      const msg = rpcError.message ?? '';
      if (msg.includes('not_found')) return json(404, { error: 'Entity not found' });
      if (msg.includes('conflict')) return json(409, { error: msg });
      if (msg.includes('forbidden') || msg.includes('insufficient_privilege')) return json(403, { error: msg });
      if (msg.includes('reason_required') || msg.includes('invalid_action')) return json(400, { error: msg });
      console.error('admin_moderate_entity failed', rpcError);
      return json(500, { error: 'Moderation failed' });
    }

    return json(200, { success: true, entity: updated });
  } catch (err) {
    console.error('moderate-entity unexpected', err);
    return json(500, { error: 'Internal server error' });
  }
});
