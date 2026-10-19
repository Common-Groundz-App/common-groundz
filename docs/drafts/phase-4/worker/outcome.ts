// Phase 4 worker — pure decision logic (no I/O). REVIEW DRAFT, not deployed.
// Every Mux HTTP result maps to exactly one server OUTCOME; the database
// (mux_cleanup_finalize_live) maps outcomes to states. No raw Mux body,
// header or error text ever leaves this module.

export const LIMITS = {
  WORKER_DEADLINE_MS: 55_000,      // total run budget (< RUN_LEASE_SECONDS)
  REQUEST_TIMEOUT_MS: 6_000,       // per HTTP request
  DB_FINALIZE_RESERVE_MS: 4_000,
  MAX_CLAIMS_PER_RUN: 10,          // upper bound, not a target
  LEASE_SECONDS: 120,              // must equal mux_live_lease_seconds()
  RUN_LEASE_SECONDS: 90,           // must equal mux_live_run_lease_seconds()
  GATE_RUN_MARGIN_S: 10,           // must equal margin in mux_cleanup_pre_delete_gate
  GATE_CANDIDATE_MARGIN_S: 20,
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
  | 'deleted' | 'pre_get_404' | 'delete_404_get_404' | 'delete_404_get_200' | 'delete_404_get_retryable'
  | 'retryable' | 'auth_error' | 'non_retryable_4xx' | 'unexpected_response'
  | 'environment_mismatch' | 'aborted_before_delete'

/** Must stay identical to the CASE list in mux_cleanup_finalize_live. */
export const ALL_OUTCOMES: readonly Outcome[] = [
  'deleted', 'pre_get_404', 'delete_404_get_404', 'delete_404_get_200', 'delete_404_get_retryable',
  'retryable', 'auth_error', 'non_retryable_4xx', 'unexpected_response', 'environment_mismatch',
  'aborted_before_delete',
]

const isNet = (r: HttpResult) => r.kind === 'network'
const st = (r: HttpResult) => (r.kind === 'status' ? r.status : -1)
const isRetryable = (r: HttpResult) => isNet(r) || st(r) === 429 || (st(r) >= 500 && st(r) <= 599)
const isAuth = (r: HttpResult) => st(r) === 401 || st(r) === 403

export type DeleteStep = { done: true; outcome: Outcome; tripBreaker: boolean } | { done: false; needVerifyGet: true }

export function classifyDelete(r: HttpResult): DeleteStep {
  if (r.kind === 'status' && (r.status === 200 || r.status === 204)) return { done: true, outcome: 'deleted', tripBreaker: false }
  if (r.kind === 'status' && r.status === 404) return { done: false, needVerifyGet: true }
  if (isAuth(r)) return { done: true, outcome: 'auth_error', tripBreaker: true }
  if (isRetryable(r)) return { done: true, outcome: 'retryable', tripBreaker: st(r) === 429 }
  if (st(r) >= 400 && st(r) <= 499) return { done: true, outcome: 'non_retryable_4xx', tripBreaker: false }
  return { done: true, outcome: 'unexpected_response', tripBreaker: false }
}

export function classifyVerifyGet(r: HttpResult): { outcome: Outcome; tripBreaker: boolean } {
  if (st(r) === 404) return { outcome: 'delete_404_get_404', tripBreaker: false }
  if (st(r) === 200) return { outcome: 'delete_404_get_200', tripBreaker: false }
  if (isAuth(r)) return { outcome: 'auth_error', tripBreaker: true }
  if (isRetryable(r)) return { outcome: 'delete_404_get_retryable', tripBreaker: st(r) === 429 }
  return { outcome: 'unexpected_response', tripBreaker: false }
}

// ---------------------------------------------------------------------
// Mux GET-asset metadata contract (evidence: Phase 2 owner verification on
// a real production asset — `data.meta.external_id` equalled the upload
// record UUID and `data.passthrough` was the JSON string written by
// mux-create-upload/metadata.ts: {v:1, app, env, kind, upload_record_id}).
// Absent / unparsable / mismatching fields always fail closed.
// ---------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type AssetMeta = { v: number; app: string; env: string; uploadRecordId: string; externalId: string }

export function parseAssetMetadata(body: unknown): AssetMeta | null {
  const data = (body as { data?: unknown } | null)?.data as { passthrough?: unknown; meta?: { external_id?: unknown } } | undefined
  if (!data || typeof data.passthrough !== 'string') return null
  let p: Record<string, unknown>
  try { p = JSON.parse(data.passthrough) } catch { return null }
  if (!p || typeof p !== 'object') return null
  const ext = data.meta?.external_id
  if (p.v !== 1 || typeof p.app !== 'string' || typeof p.env !== 'string' ||
      typeof p.upload_record_id !== 'string' || !UUID.test(p.upload_record_id) ||
      typeof ext !== 'string' || ext.toLowerCase() !== p.upload_record_id.toLowerCase()) return null
  return { v: 1, app: p.app, env: p.env, uploadRecordId: p.upload_record_id.toLowerCase(), externalId: ext.toLowerCase() }
}

export const APP = 'commongroundz'
export const ENV = 'live'

/** Run-start credential/environment proof. */
export function canaryPasses(r: HttpResult, body: unknown): boolean {
  if (st(r) !== 200) return false
  const m = parseAssetMetadata(body)
  return !!m && m.app === APP && m.env === ENV
}

export type PreGet =
  | { proceed: true }
  | { proceed: false; outcome: Outcome; tripBreaker: boolean }

/** Per-asset check immediately before DELETE. */
export function classifyPreGet(r: HttpResult, body: unknown, expectedUploadRecordId: string | null): PreGet {
  if (st(r) === 404) return { proceed: false, outcome: 'pre_get_404', tripBreaker: false }
  if (isAuth(r)) return { proceed: false, outcome: 'auth_error', tripBreaker: true }
  if (isRetryable(r)) return { proceed: false, outcome: 'retryable', tripBreaker: st(r) === 429 }
  if (st(r) !== 200) return { proceed: false, outcome: 'unexpected_response', tripBreaker: false }
  const m = parseAssetMetadata(body)
  if (!m || m.app !== APP || m.env !== ENV || !expectedUploadRecordId ||
      m.uploadRecordId !== expectedUploadRecordId.toLowerCase()) {
    return { proceed: false, outcome: 'environment_mismatch', tripBreaker: false } // legacy assets fail closed
  }
  return { proceed: true }
}

export function parseRetryAfter(v: string | null | undefined): number | null {
  if (v == null || !/^\d+$/.test(v.trim())) return null
  return Math.min(Number(v.trim()), LIMITS.RETRY_AFTER_CAP_S)
}
