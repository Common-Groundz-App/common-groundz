// mux-reconcile-upload — Phase 3A
// Admin / service-role tool to manually reconcile a single Mux upload mapping.
// JWT-required (default verify_jwt=true). Two-tier access:
//   - service_role JWT → allowed
//   - authenticated user with role 'admin' → allowed
//   - everyone else → 403

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsBase: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

function getAllowedOrigins(): string[] {
  return (Deno.env.get('MUX_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

function buildCors(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins()
  const h = { ...corsBase }
  if (origin && allowed.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin
  } else if (!origin && allowed.length === 0) {
    h['Access-Control-Allow-Origin'] = '*'
  }
  return h
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = buildCors(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors)

  const allowedOrigins = getAllowedOrigins()
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return json({ error: 'origin_not_allowed' }, 403, cors)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401, cors)
  }
  const token = authHeader.slice('Bearer '.length)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claimsRes, error: claimsErr } = await authClient.auth.getClaims(token)
  if (claimsErr || !claimsRes?.claims?.sub) {
    return json({ error: 'unauthorized' }, 401, cors)
  }
  const claims = claimsRes.claims as Record<string, unknown>
  const userId = claims.sub as string
  const role = (claims.role as string | undefined) ?? ''

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Authorize: service_role JWT bypasses; otherwise must be admin role
  if (role !== 'service_role') {
    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    })
    if (roleErr) {
      console.error('has_role_failed', roleErr)
      return json({ error: 'authorization_check_failed' }, 500, cors)
    }
    if (!isAdmin) return json({ error: 'forbidden' }, 403, cors)
  }

  // Parse body
  let body: unknown
  try { body = await req.json() } catch {
    return json({ error: 'invalid_json' }, 400, cors)
  }
  const b = body as Record<string, unknown>
  const muxUploadId = b?.mux_upload_id
  if (typeof muxUploadId !== 'string' || muxUploadId.length === 0 || muxUploadId.length > 200) {
    return json({ error: 'invalid_mux_upload_id' }, 400, cors)
  }

  const { data: mapping, error: lookupErr } = await admin
    .from('mux_upload_mappings')
    .select('id')
    .eq('mux_upload_id', muxUploadId)
    .maybeSingle()

  if (lookupErr) {
    console.error('mapping_lookup_failed', lookupErr)
    return json({ error: 'mapping_lookup_failed' }, 500, cors)
  }
  if (!mapping) return json({ error: 'mapping_not_found' }, 404, cors)

  const { data: rpcResult, error: rpcErr } = await admin.rpc('patch_content_media_from_mux', {
    p_mapping_id: mapping.id,
  })

  if (rpcErr) {
    console.error('patch_rpc_failed', { mapping_id: mapping.id, mux_upload_id: muxUploadId, err: rpcErr })
    await admin
      .from('mux_upload_mappings')
      .update({
        status: 'errored',
        last_error: String(rpcErr.message ?? rpcErr).slice(0, 500),
      })
      .eq('id', mapping.id)
    return json({ error: 'patch_failed', mapping_id: mapping.id }, 500, cors)
  }

  const result = String(rpcResult ?? '')
  console.log(JSON.stringify({
    fn: 'mux-reconcile-upload',
    mapping_id: mapping.id,
    mux_upload_id: muxUploadId,
    result,
  }))

  // Surface last_error for the admin
  const { data: refreshed } = await admin
    .from('mux_upload_mappings')
    .select('last_error, status, mux_status_snapshot')
    .eq('id', mapping.id)
    .maybeSingle()

  return json({
    status: result,
    mapping_id: mapping.id,
    mapping_status: refreshed?.status ?? null,
    mux_status_snapshot: refreshed?.mux_status_snapshot ?? null,
    last_error: refreshed?.last_error ?? null,
  }, 200, cors)
})
