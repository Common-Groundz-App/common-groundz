import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { canClaimAnother, classifyDelete, classifyPreGet, classifyVerifyGet, parseRetryAfter, PER_ASSET_BUDGET_MS, LIMITS } from './outcome.ts'

const s = (status: number) => ({ kind: 'status' as const, status })
const net = { kind: 'network' as const }

Deno.test('DELETE 200/204 → deleted', () => {
  for (const c of [200, 204]) assertEquals(classifyDelete(s(c)), { done: true, outcome: 'deleted', tripBreaker: false })
})
Deno.test('DELETE 404 → needs verify GET, never final', () => assertEquals(classifyDelete(s(404)), { done: false, needVerifyGet: true }))
Deno.test('DELETE 401/403 → auth_error + breaker', () => {
  for (const c of [401, 403]) assertEquals(classifyDelete(s(c)), { done: true, outcome: 'auth_error', tripBreaker: true })
})
Deno.test('DELETE 429 → retryable + breaker (stop further requests)', () =>
  assertEquals(classifyDelete(s(429)), { done: true, outcome: 'retryable', tripBreaker: true }))
Deno.test('DELETE 5xx / network → retryable, no breaker', () => {
  for (const r of [s(500), s(503), net]) assertEquals(classifyDelete(r), { done: true, outcome: 'retryable', tripBreaker: false })
})
Deno.test('DELETE other 4xx → non_retryable_4xx', () => {
  for (const c of [400, 409, 422]) assertEquals(classifyDelete(s(c)).done && (classifyDelete(s(c)) as any).outcome, 'non_retryable_4xx')
})
Deno.test('DELETE 3xx/1xx → unexpected_response', () => assertEquals((classifyDelete(s(302)) as any).outcome, 'unexpected_response'))

Deno.test('verify GET after 404', () => {
  assertEquals(classifyVerifyGet(s(404)).outcome, 'delete_404_get_404')
  assertEquals(classifyVerifyGet(s(200)).outcome, 'delete_404_get_200')
  assertEquals(classifyVerifyGet(s(503)).outcome, 'delete_404_get_retryable')
  assertEquals(classifyVerifyGet(net).outcome, 'delete_404_get_retryable')
  assertEquals(classifyVerifyGet(s(429)), { outcome: 'delete_404_get_retryable', tripBreaker: true })
  assertEquals(classifyVerifyGet(s(401)), { outcome: 'auth_error', tripBreaker: true })
})

const okBody = (pt: unknown, ext = 'u1') => ({ data: { passthrough: JSON.stringify(pt), meta: { external_id: ext } } })
const exp = { app: 'commongroundz', env: 'live', uploadRecordId: 'u1' }
Deno.test('pre-GET passes only with matching app/env/upload id', () => {
  assertEquals(classifyPreGet(s(200), okBody({ app: 'commongroundz', env: 'live', upload_record_id: 'u1' }), exp), { proceed: true })
  assertEquals((classifyPreGet(s(200), okBody({ app: 'commongroundz', env: 'test', upload_record_id: 'u1' }), exp) as any).outcome, 'environment_mismatch')
  assertEquals((classifyPreGet(s(200), okBody({ app: 'commongroundz', env: 'live', upload_record_id: 'u2' }), exp) as any).outcome, 'environment_mismatch')
  assertEquals((classifyPreGet(s(200), okBody({ app: 'commongroundz', env: 'live', upload_record_id: 'u1' }, 'zz'), exp) as any).outcome, 'environment_mismatch')
  assertEquals((classifyPreGet(s(200), { data: {} }, exp) as any).outcome, 'environment_mismatch') // legacy assets fail closed
  assertEquals((classifyPreGet(s(200), okBody({ app: 'commongroundz', env: 'live', upload_record_id: 'u1' }), { ...exp, uploadRecordId: null }) as any).outcome, 'environment_mismatch')
})
Deno.test('pre-GET 404 does not finalize by itself', () => assertEquals(classifyPreGet(s(404), null, exp), { proceed: false, alreadyGone: true }))

Deno.test('budget: stop claiming when one full asset no longer fits', () => {
  assert(canClaimAnother(0, 0))
  assert(!canClaimAnother(LIMITS.WORKER_DEADLINE_MS - PER_ASSET_BUDGET_MS + 1, 0))
  assert(!canClaimAnother(0, LIMITS.MAX_CLAIMS_PER_RUN))
  assert(LIMITS.LEASE_SECONDS * 1000 > PER_ASSET_BUDGET_MS * 2)
})
Deno.test('Retry-After parsing is bounded', () => {
  assertEquals(parseRetryAfter('30'), 30)
  assertEquals(parseRetryAfter('999999'), LIMITS.RETRY_AFTER_CAP_S)
  assertEquals(parseRetryAfter('garbage'), null)
  assertEquals(parseRetryAfter(null), null)
})
