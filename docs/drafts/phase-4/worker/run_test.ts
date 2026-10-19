import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { runLiveWorker, type RunDeps } from './run.ts'

const U = '6f1c2a3b-1111-4222-8333-944455556666'
const okMeta = { data: { passthrough: JSON.stringify({ v: 1, app: 'commongroundz', env: 'live', kind: 'post', upload_record_id: U }), meta: { external_id: U } } }
const claimRow = { claimed: true, candidate_id: 'c1', mux_asset_id: 'asset1', upload_record_id: U, lease_id: 'L1', kind: 'initial' }

function deps(over: Partial<RunDeps> = {}) {
  const calls: string[] = []
  let claims = 0
  const d: RunDeps & { calls: string[] } = {
    calls,
    now: () => 0,
    newRunId: () => 'run-A',
    canaryAssetId: 'canary1',
    acquire: async () => ({ data: { acquired: true, run_lease_token: 'tokA', generation: 1 }, error: null }),
    claim: async () => { calls.push('claim'); return claims++ === 0 ? { data: claimRow, error: null } : { data: { claimed: false, reason: 'none_claimable' }, error: null } },
    gate: async () => { calls.push('gate'); return { data: true, error: null } },
    finalize: async (_r, _c, _l, o) => { calls.push('finalize:' + o); return { data: { accepted: true }, error: null } },
    release: async (_r, t) => { calls.push('release:' + t); return { data: { released: true }, error: null } },
    mux: async (m, id) => { calls.push(`${m}:${id}`); return m === 'DELETE' ? { r: { kind: 'status', status: 204 }, body: null } : { r: { kind: 'status', status: 200 }, body: okMeta } },
    ...over,
  }
  return d
}

Deno.test('happy path: lease → canary → claim → preGET → gate → DELETE → finalize → release', async () => {
  const d = deps()
  const r = await runLiveWorker(d, null)
  assertEquals(d.calls, ['GET:canary1', 'claim', 'GET:asset1', 'gate', 'DELETE:asset1', 'finalize:deleted', 'claim', 'release:tokA'])
  assertEquals([r.deletes_sent, r.released, r.breaker], [1, true, null])
})

Deno.test('run lease held by another run → no Mux call at all', async () => {
  const d = deps({ acquire: async () => ({ data: { acquired: false, reason: 'run_already_in_progress' }, error: null }) })
  const r = await runLiveWorker(d, null)
  assertEquals([r.aborted, d.calls.length], ['run_already_in_progress', 0])
})

Deno.test('acquire RPC error → aborted, no Mux call', async () => {
  const d = deps({ acquire: async () => ({ data: null, error: new Error('x') }) })
  assertEquals((await runLiveWorker(d, null)).aborted, 'run_lease_rpc_error')
  assertEquals(d.calls.length, 0)
})

Deno.test('TAKEOVER FENCE: run lease lost before DELETE → no DELETE, aborted_before_delete, stops', async () => {
  const d = deps({ gate: async () => { return { data: false, error: null } } })
  const r = await runLiveWorker(d, null)
  assert(!d.calls.some((c) => c.startsWith('DELETE')))
  assert(d.calls.includes('finalize:aborted_before_delete'))
  assertEquals([r.breaker, r.deletes_sent], ['mode_or_lease_lost', 0])
})

Deno.test('gate RPC error is treated as fence failure (no DELETE)', async () => {
  const d = deps({ gate: async () => ({ data: null, error: new Error('x') }) })
  const r = await runLiveWorker(d, null)
  assertEquals([r.breaker, r.deletes_sent], ['gate_rpc_error', 0])
})

Deno.test('stale worker cannot release a newer lease: release reports released=false', async () => {
  const d = deps({ release: async () => ({ data: { released: false, reason: 'not_lease_holder' }, error: null }) })
  assertEquals((await runLiveWorker(d, null)).released, false)
})

