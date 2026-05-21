// mux-register-mappings — Phase 3A
// Links Mux uploads to a specific media slot on a post the caller owns.
// JWT-required (default verify_jwt=true). Also validates in code as defense in depth.

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

interface RegisterItem {
  mux_upload_id: string
  media_index: number
}

interface ItemResult {
  mux_upload_id: string
  status:
    | 'registered'
    | 'already_registered'
    | 'conflict'
    | 'slot_taken'
    | 'patched'
    | 'noop_not_ready'
    | 'noop_already_patched'
    | 'noop_orphaned'
    | 'noop_errored'
    | 'orphaned'
    | 'errored'
  error?: string
  mapping_id?: string
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

  // Parse + validate body
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
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0 || itemsRaw.length > 10) {
    return json({ error: 'invalid_items' }, 400, cors)
  }
  const items: RegisterItem[] = []
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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Verify caller owns the post
  const { data: post, error: postErr } = await admin
    .from('posts')
    .select('id, user_id')
    .eq('id', contentId)
    .maybeSingle()

  if (postErr) {
    console.error('post_lookup_failed', postErr)
    return json({ error: 'post_lookup_failed' }, 500, cors)
  }
  if (!post) return json({ error: 'post_not_found' }, 404, cors)
  if (post.user_id !== userId) return json({ error: 'forbidden' }, 403, cors)

  const results: ItemResult[] = []

  for (const item of items) {
    const res: ItemResult = { mux_upload_id: item.mux_upload_id, status: 'errored' }

    try {
      // Try insert
      const { data: inserted, error: insertErr } = await admin
        .from('mux_upload_mappings')
        .insert({
          mux_upload_id: item.mux_upload_id,
          content_type: 'post',
          content_id: contentId,
          media_index: item.media_index,
          user_id: userId,
        })
        .select('id')
        .maybeSingle()

      let mappingId: string | null = inserted?.id ?? null
      let wasNewlyInserted = !!inserted?.id

      if (insertErr) {
        // 23505 = unique_violation
        const code = (insertErr as { code?: string }).code
        if (code !== '23505') {
          console.error('mapping_insert_failed', { mux_upload_id: item.mux_upload_id, err: insertErr })
          res.status = 'errored'
          res.error = 'insert_failed'
          results.push(res)
          continue
        }

        // Conflict: either same mux_upload_id, or slot already taken.
        const { data: existingByUpload } = await admin
          .from('mux_upload_mappings')
          .select('id, user_id, content_type, content_id, media_index')
          .eq('mux_upload_id', item.mux_upload_id)
          .maybeSingle()

        if (existingByUpload) {
          if (
            existingByUpload.user_id === userId &&
            existingByUpload.content_type === 'post' &&
            existingByUpload.content_id === contentId &&
            existingByUpload.media_index === item.media_index
          ) {
            res.status = 'already_registered'
            res.mapping_id = existingByUpload.id
            mappingId = existingByUpload.id
            wasNewlyInserted = false
          } else {
            res.status = 'conflict'
            res.error = 'upload_already_mapped_to_different_content'
            results.push(res)
            continue
          }
        } else {
          // Must be slot collision
          res.status = 'slot_taken'
          res.error = 'slot_already_mapped'
          results.push(res)
          continue
        }
      } else {
        res.status = 'registered'
        res.mapping_id = mappingId ?? undefined
      }

      // Catch-up: if Mux upload is already ready/errored, patch now.
      if (mappingId) {
        const { data: upload } = await admin
          .from('mux_uploads')
          .select('status')
          .eq('upload_id', item.mux_upload_id)
          .maybeSingle()

        if (upload && (upload.status === 'ready' || upload.status === 'errored')) {
          const { data: rpcResult, error: rpcErr } = await admin.rpc('patch_content_media_from_mux', {
            p_mapping_id: mappingId,
          })

          if (rpcErr) {
            console.error('patch_rpc_failed', { mapping_id: mappingId, mux_upload_id: item.mux_upload_id, err: rpcErr })
            // Best-effort mark errored
            await admin
              .from('mux_upload_mappings')
              .update({
                status: 'errored',
                last_error: String(rpcErr.message ?? rpcErr).slice(0, 500),
                retry_count: 0,
              })
              .eq('id', mappingId)
            res.status = 'errored'
            res.error = 'patch_failed'
          } else {
            const r = String(rpcResult ?? '')
            console.log(JSON.stringify({ fn: 'mux-register-mappings', mapping_id: mappingId, mux_upload_id: item.mux_upload_id, result: r }))
            // Map RPC result onto response status when stronger than 'registered'
            if (
              r === 'patched' ||
              r === 'noop_not_ready' ||
              r === 'noop_already_patched' ||
              r === 'noop_orphaned' ||
              r === 'noop_errored' ||
              r === 'orphaned'
            ) {
              res.status = r as ItemResult['status']
            }
          }
        } else {
          console.log(JSON.stringify({ fn: 'mux-register-mappings', mapping_id: mappingId, mux_upload_id: item.mux_upload_id, result: wasNewlyInserted ? 'registered' : 'already_registered' }))
        }
      }
    } catch (e) {
      console.error('item_unhandled', { mux_upload_id: item.mux_upload_id, e: String(e) })
      res.status = 'errored'
      res.error = 'internal_error'
    }

    results.push(res)
  }

  return json({ results }, 200, cors)
})
