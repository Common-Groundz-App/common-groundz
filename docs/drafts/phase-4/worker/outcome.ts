// Phase 4 worker — pure decision logic (no I/O). REVIEW DRAFT.
// Every Mux HTTP result maps to exactly one server outcome; the DB
// (mux_cleanup_finalize_live) maps outcomes to states. No raw Mux body,
// header or error text ever leaves this module.

export const LIMITS = {
  WORKER_DEADLINE_MS: 55_000,      // total run budget
  REQUEST_TIMEOUT_MS: 6_000,       // per HTTP request
  DB_FINALIZE_RESERVE_MS: 4_000,
  MAX_CLAIMS_PER_RUN: 10,          // upper bound, not a target
  LEASE_SECONDS: 120,              // must equal mux_live_lease_seconds()
  MAX_RETRIES: 5,                  // must equal mux_live_max_retries()
  RETRY_AFTER_CAP_S: 21_600,
} as const

// One claimed asset can need: pre-GET + DELETE + verify GET + finalize.
export const PER_ASSET_BUDGET_MS = 3 * LIMITS.REQUEST_TIMEOUT_MS + LIMITS.DB_FINALIZE_RESERVE_MS

export function canClaimAnother(elapsedMs: number, claimsSoFar: number): boolean {
  return claimsSoFar < LIMITS.MAX_CLAIMS_PER_RUN &&
    LIMITS.WORKER_DEADLINE_MS - elapsedMs >= PER_ASSET_BUDGET_MS
}

export type HttpResult = { kind: 'status'; status: number; retryAfter?: string | null } | { kind: 'network' }

export type Outcome =
  | 'deleted' | 'delete_404_get_404' | 'delete_404_get_200' | 'delete_404_get_retryable'
  | 'retryable' | 'auth_error' | 'non_retryable_4xx' | 'unexpected_response'
  | 'environment_mismatch' | 'aborted_before_delete'

export type DeleteStep = { done: true; outcome: Outcome; tripBreaker: boolean } | { done: false; needVerifyGet: true }

const isRetryable = (r: HttpResult) => r.kind === 'network' || r.status === 429 || (r.status >= 500 && r.status <= 599)
const isAuth = (r: HttpResult) => r.kind === 'status' && (r.status === 401 || r.status === 403)

export function classifyDelete(r: HttpResult): DeleteStep {
  if (r.kind === 'status' && (r.status === 200 || r.status === 204)) return { done: true, outcome: 'deleted', tripBreaker: false }
  if (r.kind === 'status' && r.status === 404) return { done: false, needVerifyGet: true }
  if (isAuth(r)) return { done: true, outcome: 'auth_error', tripBreaker: true }
  if (isRetryable(r)) return { done: true, outcome: 'retryable', tripBreaker: r.kind === 'status' && r.status === 429 }
  if (r.kind === 'status' && r.status >= 400 && r.status <= 499) return { done: true, outcome: 'non_retryable_4xx', tripBreaker: false }
  return { done: true, outcome: 'unexpected_response', tripBreaker: false }
}

export function classifyVerifyGet(r: HttpResult): { outcome: Outcome; tripBreaker: boolean } {
  if (r.kind === 'status' && r.status === 404) return { outcome: 'delete_404_get_404', tripBreaker: false }
  if (r.kind === 'status' && r.status === 200) return { outcome: 'delete_404_get_200', tripBreaker: false }
  if (isAuth(r)) return { outcome: 'auth_error', tripBreaker: true }
  if (isRetryable(r)) return { outcome: 'delete_404_get_retryable', tripBreaker: r.kind === 'status' && r.status === 429 }
  return { outcome: 'unexpected_response', tripBreaker: false }
}

// Pre-DELETE GET: confirms the asset belongs to this app/environment.
// Mux documents `passthrough` and `meta.external_id` as echoed back on the
// asset; Phase 2A writes {app, env, upload_record_id} and external_id.
export type PreGet =
  | { proceed: true }
  | { proceed: false; outcome: Outcome; tripBreaker: boolean }
  | { proceed: false; alreadyGone: true }

export function classifyPreGet(r: HttpResult, body: unknown, expect: { app: string; env: string; uploadRecordId: string | null }): PreGet {
  if (r.kind === 'status' && r.status === 404) return { proceed: false, alreadyGone: true } // still DELETE→GET path decides
  if (isAuth(r)) return { proceed: false, outcome: 'auth_error', tripBreaker: true }
  if (isRetryable(r)) return { proceed: false, outcome: 'retryable', tripBreaker: r.kind === 'status' && r.status === 429 }
  if (!(r.kind === 'status' && r.status === 200)) return { proceed: false, outcome: 'unexpected_response', tripBreaker: false }
  const data = (body as { data?: { passthrough?: string; meta?: { external_id?: string } } })?.data
  let pt: Record<string, unknown> | null = null
  try { pt = data?.passthrough ? JSON.parse(data.passthrough) : null } catch { pt = null }
  if (!pt || pt.app !== expect.app || pt.env !== expect.env) return { proceed: false, outcome: 'environment_mismatch', tripBreaker: false }
  if (!expect.uploadRecordId || pt.upload_record_id !== expect.uploadRecordId || data?.meta?.external_id !== expect.uploadRecordId) {
    return { proceed: false, outcome: 'environment_mismatch', tripBreaker: false }
  }
  return { proceed: true }
}

export function parseRetryAfter(v: string | null | undefined): number | null {
  if (!v) return null
  const n = Number(v)
  if (Number.isFinite(n) && n >= 0) return Math.min(Math.floor(n), LIMITS.RETRY_AFTER_CAP_S)
  const t = Date.parse(v)
  if (Number.isNaN(t)) return null
  return Math.min(Math.max(0, Math.ceil((t - Date.now()) / 1000)), LIMITS.RETRY_AFTER_CAP_S)
}