Deno.test('canary failure → no claim, lease released', async () => {
  const d = deps({ mux: async (m, id) => { d.calls.push(`${m}:${id}`); return { r: { kind: 'status', status: 200 }, body: { data: {} } } } })
  const r = await runLiveWorker(d, null)
  assertEquals(r.aborted, 'environment_canary_failed')
  assert(!d.calls.includes('claim'))
  assert(d.calls.includes('release:tokA'))
})

Deno.test('claim RPC error → breaker, no Mux asset call', async () => {
  const d = deps({ claim: async () => ({ data: null, error: new Error('x') }) })
  const r = await runLiveWorker(d, null)
  assertEquals(r.breaker, 'claim_rpc_error')
  assertEquals(d.calls.filter((c) => c.includes('asset1')).length, 0)
})

Deno.test('claim refused for run_lease_not_held → breaker (not silent end)', async () => {
  const d = deps({ claim: async () => ({ data: { claimed: false, reason: 'run_lease_not_held' }, error: null }) })
  assertEquals((await runLiveWorker(d, null)).breaker, 'run_lease_not_held')
})

Deno.test('finalize accepted=false stops the run', async () => {
  const d = deps({ finalize: async () => ({ data: { accepted: false, reason: 'lease_expired' }, error: null }) })
  const r = await runLiveWorker(d, null)
  assertEquals(r.breaker, 'finalize_rejected:lease_expired')
  assertEquals(d.calls.filter((c) => c === 'claim').length, 1)
})

Deno.test('finalize RPC error stops the run', async () => {
  const d = deps({ finalize: async () => ({ data: null, error: new Error('x') }) })
  assertEquals((await runLiveWorker(d, null)).breaker, 'finalize_rpc_error')
})

Deno.test('DELETE 404 + verify GET 404 → reconciled outcome', async () => {
  const d = deps({ mux: async (m, id) => { d.calls.push(`${m}:${id}`)
    if (id === 'canary1') return { r: { kind: 'status', status: 200 }, body: okMeta }
    if (m === 'DELETE') return { r: { kind: 'status', status: 404 }, body: null }
    return d.calls.filter((c) => c === 'GET:asset1').length === 1 ? { r: { kind: 'status', status: 200 }, body: okMeta } : { r: { kind: 'status', status: 404 }, body: null } } })
  await runLiveWorker(d, null)
  assert(d.calls.includes('finalize:delete_404_get_404'))
})

Deno.test('legacy asset without metadata → environment_mismatch, no DELETE', async () => {
  const d = deps({ mux: async (m, id) => { d.calls.push(`${m}:${id}`); return { r: { kind: 'status', status: 200 }, body: id === 'canary1' ? okMeta : { data: {} } } } })
  const r = await runLiveWorker(d, null)
  assert(d.calls.includes('finalize:environment_mismatch'))
  assertEquals(r.deletes_sent, 0)
})

Deno.test('exact target: one claim only; asset mismatch aborts before DELETE', async () => {
  const d = deps()
  await runLiveWorker(d, { candidateId: 'c1', expectedAssetId: 'asset1' })
  assertEquals(d.calls.filter((c) => c === 'claim').length, 1)
  const d2 = deps()
  const r2 = await runLiveWorker(d2, { candidateId: 'c1', expectedAssetId: 'other' })
  assertEquals([r2.breaker, r2.deletes_sent], ['exact_target_mismatch', 0])
})

Deno.test('429 trips breaker after finalize', async () => {
  const d = deps({ mux: async (m, id) => { d.calls.push(`${m}:${id}`); return m === 'DELETE' ? { r: { kind: 'status', status: 429, retryAfter: '60' }, body: null } : { r: { kind: 'status', status: 200 }, body: okMeta } } })
  const r = await runLiveWorker(d, null)
  assertEquals(r.breaker, 'retryable')
  assertEquals(d.calls.filter((c) => c === 'claim').length, 1)
})
