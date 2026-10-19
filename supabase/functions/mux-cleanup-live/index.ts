// Minimal Phase 4 live Mux deletion worker. Admin-invoked, one approved
// target per run. Live deletion is controlled only by mux_cleanup_live_control
// (OFF by default); every decision is re-checked in the database.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { classifyDelete } from './outcome.ts'

const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const muxId = Deno.env.get('MUX_TOKEN_ID'), muxSecret = Deno.env.get('MUX_TOKEN_SECRET')
  if (!url || !anon || !service || !muxId || !muxSecret) return reply({ error: 'server_not_configured' }, 500)

  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'unauthorized' }, 401)
  const user = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
  const { data: claims, error: authError } = await user.auth.getClaims(authorization.slice(7))
  if (authError || !claims?.claims?.sub) return reply({ error: 'unauthorized' }, 401)
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: isAdmin, error: roleError } = await db.rpc('has_role', { _user_id: claims.claims.sub, _role: 'admin' })
  if (roleError || isAdmin !== true) return reply({ error: 'forbidden' }, 403)

  const runId = crypto.randomUUID()
  const claim = await db.rpc('mux_cleanup_claim_live', { p_run_id: runId })
  if (claim.error || !claim.data) return reply({ run_id: runId, error: 'claim_rpc_error' }, 500)
  if (!claim.data.claimed) return reply({ run_id: runId, claimed: false, reason: claim.data.reason })
  const { candidate_id, mux_asset_id, lease_id } = claim.data as { candidate_id: string; mux_asset_id: string; lease_id: string }

  // Kill switch + lease, immediately before the outbound DELETE.
  const gate = await db.rpc('mux_cleanup_may_delete', { p_candidate_id: candidate_id, p_lease_id: lease_id })
  if (gate.error || gate.data !== true) {
    return reply({ run_id: runId, claimed: true, deleted: false, reason: gate.error ? 'gate_rpc_error' : 'live_disabled_or_lease_lost' })
  }

  let status: number | null = null
  try {
    const res = await fetch(`https://api.mux.com/video/v1/assets/${encodeURIComponent(mux_asset_id)}`, {
      method: 'DELETE', headers: { Authorization: 'Basic ' + btoa(`${muxId}:${muxSecret}`) }, signal: AbortSignal.timeout(10000),
    })
    status = res.status
    try { await res.body?.cancel() } catch { /* ignore */ }
  } catch { status = null }

  const outcome = classifyDelete(status)
  const fin = await db.rpc('mux_cleanup_finalize_live', {
    p_run_id: runId, p_candidate_id: candidate_id, p_lease_id: lease_id, p_outcome: outcome, p_http_status: status,
  })
  const accepted = !fin.error && fin.data?.accepted === true
  console.log('[mux-cleanup-live]', JSON.stringify({ run_id: runId, candidate_id, http_status: status, outcome, accepted }))
  return reply({ run_id: runId, candidate_id, http_status: status, outcome, finalized: accepted,
    status: accepted ? fin.data.status : null, reason: accepted ? null : (fin.error ? 'finalize_rpc_error' : fin.data?.reason) }, accepted ? 200 : 500)
})
