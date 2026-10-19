import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  ALL_OUTCOMES, canaryPasses, canClaimAnother, classifyDelete, classifyPreGet, classifyVerifyGet,
  parseAssetMetadata, parseRetryAfter, PER_ASSET_BUDGET_MS, LIMITS,
} from './outcome.ts'

const s = (status: number) => ({ kind: 'status' as const, status })
const net = { kind: 'network' as const }
const U = '6f1c2a3b-1111-4222-8333-944455556666'
const body = (pt: unknown, ext: unknown = U) => ({ data: { passthrough: typeof pt === 'string' ? pt : JSON.stringify(pt), meta: { external_id: ext } } })
const good = { v: 1, app: 'commongroundz', env: 'live', kind: 'post', upload_record_id: U }

Deno.test('DELETE 200/204 → deleted', () => {
  for (const c of [200, 204]) assertEquals(classifyDelete(s(c)), { done: true, outcome: 'deleted', tripBreaker: false })
})
Deno.test('DELETE 404 → needs verify GET, never final', () => assertEquals(classifyDelete(s(404)), { done: false, needVerifyGet: true }))
Deno.test('DELETE 401/403 → auth_error + breaker', () => {
  for (const c of [401, 403]) assertEquals(classifyDelete(s(c)), { done: true, outcome: 'auth_error', tripBreaker: true })
})
Deno.test('DELETE 429 → retryable + breaker', () => assertEquals(classifyDelete(s(429)), { done: true, outcome: 'retryable', tripBreaker: true }))
Deno.test('DELETE 5xx / network → retryable, no breaker', () => {
  for (const r of [s(500), s(503), net]) assertEquals(classifyDelete(r), { done: true, outcome: 'retryable', tripBreaker: false })
})
Deno.test('DELETE other 4xx → non_retryable_4xx; 3xx → unexpected', () => {
  for (const c of [400, 409, 422]) assertEquals(classifyDelete(s(c)), { done: true, outcome: 'non_retryable_4xx', tripBreaker: false })
  assertEquals(classifyDelete(s(302)), { done: true, outcome: 'unexpected_response', tripBreaker: false })
})
Deno.test('verify GET after DELETE 404', () => {
  assertEquals(classifyVerifyGet(s(404)).outcome, 'delete_404_get_404')
  assertEquals(classifyVerifyGet(s(200)).outcome, 'delete_404_get_200')
  assertEquals(classifyVerifyGet(s(503)).outcome, 'delete_404_get_retryable')
  assertEquals(classifyVerifyGet(net).outcome, 'delete_404_get_retryable')
  assertEquals(classifyVerifyGet(s(429)), { outcome: 'delete_404_get_retryable', tripBreaker: true })
  assertEquals(classifyVerifyGet(s(401)), { outcome: 'auth_error', tripBreaker: true })
})

Deno.test('metadata contract: exact Phase 2 shape parses', () => {
  assertEquals(parseAssetMetadata(body(good))?.uploadRecordId, U)
})
Deno.test('metadata contract fails closed on any deviation', () => {
  assertEquals(parseAssetMetadata(body({ ...good, v: 2 })), null)
  assertEquals(parseAssetMetadata(body(good, 'other')), null)            // external_id mismatch
  assertEquals(parseAssetMetadata(body(good, undefined)), null)          // no meta
  assertEquals(parseAssetMetadata(body('not json')), null)
  assertEquals(parseAssetMetadata(body({ ...good, upload_record_id: 'x' }, 'x')), null)
  assertEquals(parseAssetMetadata({ data: {} }), null)                   // legacy asset
  assertEquals(parseAssetMetadata(null), null)
})
Deno.test('canary: needs 200 + app + env=live + consistent ids (no candidate id needed)', () => {
  assert(canaryPasses(s(200), body(good)))
  assert(!canaryPasses(s(200), body({ ...good, env: 'test' })))
  assert(!canaryPasses(s(200), body({ ...good, app: 'other' })))
  assert(!canaryPasses(s(404), null))
  assert(!canaryPasses(s(200), { data: {} }))
})
Deno.test('pre-GET passes only with matching app/env/upload id', () => {
  assertEquals(classifyPreGet(s(200), body(good), U), { proceed: true })
  assertEquals(classifyPreGet(s(200), body(good), U.toUpperCase()), { proceed: true })
  for (const [b, exp] of [[body({ ...good, env: 'test' }), U], [body(good), '00000000-0000-4000-8000-000000000000'], [{ data: {} }, U], [body(good), null]] as const) {
    assertEquals(classifyPreGet(s(200), b, exp), { proceed: false, outcome: 'environment_mismatch', tripBreaker: false })
  }
})
Deno.test('pre-GET non-200 outcomes', () => {
  assertEquals(classifyPreGet(s(404), null, U), { proceed: false, outcome: 'pre_get_404', tripBreaker: false })
  assertEquals(classifyPreGet(s(401), null, U), { proceed: false, outcome: 'auth_error', tripBreaker: true })
  assertEquals(classifyPreGet(s(429), null, U), { proceed: false, outcome: 'retryable', tripBreaker: true })
  assertEquals(classifyPreGet(net, null, U), { proceed: false, outcome: 'retryable', tripBreaker: false })
  assertEquals(classifyPreGet(s(302), null, U), { proceed: false, outcome: 'unexpected_response', tripBreaker: false })
})

Deno.test('budget and lease ordering invariants', () => {
  assert(canClaimAnother(0, 0))
  assert(!canClaimAnother(LIMITS.WORKER_DEADLINE_MS - PER_ASSET_BUDGET_MS + 1, 0))
  assert(!canClaimAnother(0, LIMITS.MAX_CLAIMS_PER_RUN))
  assert(LIMITS.RUN_LEASE_SECONDS * 1000 > LIMITS.WORKER_DEADLINE_MS + LIMITS.GATE_RUN_MARGIN_S * 1000)
  assert(LIMITS.LEASE_SECONDS > LIMITS.RUN_LEASE_SECONDS)          // a stale run's candidate is never recovered first
  assert(LIMITS.GATE_RUN_MARGIN_S * 1000 > LIMITS.REQUEST_TIMEOUT_MS) // DELETE finishes before takeover is possible
  assert(LIMITS.GATE_CANDIDATE_MARGIN_S * 1000 > LIMITS.REQUEST_TIMEOUT_MS * 2 + LIMITS.DB_FINALIZE_RESERVE_MS)
})
Deno.test('Retry-After parsing is bounded', () => {
  assertEquals(parseRetryAfter('30'), 30)
  assertEquals(parseRetryAfter('999999'), LIMITS.RETRY_AFTER_CAP_S)
  assertEquals(parseRetryAfter('garbage'), null)
  assertEquals(parseRetryAfter('-5'), null)
  assertEquals(parseRetryAfter(null), null)
})
Deno.test('outcome vocabulary is closed (mirrors SQL CASE)', () => assertEquals(ALL_OUTCOMES.length, 11))
