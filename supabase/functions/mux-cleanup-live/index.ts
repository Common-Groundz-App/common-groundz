// Phase 4 live Mux deletion worker. Callers: hourly cron (x-cron-secret, verified
// against Vault) or a verified admin (auth.getUser + has_role). Live deletion is
// controlled only by mux_cleanup_live_control (OFF by default); every decision is
// re-checked in the database. Processes up to 10 due candidates per run.
// Every invocation — including paused runs — is recorded in mux_cleanup_live_runs
// so the admin dashboard can tell "cron ran but deletion is paused" apart from
// "cron never reached the worker". Telemetry never blocks or alters the run.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { classifyDelete } from './outcome.ts'

const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const BATCH = 10

async function processOne(db: SupabaseClient, runId: string, candidateId: string, muxAuth: string) {
  const claim = await db.rpc('mux_cleanup_claim_live', { p_run_id: runId, p_candidate_id: candidateId })
  if (claim.error || !claim.data) return { candidate_id: candidateId, error: 'claim_rpc_error' }
  if (!claim.data.claimed) return { candidate_id: candidateId, claimed: false, reason: claim.data.reason }
  const { candidate_id, mux_asset_id, lease_id } = claim.data as { candidate_id: string; mux_asset_id: string; lease_id: string }

  // Kill switch + lease, immediately before the outbound DELETE.
  const gate = await db.rpc('mux_cleanup_may_delete', { p_candidate_id: candidate_id, p_lease_id: lease_id })
  if (gate.error || gate.data !== true) {
    return { candidate_id, claimed: true, deleted: false, reason: gate.error ? 'gate_rpc_error' : 'live_disabled_or_lease_lost' }
  }

  let status: number | null = null
  try {
    const res = await fetch(`https://api.mux.com/video/v1/assets/${encodeURIComponent(mux_asset_id)}`, {
      method: 'DELETE', headers: { Authorization: muxAuth }, signal: AbortSignal.timeout(10000),
    })
    status = res.status
    try { await res.body?.cancel() } catch { /* ignore */ }
  } catch { status = null }

  const outcome = classifyDelete(status)
  const fin = await db.rpc('mux_cleanup_finalize_live', {
    p_run_id: runId, p_candidate_id: candidate_id, p_lease_id: lease_id, p_outcome: outcome, p_http_status: status,
  })
  const accepted = !fin.error && fin.data?.accepted === true
  return { candidate_id, http_status: status, outcome, finalized: accepted,
    status: accepted ? fin.data.status : null, reason: accepted ? null : (fin.error ? 'finalize_rpc_error' : fin.data?.reason) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const muxId = Deno.env.get('MUX_TOKEN_ID'), muxSecret = Deno.env.get('MUX_TOKEN_SECRET')
  if (!url || !anon || !service || !muxId || !muxSecret) return reply({ error: 'server_not_configured' }, 500)
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

  // Path 1: cron secret, compared server-side against Vault. Never logged.
  let caller: 'cron' | 'admin' | null = null
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret) {
    const { data, error } = await db.rpc('is_valid_mux_cleanup_cron_secret', { p_presented: cronSecret })
    if (error || data !== true) return reply({ error: 'forbidden' }, 403)
    caller = 'cron'
  } else {
    // Path 2: admin. Token verified by Supabase Auth (getUser), then server-side role check.
    const authorization = req.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'unauthorized' }, 401)
    const token = authorization.slice(7)
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: u, error: authError } = await authClient.auth.getUser(token)
    if (authError || !u?.user?.id) return reply({ error: 'unauthorized' }, 401)
    const { data: isAdmin, error: roleError } = await db.rpc('has_role', { _user_id: u.user.id, _role: 'admin' })
    if (roleError || isAdmin !== true) return reply({ error: 'forbidden' }, 403)
    caller = 'admin'
  }

  const runId = crypto.randomUUID()

  // Telemetry: record the start of every invocation. Failures here never block the run.
  let runRowId: string | null = null
  try {
    const { data } = await db.rpc('mux_live_run_start', { p_worker_run_id: runId, p_trigger_source: caller })
    runRowId = (data as string) ?? null
  } catch { /* telemetry never blocks the run */ }
  const finish = async (status: 'succeeded' | 'paused' | 'failed', selected: number | null, results: unknown, errorCategory: string | null = null) => {
    if (!runRowId) return
    try {
      await db.rpc('mux_live_run_finish', { p_id: runRowId, p_status: status, p_selected: selected, p_results: results ?? null, p_error_category: errorCategory })
    } catch { /* telemetry never blocks the run */ }
  }

  try {
    // Paused runs are recorded explicitly so the dashboard can distinguish
    // "worker ran, deletion off" from "worker never ran".
    const { data: ctl } = await db.from('mux_cleanup_live_control').select('live_enabled').eq('id', 1).maybeSingle()
    if (ctl?.live_enabled !== true) {
      await finish('paused', 0, [])
      console.log('[mux-cleanup-live]', JSON.stringify({ run_id: runId, caller, paused: true }))
      return reply({ run_id: runId, caller, paused: true, selected: 0, results: [] })
    }

    const due = await db.rpc('mux_cleanup_due_live', { p_limit: BATCH })
    if (due.error) {
      await finish('failed', null, null, 'select_rpc_error')
      return reply({ run_id: runId, error: 'select_rpc_error' }, 500)
    }
    const ids = ((due.data ?? []) as unknown[]).map((r) => (typeof r === 'string' ? r : (r as Record<string, string>).mux_cleanup_due_live)).filter(Boolean).slice(0, BATCH)

    const muxAuth = 'Basic ' + btoa(`${muxId}:${muxSecret}`)
    const results = []
    for (const id of ids) {
      const r = await processOne(db, runId, id, muxAuth)
      results.push(r)
      if ((r as { reason?: string }).reason === 'live_disabled') break
    }
    await finish('succeeded', ids.length, results)
    console.log('[mux-cleanup-live]', JSON.stringify({ run_id: runId, caller, selected: ids.length, results }))
    return reply({ run_id: runId, caller, selected: ids.length, results })
  } catch (e) {
    console.error('[mux-cleanup-live] error', (e as Error).message)
    await finish('failed', null, null, 'worker_exception')
    return reply({ error: 'internal_error' }, 500)
  }
})
