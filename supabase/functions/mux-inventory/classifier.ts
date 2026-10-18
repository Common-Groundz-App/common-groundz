export type Presence = 'present' | 'external_missing' | 'inconclusive'
export interface Upload { id: string; upload_id: string; asset_id?: string | null; playback_id?: string | null; status: string; created_at: string; expires_at?: string | null; is_test?: boolean }
export interface Asset { id: string; upload_id?: string; created_at?: string; status?: string; playback_ids?: { id: string }[]; test?: boolean }
export interface Reference { kind: string; content_id: string; soft_deleted?: boolean; parent_missing?: boolean; media: Record<string, unknown>[] | null }
export interface Mapping { mux_upload_id: string; content_type: string; content_id: string; status: string }
export interface Snapshot { uploads: Upload[]; references: Reference[]; mappings: Mapping[]; complete: boolean }
const GRACE = 24 * 60 * 60 * 1000
function playbackFromUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  try { const u = new URL(value); if (u.hostname === 'stream.mux.com' || u.hostname === 'image.mux.com') return u.pathname.split('/')[1]?.replace(/\.m3u8$/, '') } catch { /* not a URL */ }
}
export function classify(assetId: string, asset: Asset | undefined, presence: Presence, db: Snapshot, scanComplete: boolean, now: number) {
  const uploads = db.uploads.filter(u => u.asset_id === assetId || (asset?.upload_id && u.upload_id === asset.upload_id))
  const uploadIds = new Set(uploads.map(u => u.upload_id)); if (asset?.upload_id) uploadIds.add(asset.upload_id)
  const playbackIds = new Set([...uploads.map(u => u.playback_id).filter(Boolean), ...(asset?.playback_ids?.map(p => p.id) ?? [])])
  const matches = db.references.filter(r => r.media?.some(m => m.mux_asset_id === assetId || uploadIds.has(String(m.mux_upload_id)) || playbackIds.has(String(m.mux_playback_id)) || [m.url, m.thumbnail_url].some(url => playbackIds.has(playbackFromUrl(url)))))
  const active = matches.filter(r => !r.soft_deleted && !r.parent_missing)
  const deleted = matches.filter(r => r.soft_deleted || r.parent_missing)
  const dates = uploads.map(u => Date.parse(u.created_at)); if (asset?.created_at) dates.push(Number(asset.created_at) * 1000)
  const recent = dates.some(d => Number.isFinite(d) && now - d < GRACE)
  const staleUnfinished = uploads.some(u => !['ready', 'errored', 'cancelled', 'timed_out'].includes(u.status)) || (asset && !['ready', 'errored'].includes(asset.status ?? ''))
  const contradictoryMapping = db.mappings.some(m => uploadIds.has(m.mux_upload_id) && m.status !== 'removed' && !matches.some(r => r.kind === m.content_type && r.content_id === m.content_id))
  // The current schema cannot prove a resumed composer is no longer active.
  // Old ready unlinked uploads are candidates for investigation, NOT deletion.
  const workflow = active.length ? 'saved_content' : recent ? 'recent_attempt_protected' : 'unknown_no_durable_attempt_ledger'
  let appState: string
  if (active.length) appState = 'active_referenced'
  else if (!db.complete || !scanComplete) appState = 'ambiguous'
  else if (deleted.length) appState = 'historical_deleted_ambiguous'
  else if (recent) appState = 'recent_unlinked'
  else if (staleUnfinished || contradictoryMapping || !uploads.length || dates.some(d => !Number.isFinite(d))) appState = 'ambiguous'
  else appState = 'unreferenced'
  const derived = presence === 'external_missing' ? (active.length ? 'broken_reference' : 'external_missing_unreferenced')
    : presence === 'inconclusive' ? 'probe_inconclusive'
    : appState === 'unreferenced' ? 'orphan_candidate'
    : appState === 'active_referenced' ? 'protected_active' : 'protected_ambiguous_or_recent'
  return { asset_id: assetId, mux_presence: presence, app_reference_state: appState, derived,
    workflow_evidence: workflow, deletion_eligible: false, active_references: active.map(r => ({ kind: r.kind, content_id: r.content_id })),
    deleted_references: deleted.map(r => ({ kind: r.kind, content_id: r.content_id })), upload_record_ids: uploads.map(u => u.id),
    mux_status: asset?.status ?? null, mux_test: asset?.test ?? null }
}
export function compareSets(assets: Asset[], uploads: Upload[]) {
  const m = new Set(assets.map(a => a.id)), s = new Set(uploads.map(u => u.asset_id).filter((id): id is string => Boolean(id)))
  return { mux_present: [...m].sort(), database_recorded: [...s].sort(), intersection: [...m].filter(id => s.has(id)).sort(), mux_only: [...m].filter(id => !s.has(id)).sort(), database_only: [...s].filter(id => !m.has(id)).sort() }
}

/** Mux Video assets API uses documented page/limit pagination (not cursors).
 * Every page must succeed; a failed or repeated page never proves absence.
 */
export async function scanAssets(get: (path: string) => Promise<{ status: number; body?: { data?: Asset[] } }>, limit = 100) {
  const assets: Asset[] = []; const seen = new Set<string>()
  for (let page = 1; page <= 100; page++) {
    const res = await get(`/assets?limit=${limit}&page=${page}`)
    if (res.status !== 200 || !Array.isArray(res.body?.data)) return { assets, complete: false, failed_page: page, status: res.status }
    const items = res.body.data
    if (items.some(a => !a.id || seen.has(a.id))) return { assets, complete: false, failed_page: page, status: 200 }
    for (const a of items) { seen.add(a.id); assets.push(a) }
    if (items.length < limit) return { assets, complete: true, pages: page }
  }
  return { assets, complete: false, failed_page: 101, status: 0 }
}