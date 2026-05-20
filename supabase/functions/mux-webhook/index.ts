// mux-webhook — Phase 1
// Verifies Mux signature on raw body, deduplicates by event_id, updates mux_uploads.
// verify_jwt = false (signature is the auth).

import { createClient } from 'npm:@supabase/supabase-js@2'

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]
  return r === 0
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  const bytes = new Uint8Array(sig)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

function parseMuxSignature(header: string): { t: string; v1: string } | null {
  const parts = Object.fromEntries(
    header.split(',').map(p => {
      const idx = p.indexOf('=')
      return idx > 0 ? [p.slice(0, idx).trim(), p.slice(idx + 1).trim()] : [p.trim(), '']
    }),
  )
  if (!parts.t || !parts.v1) return null
  return { t: parts.t, v1: parts.v1 }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method_not_allowed', { status: 405 })
  }

  // 1. Read raw body FIRST — never parse JSON before verification.
  const rawBody = await req.text()

  const sigHeader = req.headers.get('Mux-Signature') ?? ''
  const parsed = parseMuxSignature(sigHeader)
  if (!parsed) return new Response('bad_signature', { status: 401 })

  const secret = Deno.env.get('MUX_WEBHOOK_SECRET')
  if (!secret) {
    console.error('MUX_WEBHOOK_SECRET not configured')
    return new Response('not_configured', { status: 500 })
  }

  // 2. Verify signature (HMAC of "t.rawBody").
  const expected = await hmacSha256Hex(secret, `${parsed.t}.${rawBody}`)
  if (!timingSafeEqual(hexToBytes(expected), hexToBytes(parsed.v1))) {
    return new Response('bad_signature', { status: 401 })
  }

  // 3. Replay protection: timestamp within 5 minutes.
  const ts = Number(parsed.t)
  if (!Number.isFinite(ts)) return new Response('bad_timestamp', { status: 401 })
  const ageSec = Math.abs(Date.now() / 1000 - ts)
  if (ageSec > 300) return new Response('stale', { status: 401 })

  // 4. Safe to parse.
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('bad_json', { status: 400 })
  }

  const eventId: string | undefined = event?.id
  const eventType: string | undefined = event?.type
  if (!eventId || !eventType) return new Response('missing_fields', { status: 400 })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Correlate IDs.
  const data = event?.data ?? {}
  const assetId: string | undefined = data?.id && eventType.startsWith('video.asset')
    ? data.id
    : data?.asset_id
  const uploadId: string | undefined = data?.upload_id

  // 5. Durable idempotency: insert event_id, no-op on conflict.
  const { error: dedupErr, data: dedupRow } = await admin
    .from('mux_webhook_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      upload_id: uploadId ?? null,
      asset_id: assetId ?? null,
    })
    .select('event_id')
    .maybeSingle()

  if (dedupErr) {
    // PK conflict => already seen
    if ((dedupErr as any).code === '23505') {
      return new Response('duplicate_ok', { status: 200 })
    }
    console.error('dedup_insert_failed', dedupErr)
    return new Response('dedup_failed', { status: 500 })
  }
  if (!dedupRow) return new Response('duplicate_ok', { status: 200 })

  // 6. Route by event type.
  try {
    const nowIso = new Date().toISOString()

    if (eventType === 'video.upload.asset_created') {
      if (!uploadId) return new Response('ok', { status: 200 })
      await admin
        .from('mux_uploads')
        .update({
          asset_id: assetId ?? null,
          status: 'asset_created',
          last_event_at: nowIso,
        })
        .eq('upload_id', uploadId)
    } else if (eventType === 'video.asset.ready') {
      const playbackId: string | undefined = data?.playback_ids?.[0]?.id
      const duration = typeof data?.duration === 'number' ? data.duration : null
      const aspectRatio = data?.aspect_ratio ?? null
      const maxResolution = data?.max_stored_resolution ?? null

      const patch: Record<string, unknown> = {
        status: 'ready',
        playback_id: playbackId ?? null,
        duration,
        aspect_ratio: aspectRatio,
        max_resolution: maxResolution,
        last_event_at: nowIso,
      }

      if (assetId) {
        const { data: updated } = await admin
          .from('mux_uploads').update(patch).eq('asset_id', assetId).select('id')
        if (!updated?.length && uploadId) {
          await admin.from('mux_uploads').update(patch).eq('upload_id', uploadId)
        }
      } else if (uploadId) {
        await admin.from('mux_uploads').update(patch).eq('upload_id', uploadId)
      }
    } else if (eventType === 'video.asset.errored' || eventType === 'video.upload.errored') {
      const errMsg = data?.errors?.messages?.join('; ') ?? data?.error?.message ?? 'unknown'
      const patch = { status: 'errored' as const, error: errMsg, last_event_at: nowIso }
      if (assetId) {
        const { data: updated } = await admin
          .from('mux_uploads').update(patch).eq('asset_id', assetId).select('id')
        if (!updated?.length && uploadId) {
          await admin.from('mux_uploads').update(patch).eq('upload_id', uploadId)
        }
      } else if (uploadId) {
        await admin.from('mux_uploads').update(patch).eq('upload_id', uploadId)
      }
    } else if (eventType === 'video.upload.cancelled') {
      if (uploadId) {
        await admin
          .from('mux_uploads')
          .update({ status: 'cancelled', last_event_at: nowIso })
          .eq('upload_id', uploadId)
      }
    } else {
      // Unhandled event — already logged for audit, ack 200.
    }
  } catch (e) {
    console.error('handler_error', eventType, e)
    return new Response('handler_error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
})
