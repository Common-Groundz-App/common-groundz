// mux-create-upload — Phase 1
// Creates a Mux Direct Upload URL and records a row in mux_uploads.
// Requires authenticated user. Env-driven origin allowlist + two-layer rate limit.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseUploadBody, uploadAssetSettings, persistCreatedUpload, MAX_DECLARED_BYTES } from './metadata.ts'

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
  // Only echo ACAO when origin exactly matches the allowlist.
  // Never fall back to allowed[0] — a wrong ACAO causes browsers to silently
  // reject the preflight before the request ever reaches us.
  if (origin && allowed.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin
  } else if (!origin && allowed.length === 0) {
    // No origin header (native/server) and no allowlist configured — permissive.
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

  // Origin policy: if present, must be allowlisted. If absent, allow (mobile/native).
  const allowedOrigins = getAllowedOrigins()
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return json({ error: 'origin_not_allowed' }, 403, cors)
  }

  // Auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401, cors)
  }
  const token = authHeader.slice('Bearer '.length)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return json({ error: 'server_not_configured' }, 500, cors)

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claimsRes, error: claimsErr } = await authClient.auth.getClaims(token)
  if (claimsErr || !claimsRes?.claims?.sub) {
    return json({ error: 'unauthorized' }, 401, cors)
  }
  const userId = claimsRes.claims.sub as string

  let kind: ReturnType<typeof parseUploadBody>['kind']
  try { kind = parseUploadBody(await req.text()).kind } catch (error) {
    const code = error instanceof Error ? error.message : 'invalid_body'
    return json({ error: code, ...(code === 'file_too_large' ? { max_bytes: MAX_DECLARED_BYTES } : {}) },
      code === 'file_too_large' ? 413 : 400, cors)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Rate limits (per user)
  const now = new Date()
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString()

  const [{ count: inflight, error: inflightErr }, { count: burst, error: burstErr }] =
    await Promise.all([
      admin
        .from('mux_uploads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['waiting', 'asset_created'])
        .gt('expires_at', now.toISOString()),
      admin
        .from('mux_uploads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', tenMinAgo),
    ])

  if (inflightErr || burstErr) {
    return json({ error: 'rate_limit_check_failed' }, 500, cors)
  }
  if ((inflight ?? 0) >= 10) {
    return json({ error: 'too_many_inflight_uploads' }, 429, {
      ...cors, 'Retry-After': '60',
    })
  }
  if ((burst ?? 0) >= 20) {
    return json({ error: 'rate_limited' }, 429, {
      ...cors, 'Retry-After': '60',
    })
  }

  // Runtime feature-flag check (admin-controlled via app_config)
  let uploadsEnabled = true
  let muxMode: 'test' | 'live' = 'live'
  try {
    const { data: flags, error: flagsErr } = await admin.rpc('get_public_flags')
    if (flagsErr) throw flagsErr
    const mux = (flags as any)?.mux ?? {}
    uploadsEnabled = mux.uploads_enabled ?? true
    muxMode = mux.mode === 'test' ? 'test' : 'live'
  } catch (e) {
    // Fail-safe: refuse new uploads rather than honor a stale env value.
    // Client treats MUX_DISABLED as a Supabase fallback, so user upload still succeeds.
    console.log(JSON.stringify({ event: 'get_public_flags_failed', err: String(e) }))
    return json({ error: 'MUX_DISABLED', code: 'MUX_DISABLED', reason: 'config_unavailable' }, 503, cors)
  }

  if (!uploadsEnabled) {
    console.log(JSON.stringify({ event: 'mux_disabled_block', user_id: userId }))
    return json({ error: 'MUX_DISABLED', code: 'MUX_DISABLED' }, 503, cors)
  }

  // Mux config
  const muxId = Deno.env.get('MUX_TOKEN_ID')
  const muxSecret = Deno.env.get('MUX_TOKEN_SECRET')
  if (!muxId || !muxSecret) {
    return json({ error: 'mux_not_configured' }, 500, cors)
  }
  const isTest = muxMode === 'test'

  // Allowed playback policy — single source of truth
  const TIMEOUT_SECONDS = 3600
  // Allocate before contacting Mux; mux_uploads.upload_id is NOT NULL, so a
  // pre-Mux insert would require a schema change or invented upload identity.
  const uploadRecordId = crypto.randomUUID()
  const MUX_BODY = {
    cors_origin: origin ?? '*',
    new_asset_settings: uploadAssetSettings(uploadRecordId, kind, isTest),
    timeout: TIMEOUT_SECONDS,
    test: isTest,
  }

  let muxRes: Response
  try { muxRes = await fetch('https://api.mux.com/video/v1/uploads', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${muxId}:${muxSecret}`),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(MUX_BODY),
  }) } catch {
    console.error(JSON.stringify({ event: 'mux_create_outcome_unknown', upload_record_id: uploadRecordId }))
    return json({ error: 'mux_create_failed' }, 502, cors)
  }

  if (!muxRes.ok) {
    await muxRes.text()
    console.error(JSON.stringify({ event: 'mux_create_failed', status: muxRes.status, upload_record_id: uploadRecordId }))
    return json({ error: 'mux_create_failed', status: muxRes.status }, 502, cors)
  }

  let muxJson
  try { muxJson = await muxRes.json() } catch {
    console.error(JSON.stringify({ event: 'mux_create_invalid_response', upload_record_id: uploadRecordId }))
    return json({ error: 'mux_invalid_response' }, 502, cors)
  }
  const data = muxJson?.data ?? {}
  const uploadId: string | undefined = data.id
  const uploadUrl: string | undefined = data.url
  if (!uploadId || !uploadUrl) {
    return json({ error: 'mux_invalid_response' }, 502, cors)
  }

  // Compute expires_at: prefer Mux response timeout, fallback 1h.
  const timeoutSec = typeof data.timeout === 'number' ? data.timeout : TIMEOUT_SECONDS
  const expiresAt = new Date(Date.now() + timeoutSec * 1000).toISOString()

  const persisted = await persistCreatedUpload({
    id: uploadRecordId,
    user_id: userId,
    upload_id: uploadId,
    status: 'waiting',
    is_test: isTest,
    expires_at: expiresAt,
  }, row => admin.from('mux_uploads').insert(row), event => console.error(JSON.stringify(event)))

  if (!persisted) {
    return json({ error: 'db_insert_failed' }, 500, cors)
  }

  return json({
    upload_id: uploadId,
    upload_url: uploadUrl,
    is_test: isTest,
    expires_at: expiresAt,
  }, 200, cors)
})
