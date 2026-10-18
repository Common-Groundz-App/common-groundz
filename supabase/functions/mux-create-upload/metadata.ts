export type UploadKind = 'post' | 'review' | 'review_update'
export type MetadataKind = UploadKind | 'unknown'
export const MAX_DECLARED_BYTES = 100 * 1024 * 1024

export function parseUploadBody(raw: string): { kind: MetadataKind; declaredSize?: number } {
  let body: unknown
  try { body = raw ? JSON.parse(raw) : {} } catch { throw new Error('invalid_json') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body')
  const input = body as Record<string, unknown>
  // Omission only: deployed older clients send {} or {declared_size}. Do not
  // pretend these requests are Posts; explicit "unknown" is NOT accepted.
  const kind = Object.hasOwn(input, 'kind') ? input.kind : 'unknown'
  if (Object.hasOwn(input, 'kind') && kind !== 'post' && kind !== 'review' && kind !== 'review_update') {
    throw new Error('invalid_kind')
  }
  const size = input.declared_size
  if (size !== undefined && (typeof size !== 'number' || !Number.isFinite(size) || size <= 0)) {
    throw new Error('invalid_declared_size')
  }
  if (typeof size === 'number' && size > MAX_DECLARED_BYTES) throw new Error('file_too_large')
  return { kind: kind as MetadataKind, ...(typeof size === 'number' ? { declaredSize: size } : {}) }
}

export function uploadAssetSettings(recordId: string, kind: MetadataKind, isTest: boolean) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) {
    throw new Error('invalid_correlation_id')
  }
  const environment = isTest ? 'test' : 'live'
  return {
    playback_policy: ['public'],
    meta: { external_id: recordId, title: `Common Groundz / ${environment} / ${kind}` },
    passthrough: JSON.stringify({ v: 1, app: 'common-groundz', environment, kind, upload_record_id: recordId }),
  }
}

/** Exactly one persistence attempt after Mux creation. Never returns the signed
 * URL on failure, retries creation, or compensates by cancelling/deleting Mux.
 * Correlation remains on the Direct Upload/asset even without a database row.
 */
export async function persistCreatedUpload(
  row: { id: string; upload_id: string; user_id: string; status: string; is_test: boolean; expires_at: string },
  insert: (input: typeof row) => PromiseLike<{ error: unknown }>,
  log: (event: Record<string, unknown>) => void,
): Promise<boolean> {
  try {
    const result = await insert(row)
    if (!result.error) return true
  } catch { /* network outcome is uncertain; retain correlation and fail closed */ }
  log({ event: 'mux_upload_persistence_failed', upload_record_id: row.id, mux_upload_id: row.upload_id,
    persistence_outcome: 'failed_or_unknown' })
  return false
}