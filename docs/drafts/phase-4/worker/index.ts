// mux-cleanup-worker — REVIEW DRAFT. Lives under docs/ so it is NOT deployed.
// Server-to-server only: caller must present the service-role key. Browsers,
// admins and the dashboard can never mint or receive destructive leases.
//
// Run start:
//   1. auth check  2. mode must be 'live' (claim also re-checks)
//   3. credential-environment canary: GET MUX_ENV_CANARY_ASSET_ID must be
//      200 with passthrough env/app matching. A wrong-environment token
//      would 404 every asset and must never be read as "already deleted".
// Per asset (JIT, one at a time, while budget remains):
//   claim → pre-GET metadata check → lease_valid (mode + lease) → DELETE
//   → [404 → verify GET] → finalize (outcome only; server picks state)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { canClaimAnother, classifyDelete, classifyPreGet, classifyVerifyGet, parseRetryAfter, type HttpResult, type Outcome, LIMITS } from './outcome.ts'

const APP = 'common-groundz', ENV = 'live'

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const started = Date.now()
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (req.method !== 'POST' || !service || !timingSafeEqual(bearer, service)) return json({ error: 'forbidden' }, 403)

  let body: { candidate_id?: string; expected_mux_asset_id?: string } = {}
  try { body = await req.json() } catch { body = {} }
  const exact = body.candidate_id ?? null
  if (exact && (!UUID.test(exact) || typeof body.expected_mux_asset_id !== 'string')) return json({ error: 'invalid_exact_target' }, 400)

  const muxId = Deno.env.get('MUX_TOKEN_ID'), muxSecret = Deno.env.get('MUX_TOKEN_SECRET'), canary = Deno.env.get('MUX_ENV_CANARY_ASSET_ID')
  if (!muxId || !muxSecret || !canary) return json({ error: 'not_configured' }, 503)
  const auth = 'Basic ' + btoa(`${muxId}:${muxSecret}`)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, service, { auth: { persistSession: false } })
  const runId = crypto.randomUUID()

  const mux = async (method: 'GET' | 'DELETE', id: string): Promise<{ r: HttpResult; body: unknown }> => {
    try {
      const res = await fetch(`https://api.mux.com/video/v1/assets/${encodeURIComponent(id)}`,
        { method, headers: { Authorization: auth }, signal: AbortSignal.timeout(LIMITS.REQUEST_TIMEOUT_MS) })
      let b: unknown = null
      try { b = method === 'GET' && res.status === 200 ? await res.json() : (await res.body?.cancel(), null) } catch { b = null }
      return { r: { kind: 'status', status: res.status, retryAfter: res.headers.get('retry-after') }, body: b }
    } catch { return { r: { kind: 'network' }, body: null } }
  }

  // canary
  const can = await mux('GET', canary)
  const canOk = classifyPreGet(can.r, can.body, { app: APP, env: ENV, uploadRecordId: null })
  const canEnv = (can.body as { data?: { passthrough?: string } })?.data?.passthrough
  let canaryPass = false
  try { const p = canEnv ? JSON.parse(canEnv) : null; canaryPass = can.r.kind === 'status' && can.r.status === 200 && p?.app === APP && p?.env === ENV } catch { /* fail closed */ }
  if (!canaryPass) return json({ run_id: runId, aborted: 'environment_canary_failed', canary: 'proceed' in canOk ? 'checked' : 'failed' }, 200)

  const results: Array<{ candidate_id: string; outcome: Outcome | 'skipped' }> = []
  let breaker: string | null = null
  let claims = 0

  while (!breaker && canClaimAnother(Date.now() - started, claims)) {
    const { data: claim, error } = await db.rpc('mux_cleanup_claim_live', { p_run_id: runId, p_candidate_id: exact })
    if (error) { breaker = 'claim_refused'; break }
    if (!claim) break
    claims++
    const c = claim as { candidate_id: string; mux_asset_id: string; upload_record_id: string | null; lease_id: string }
    if (exact && c.mux_asset_id !== body.expected_mux_asset_id) { breaker = 'exact_target_mismatch'; break } // DB already enforces

    const finalize = async (outcome: Outcome, retryAfter: number | null = null) => {
      await db.rpc('mux_cleanup_finalize_live', { p_run_id: runId, p_candidate_id: c.candidate_id, p_lease_id: c.lease_id, p_outcome: outcome, p_retry_after_seconds: retryAfter })
      results.push({ candidate_id: c.candidate_id, outcome })
    }

    const pre = await mux('GET', c.mux_asset_id)
    const preC = classifyPreGet(pre.r, pre.body, { app: APP, env: ENV, uploadRecordId: c.upload_record_id })
    if (!preC.proceed && 'outcome' in preC) {
      await finalize(preC.outcome, pre.r.kind === 'status' ? parseRetryAfter(pre.r.retryAfter) : null)
      if (preC.tripBreaker) breaker = preC.outcome
      continue
    }

    // per-DELETE kill switch + lease fence
    const { data: ok } = await db.rpc('mux_cleanup_lease_valid', { p_candidate_id: c.candidate_id, p_lease_id: c.lease_id })
    if (ok !== true) { await finalize('aborted_before_delete'); breaker = 'mode_or_lease_changed'; break }

    const del = await mux('DELETE', c.mux_asset_id)
    const step = classifyDelete(del.r)
    if (step.done) {
      await finalize(step.outcome, del.r.kind === 'status' ? parseRetryAfter(del.r.retryAfter) : null)
      if (step.tripBreaker) breaker = step.outcome
      continue
    }
    const ver = await mux('GET', c.mux_asset_id)
    const v = classifyVerifyGet(ver.r)
    await finalize(v.outcome, ver.r.kind === 'status' ? parseRetryAfter(ver.r.retryAfter) : null)
    if (v.tripBreaker) breaker = v.outcome
    if (exact) break
  }

  return json({ run_id: runId, claims, results, breaker, elapsed_ms: Date.now() - started })
})
