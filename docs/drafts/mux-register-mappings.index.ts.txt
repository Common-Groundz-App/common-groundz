// DRAFT (Phase 4 Step 2) — replaces supabase/functions/mux-register-mappings/index.ts
// after the migration runs. Kept as .txt so it is NOT auto-deployed yet.
// Request shape, CORS, auth and ownership check unchanged. No direct inserts:
// the save already linked the video (with media_id); this only runs the
// saved-Post-derived catch-up.

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401, cors)
  const token = authHeader.slice('Bearer '.length)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const { data: claimsRes, error: claimsErr } = await authClient.auth.getClaims(token)
  if (claimsErr || !claimsRes?.claims?.sub) return json({ error: 'unauthorized' }, 401, cors)
  const userId = claimsRes.claims.sub as string

  let body: unknown
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400, cors) }
  const b = body as Record<string, unknown>
  if (b?.content_type !== 'post') return json({ error: 'unsupported_content_type' }, 400, cors)
  const contentId = b?.content_id
  if (typeof contentId !== 'string' || !UUID_RE.test(contentId)) return json({ error: 'invalid_content_id' }, 400, cors)
  if (!Array.isArray(b?.items) || b.items.length === 0 || b.items.length > 10) {
    return json({ error: 'invalid_items' }, 400, cors)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: post, error: postErr } = await admin.from('posts').select('id, user_id').eq('id', contentId).maybeSingle()
  if (postErr) { console.error('post_lookup_failed', postErr); return json({ error: 'post_lookup_failed' }, 500, cors) }
  if (!post) return json({ error: 'post_not_found' }, 404, cors)
  if (post.user_id !== userId) return json({ error: 'forbidden' }, 403, cors)

  const { data: rpcData, error: rpcErr } = await admin.rpc('sync_mux_post_mappings', {
    p_content_id: contentId,
    p_items: [],
  })
  if (rpcErr) {
    console.error('register_rpc_failed', { content_id: contentId, err: rpcErr })
    return json({ error: 'register_failed' }, 500, cors)
  }

  const results = (rpcData as { results?: unknown })?.results ?? []
  console.log(JSON.stringify({ fn: 'mux-register-mappings', content_id: contentId, user_id: userId, results }))
  return json({ results }, 200, cors)
})
