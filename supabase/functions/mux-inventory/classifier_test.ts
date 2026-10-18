import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { classify, compareSets, scanAssets, type Snapshot, type Asset } from './classifier.ts'
const now = Date.parse('2026-10-18T00:00:00Z')
const asset: Asset = { id: 'asset', status: 'ready', upload_id: 'upload', playback_ids: [{ id: 'playback' }] }
const fixture = (): Snapshot => ({ complete: true, mappings: [], references: [], uploads: [{ id: 'row', upload_id: 'upload', asset_id: 'asset', status: 'ready', created_at: '2026-10-15T00:00:00Z' }] })
Deno.test('old zero-reference ready asset is a non-deletable observational candidate', () => {
  const r = classify('asset', asset, 'present', fixture(), true, now)
  assertEquals(r.derived, 'orphan_candidate'); assertEquals(r.deletion_eligible, false); assertEquals(r.workflow_evidence, 'unknown_no_durable_attempt_ledger')
})
Deno.test('24 hour protection includes ready but unlinked uploads', () => {
  const db = fixture(); db.uploads[0].created_at = '2026-10-17T01:00:00Z'
  assertEquals(classify('asset', asset, 'present', db, true, now).app_reference_state, 'recent_unlinked')
})
Deno.test('expired waiting and long processing stay ambiguous, not orphan', () => {
  for (const status of ['waiting', 'asset_created']) { const db = fixture(); db.uploads[0].status = status; db.uploads[0].expires_at = '2026-10-16T00:00:00Z'; assertEquals(classify('asset', asset, 'present', db, true, now).app_reference_state, 'ambiguous') }
})
Deno.test('missing Mux never conceals active Review/update references', () => {
  for (const kind of ['review', 'review_update', 'post']) { const db = fixture(); db.references.push({ kind, content_id: 'content', media: [{ mux_upload_id: 'upload' }] }); const r = classify('asset', undefined, 'external_missing', db, true, now); assertEquals(r.app_reference_state, 'active_referenced'); assertEquals(r.derived, 'broken_reference') }
})
Deno.test('historical deleted Post never infers deletion age from updated_at/upload age', () => {
  const db = fixture(); db.references.push({ kind: 'post', content_id: 'deleted', soft_deleted: true, media: [{ mux_asset_id: 'asset' }] })
  assertEquals(classify('asset', asset, 'present', db, true, now).app_reference_state, 'historical_deleted_ambiguous')
})
Deno.test('another live reference wins over deleted reference and removed mappings', () => {
  const db = fixture(); db.references.push({ kind: 'post', content_id: 'deleted', soft_deleted: true, media: [{ mux_asset_id: 'asset' }] }, { kind: 'review', content_id: 'live', media: [{ url: 'https://stream.mux.com/playback.m3u8' }] })
  db.mappings.push({ mux_upload_id: 'upload', status: 'removed', content_type: 'review', content_id: 'live' })
  assertEquals(classify('asset', asset, 'present', db, true, now).app_reference_state, 'active_referenced')
})
Deno.test('unknown lineage, incomplete scan and probe errors fail closed', () => {
  assertEquals(classify('unknown', { id: 'unknown', status: 'ready' }, 'present', fixture(), true, now).app_reference_state, 'ambiguous')
  assertEquals(classify('asset', asset, 'present', fixture(), false, now).app_reference_state, 'ambiguous')
  assertEquals(classify('asset', undefined, 'inconclusive', fixture(), true, now).derived, 'probe_inconclusive')
})
Deno.test('set differences use distinct IDs, never arithmetic inventories', () => {
  const db = fixture(); db.uploads.push({ ...db.uploads[0], id: 'duplicate' }, { ...db.uploads[0], asset_id: 'missing' })
  const r = compareSets([asset, { id: 'unknown' }], db.uploads)
  assertEquals(r.intersection, ['asset']); assertEquals(r.mux_only, ['unknown']); assertEquals(r.database_only, ['missing'])
})
Deno.test('all pages and incomplete failures are explicit', async () => {
  const calls: string[] = []
  const scan = await scanAssets(p => { calls.push(p); return Promise.resolve({ status: 200, body: { data: calls.length === 1 ? [{ id: 'a' }, { id: 'b' }] : [{ id: 'c' }] } }) }, 2)
  assertEquals(scan.complete, true); assertEquals(calls, ['/assets?limit=2&page=1', '/assets?limit=2&page=2']); assertEquals(scan.assets.length, 3)
  for (const status of [401,403,429,500,0]) assertEquals((await scanAssets(() => Promise.resolve({ status }))).complete, false)
})
Deno.test('cursor continuation is followed even when page is shorter than limit', async () => {
  const calls: string[] = []
  const result = await scanAssets(p => { calls.push(p); return Promise.resolve({ status: 200, body: { data: [{ id: calls.length === 1 ? 'a' : 'b' }], next_cursor: calls.length === 1 ? 'next/token' : null } }) })
  assertEquals(result.complete, true); assertEquals(calls, ['/assets?limit=100&page=1', '/assets?limit=100&cursor=next%2Ftoken'])
})