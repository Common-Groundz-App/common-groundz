// mux-cleanup-worker — REVIEW DRAFT. Lives under docs/ so it is NOT deployed.
// Server-to-server only: caller must present the service-role key. Browsers,
// admins and the dashboard can never mint or receive destructive leases.
// All decisions live in run.ts / outcome.ts; this file only wires I/O.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { LIMITS } from './outcome.ts'
import { runLiveWorker, type RunDeps } from './run.ts'

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ASSET = /^[A-Za-z0-9]{10,64}$/

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (req.method !== 'POST' || !service || !timingSafeEqual(bearer, service)) return json({ error: 'forbidden' }, 403)

  let body: { candidate_id?: unknown; expected_mux_asset_id?: unknown } = {}
  try { body = await req.json() } catch { body = {} }
  let exact: { candidateId: string; expectedAssetId: string } | null = null
  if (body.candidate_id !== undefined) {
    if (typeof body.candidate_id !== 'string' || !UUID.test(body.candidate_id) ||
        typeof body.expected_mux_asset_id !== 'string' || !ASSET.test(body.expected_mux_asset_id)) {
      return json({ error: 'invalid_exact_target' }, 400)
    }
    exact = { candidateId: body.candidate_id, expectedAssetId: body.expected_mux_asset_id }
  }

  const muxId = Deno.env.get('MUX_TOKEN_ID'), muxSecret = Deno.env.get('MUX_TOKEN_SECRET'), canary = Deno.env.get('MUX_ENV_CANARY_ASSET_ID')
  if (!muxId || !muxSecret || !canary || !ASSET.test(canary)) return json({ error: 'not_configured' }, 503)
  const auth = 'Basic ' + btoa(`${muxId}:${muxSecret}`)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, service, { auth: { persistSession: false } })

  const deps: RunDeps = {
    now: () => Date.now(),
    newRunId: () => crypto.randomUUID(),
    canaryAssetId: canary,
    acquire: async (runId) => await db.rpc('mux_cleanup_acquire_run_lease', { p_run_id: runId }),
    claim: async (runId, token, cid) => await db.rpc('mux_cleanup_claim_live', { p_run_id: runId, p_run_lease_token: token, p_candidate_id: cid }),
    gate: async (runId, token, cid, lease) => await db.rpc('mux_cleanup_pre_delete_gate', { p_run_id: runId, p_run_lease_token: token, p_candidate_id: cid, p_lease_id: lease }),
    finalize: async (runId, cid, lease, outcome, ra) => await db.rpc('mux_cleanup_finalize_live', { p_run_id: runId, p_candidate_id: cid, p_lease_id: lease, p_outcome: outcome, p_retry_after_seconds: ra }),
    release: async (runId, token, status, result, err) => await db.rpc('mux_cleanup_release_run_lease', { p_run_id: runId, p_run_lease_token: token, p_status: status, p_result: result, p_error: err }),
    mux: async (method, id) => {
      try {
        const res = await fetch(`https://api.mux.com/video/v1/assets/${encodeURIComponent(id)}`,
          { method, headers: { Authorization: auth }, signal: AbortSignal.timeout(LIMITS.REQUEST_TIMEOUT_MS) })
        let b: unknown = null
        if (method === 'GET' && res.status === 200) { try { b = await res.json() } catch { b = null } }
        else { try { await res.body?.cancel() } catch { /* ignore */ } }
        return { r: { kind: 'status', status: res.status, retryAfter: res.headers.get('retry-after') }, body: b }
      } catch { return { r: { kind: 'network' }, body: null } }
    },
  }

  const report = await runLiveWorker(deps, exact)
  console.log('[mux-cleanup-worker]', JSON.stringify({ run_id: report.run_id, aborted: report.aborted, claims: report.claims, breaker: report.breaker, deletes_sent: report.deletes_sent }))
  return json(report)
})
