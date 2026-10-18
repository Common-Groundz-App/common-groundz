// Observational only: GET/SELECT, no persistence, deletion, cancellation or jobs.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.118.0/cors'
import { classify, compareSets, scanAssets, type Asset, type Upload, type Reference, type Mapping } from './classifier.ts'
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return reply({ error: 'method_not_allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) return reply({ error: 'server_not_configured' }, 500)
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'unauthorized' }, 401)
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
  const { data: claims, error: authError } = await client.auth.getClaims(authorization.slice(7))
  if (authError || !claims?.claims?.sub) return reply({ error: 'unauthorized' }, 401)
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: role, error: roleError } = await admin.rpc('has_role', { _user_id: claims.claims.sub, _role: 'admin' })
  if (roleError || role !== true) return reply({ error: 'forbidden' }, 403)
  const muxId = Deno.env.get('MUX_TOKEN_ID'), muxSecret = Deno.env.get('MUX_TOKEN_SECRET')
  if (!muxId || !muxSecret) return reply({ error: 'mux_not_configured' }, 500)
  try {
    // Pagination on every DB surface: no silent PostgREST default-row limit.
    async function rows(table: string, columns: string) {
      const result: Record<string, unknown>[] = []
      for (let offset = 0; offset < 100000; offset += 500) {
        const { data, error } = await admin.from(table).select(columns).order('id').range(offset, offset + 499)
        if (error || !data) throw new Error('database_scan_failed')
        result.push(...data as unknown as Record<string, unknown>[])
        if (data.length < 500) return result
      }
      throw new Error('database_scan_limit')
    }
    const started = new Date().toISOString()
    const [uploads, mappings, posts, reviews, updates] = await Promise.all([
      rows('mux_uploads', 'id,upload_id,asset_id,playback_id,status,is_test,created_at,expires_at'),
      rows('mux_upload_mappings', 'id,mux_upload_id,content_type,content_id,status'),
      rows('posts', 'id,is_deleted,media'), rows('reviews', 'id,media'), rows('review_updates', 'id,review_id,media'),
    ])
    const reviewIds = new Set(reviews.map(r => r.id))
    const references: Reference[] = [
      ...posts.map(r => ({ kind: 'post', content_id: String(r.id), soft_deleted: r.is_deleted === true, media: r.media as Reference['media'] })),
      ...reviews.map(r => ({ kind: 'review', content_id: String(r.id), media: r.media as Reference['media'] })),
      ...updates.map(r => ({ kind: 'review_update', content_id: String(r.id), parent_missing: !reviewIds.has(r.review_id), media: r.media as Reference['media'] })),
    ]
    const db = { uploads: uploads as unknown as Upload[], mappings: mappings as unknown as Mapping[], references, complete: true }
    const get = async (path: string) => {
      try {
        const res = await fetch(`https://api.mux.com/video/v1${path}`, { headers: { Authorization: 'Basic ' + btoa(`${muxId}:${muxSecret}`) }, signal: AbortSignal.timeout(10000) })
        const raw = await res.text()
        let body
        try { body = JSON.parse(raw) } catch { return { status: 0 } }
        return { status: res.status, body }
      } catch { return { status: 0 } }
    }
    const scan = await scanAssets(get)
    const sets = compareSets(scan.assets, db.uploads)
    const assets = new Map(scan.assets.map(a => [a.id, a]))
    const savedOnlyIds = references.flatMap(r => r.media ?? []).map(m => m.mux_asset_id).filter((id): id is string => typeof id === 'string' && id.length > 0)
    const observations = []
    const now = Date.now()
    for (const id of new Set([...sets.mux_present, ...sets.database_recorded, ...savedOnlyIds])) {
      const present = assets.get(id)
      // Even a complete list absence is not a 404: probe each suspected gap.
      const probe = present ? undefined : await get(`/assets/${encodeURIComponent(id)}`)
      const probedAsset = probe?.status === 200 ? probe.body?.data as Asset : undefined
      const presence = present || probedAsset ? 'present' : probe?.status === 404 ? 'external_missing' : 'inconclusive'
      observations.push({ ...classify(id, present ?? probedAsset, presence, db, scan.complete, now), probe_http_status: present ? 200 : probe?.status })
    }
    return reply({ mode: 'read_only', started_at: started, finished_at: new Date().toISOString(),
      atomic_snapshot: false, inventory_complete: scan.complete,
      scan: { complete: scan.complete, pages: 'pages' in scan ? scan.pages : null, failed_page: 'failed_page' in scan ? scan.failed_page : null }, sets,
      upload_rows: uploads.length, observations,
      uploads_without_asset: db.uploads.filter(u => !u.asset_id).map(u => ({ upload_record_id: u.id, status: u.status,
        expires_at: u.expires_at, reference_state: references.some(r => r.media?.some(m => m.mux_upload_id === u.upload_id)) ? 'saved_reference' : 'ambiguous_needs_upload_reconciliation' })),
      warnings: ['No durable active-composer ledger; candidates are not deletion authorization.', 'Posts lack deleted_at; historical deleted references remain ambiguous.', 'DB and Mux are separate observations; concurrent changes require a new audit.'],
      flags: (await admin.rpc('get_public_flags')).data })
  } catch { return reply({ error: 'inventory_failed_inconclusive' }, 503) }
})