// Phase 4 worker loop — dependencies injected so the fencing and RPC-error
// handling are unit-tested without Mux or a database. REVIEW DRAFT.
import {
  canClaimAnother, canaryPasses, classifyDelete, classifyPreGet, classifyVerifyGet, parseRetryAfter,
  type HttpResult, type Outcome,
} from './outcome.ts'

export type RpcResult<T> = { data: T | null; error: unknown }
export type Claim = { candidate_id: string; mux_asset_id: string; upload_record_id: string | null; lease_id: string; kind: string }

export interface RunDeps {
  now(): number
  newRunId(): string
  acquire(runId: string): Promise<RpcResult<{ acquired: boolean; reason?: string; run_lease_token?: string; generation?: number }>>
  claim(runId: string, token: string, candidateId: string | null): Promise<RpcResult<{ claimed: boolean; reason?: string } & Partial<Claim>>>
  gate(runId: string, token: string, candidateId: string, leaseId: string): Promise<RpcResult<boolean>>
  finalize(runId: string, candidateId: string, leaseId: string, outcome: Outcome, retryAfter: number | null): Promise<RpcResult<{ accepted: boolean; reason?: string; status?: string }>>
  release(runId: string, token: string, status: 'succeeded' | 'failed', result: unknown, error: string | null): Promise<RpcResult<{ released: boolean; reason?: string }>>
  mux(method: 'GET' | 'DELETE', assetId: string): Promise<{ r: HttpResult; body: unknown }>
  canaryAssetId: string
}

export type RunReport = {
  run_id: string
  aborted?: string
  claims: number
  results: Array<{ candidate_id: string; outcome: Outcome; accepted: boolean }>
  breaker: string | null
  deletes_sent: number
  released?: boolean
}

const ra = (r: HttpResult) => (r.kind === 'status' ? parseRetryAfter(r.retryAfter) : null)

export async function runLiveWorker(deps: RunDeps, exact: { candidateId: string; expectedAssetId: string } | null): Promise<RunReport> {
  const started = deps.now()
  const runId = deps.newRunId()
  const rep: RunReport = { run_id: runId, claims: 0, results: [], breaker: null, deletes_sent: 0 }

  // 1. Global run lease (token-fenced, one live worker per environment)
  const acq = await deps.acquire(runId)
  if (acq.error || !acq.data) { rep.aborted = 'run_lease_rpc_error'; return rep }
  if (!acq.data.acquired || !acq.data.run_lease_token) { rep.aborted = acq.data.reason ?? 'run_lease_refused'; return rep }
  const token = acq.data.run_lease_token

  const finish = async (status: 'succeeded' | 'failed', err: string | null) => {
    const rel = await deps.release(runId, token, status, { claims: rep.claims, results: rep.results, breaker: rep.breaker, deletes_sent: rep.deletes_sent }, err)
    rep.released = !rel.error && rel.data?.released === true
    return rep
  }

  // 2. Environment canary
  const can = await deps.mux('GET', deps.canaryAssetId)
  if (!canaryPasses(can.r, can.body)) { rep.aborted = 'environment_canary_failed'; return finish('failed', 'environment_canary_failed') }

  const fin = async (c: Claim, outcome: Outcome, retryAfter: number | null): Promise<boolean> => {
    const f = await deps.finalize(runId, c.candidate_id, c.lease_id, outcome, retryAfter)
    const accepted = !f.error && f.data?.accepted === true
    rep.results.push({ candidate_id: c.candidate_id, outcome, accepted })
    if (!accepted) rep.breaker = f.error ? 'finalize_rpc_error' : `finalize_rejected:${f.data?.reason ?? 'unknown'}`
    return accepted
  }

  // 3. JIT loop
  while (!rep.breaker && canClaimAnother(deps.now() - started, rep.claims)) {
    const cl = await deps.claim(runId, token, exact?.candidateId ?? null)
    if (cl.error || !cl.data) { rep.breaker = 'claim_rpc_error'; break }
    if (!cl.data.claimed) {
      if (cl.data.reason !== 'none_claimable') rep.breaker = cl.data.reason ?? 'claim_refused'
      break
    }
    const c = cl.data as Claim
    rep.claims++
    if (exact && c.mux_asset_id !== exact.expectedAssetId) { // DB already enforces; defence in depth
      await fin(c, 'aborted_before_delete', null); rep.breaker = 'exact_target_mismatch'; break
    }

    const pre = await deps.mux('GET', c.mux_asset_id)
    const p = classifyPreGet(pre.r, pre.body, c.upload_record_id)
    if (!p.proceed) {
      if (!(await fin(c, p.outcome, ra(pre.r)))) break
      if (p.tripBreaker) rep.breaker = p.outcome
      if (exact) break
      continue
    }

    // Kill switch + run-lease token + candidate lease, immediately before DELETE.
    const g = await deps.gate(runId, token, c.candidate_id, c.lease_id)
    if (g.error || g.data !== true) {
      await fin(c, 'aborted_before_delete', null)
      rep.breaker = g.error ? 'gate_rpc_error' : 'mode_or_lease_lost'
      break
    }

    rep.deletes_sent++
    const del = await deps.mux('DELETE', c.mux_asset_id)
    const step = classifyDelete(del.r)
    let outcome: Outcome, trip: boolean, retryAfter: number | null
    if (step.done) { outcome = step.outcome; trip = step.tripBreaker; retryAfter = ra(del.r) }
    else {
      const ver = await deps.mux('GET', c.mux_asset_id)
      const v = classifyVerifyGet(ver.r)
      outcome = v.outcome; trip = v.tripBreaker; retryAfter = ra(ver.r)
    }
    if (!(await fin(c, outcome, retryAfter))) break
    if (trip) rep.breaker = outcome
    if (exact) break
  }

  return finish(rep.breaker && rep.breaker !== 'retryable' ? 'failed' : 'succeeded', rep.breaker)
}
