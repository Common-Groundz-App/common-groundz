// mux-sync-post-mappings — Phase 3C.1
// Reconciles mux_upload_mappings for a post after the owner edits its media.
// Auth posture mirrors mux-register-mappings: JWT required, owner check,
// validate body, then delegate all mapping writes to sync_mux_post_mappings RPC.

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

interface SyncItem {
  mux_upload_id: string
  media_index: number
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
  const userId = claimsRes.claims.sub as string

  let body: unknown
  try { body = await req.json() } catch {
    return json({ error: 'invalid_json' }, 400, cors)
  }
  const b = body as Record<string, unknown>
  const contentType = b?.content_type
  const contentId = b?.content_id
  const itemsRaw = b?.items

  if (contentType !== 'post') {
    return json({ error: 'unsupported_content_type' }, 400, cors)
  }
  if (typeof contentId !== 'string' || !UUID_RE.test(contentId)) {
    return json({ error: 'invalid_content_id' }, 400, cors)
  }
  // items may be empty: signals "all mux items removed from this post".
  if (!Array.isArray(itemsRaw) || itemsRaw.length > 50) {
    return json({ error: 'invalid_items' }, 400, cors)
  }

  const items: SyncItem[] = []
  for (const raw of itemsRaw) {
    const it = raw as Record<string, unknown>
    if (typeof it?.mux_upload_id !== 'string' || it.mux_upload_id.length === 0 || it.mux_upload_id.length > 200) {
      return json({ error: 'invalid_mux_upload_id' }, 400, cors)
    }
    if (typeof it?.media_index !== 'number' || !Number.isInteger(it.media_index) || it.media_index < 0 || it.media_index > 50) {
      return json({ error: 'invalid_media_index' }, 400, cors)
    }
    items.push({ mux_upload_id: it.mux_upload_id, media_index: it.media_index })
  }

  // Reject duplicate mux_upload_ids cleanly (don't surface raw SQL PK violation).
  if (new Set(items.map(i => i.mux_upload_id)).size !== items.length) {
    return json({ error: 'duplicate_mux_upload_id' }, 400, cors)
  }
  // Reject duplicate media_index values too.
  if (new Set(items.map(i => i.media_index)).size !== items.length) {
    return json({ error: 'duplicate_media_index' }, 400, cors)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Verify caller owns the post and that the claimed indices actually point at
  // the claimed mux_upload_ids in posts.media (defense against client confusion).
  const { data: post, error: postErr } = await admin
    .from('posts')
    .select('id, user_id, media')
    .eq('id', contentId)
    .maybeSingle()

  if (postErr) {
    console.error('post_lookup_failed', postErr)
    return json({ error: 'post_lookup_failed' }, 500, cors)
  }
  if (!post) return json({ error: 'post_not_found' }, 404, cors)
  if (post.user_id !== userId) return json({ error: 'forbidden' }, 403, cors)

  const media: any[] = Array.isArray(post.media) ? post.media : []
  for (const item of items) {
    const slot = media[item.media_index]
    if (!slot || slot.mux_upload_id !== item.mux_upload_id) {
      return json({ error: 'media_index_mismatch', media_index: item.media_index }, 400, cors)
    }
  }

  const { data: rpcData, error: rpcErr } = await admin.rpc('sync_mux_post_mappings', {
    p_content_id: contentId,
    p_items: items,
  })

  if (rpcErr) {
    console.error('sync_rpc_failed', { content_id: contentId, err: rpcErr })
    return json({ error: 'sync_failed', detail: rpcErr.message }, 500, cors)
  }

  const results = (rpcData as { results?: unknown })?.results ?? []
  console.log(JSON.stringify({
    fn: 'mux-sync-post-mappings',
    content_id: contentId,
    user_id: userId,
    item_count: items.length,
    results,
  }))

  return json({ results }, 200, cors)
})
