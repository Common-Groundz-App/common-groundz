import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { parseUploadBody, uploadAssetSettings, persistCreatedUpload, MAX_DECLARED_BYTES } from './metadata.ts'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
Deno.test('kind accepts exactly post review review_update', () => {
  for (const kind of ['post', 'review', 'review_update']) assertEquals(parseUploadBody(JSON.stringify({ kind })).kind, kind)
  for (const kind of ['unknown', 'timeline', 'POST', '', null, 4, {}, []]) {
    assertThrows(() => parseUploadBody(JSON.stringify({ kind })), Error, 'invalid_kind')
  }
})
Deno.test('omitted kind preserves old request compatibility only', () => {
  assertEquals(parseUploadBody('{}').kind, 'unknown')
  assertEquals(parseUploadBody('{"declared_size":1024}').kind, 'unknown')
  assertEquals(parseUploadBody('').kind, 'unknown')
})
Deno.test('body shape and 100 MiB guard', () => {
  for (const raw of ['null', '[]', '1', '"post"']) assertThrows(() => parseUploadBody(raw), Error, 'invalid_body')
  assertThrows(() => parseUploadBody('{'), Error, 'invalid_json')
  for (const declared_size of [0, -1, '12', null]) assertThrows(() => parseUploadBody(JSON.stringify({ declared_size })), Error, 'invalid_declared_size')
  assertEquals(parseUploadBody(JSON.stringify({ declared_size: MAX_DECLARED_BYTES })).declaredSize, 104857600)
  assertThrows(() => parseUploadBody(JSON.stringify({ declared_size: 104857601 })), Error, 'file_too_large')
})
Deno.test('metadata uses preallocated record ID and server fields only', () => {
  const parsed = parseUploadBody(JSON.stringify({ kind: 'review', user_id: 'private', title: 'private', environment: 'evil' }))
  const settings = uploadAssetSettings(id, parsed.kind, false)
  assertEquals(settings.meta, { external_id: id })
  assertEquals(JSON.parse(settings.passthrough), { v: 1, app: 'commongroundz', env: 'live', kind: 'review', upload_record_id: id })
  assertEquals(JSON.parse(uploadAssetSettings(id, 'review_update', true).passthrough).env, 'test')
  assertEquals(settings.passthrough.length < 255, true)
  assertThrows(() => uploadAssetSettings('invalid', 'post', false))
})
const row = { id, upload_id: 'mux-upload', user_id: 'author', status: 'waiting', is_test: false, expires_at: '2026-10-18T05:00:00Z' }
Deno.test('successful persistence inserts the same ID once with no failure event', async () => {
  let calls = 0
  assertEquals(await persistCreatedUpload(row, (input) => { calls++; assertEquals(input.id, id); return Promise.resolve({ error: null }) }, () => { throw new Error('unexpected log') }), true)
  assertEquals(calls, 1)
})
Deno.test('insert error and unknown outcome expose correlation only, never retry', async () => {
  for (const throws of [false, true]) {
    let calls = 0; const events: Record<string, unknown>[] = []
    const ok = await persistCreatedUpload(row, () => { calls++; if (throws) throw new Error('secret internal failure'); return Promise.resolve({ error: 'secret' }) }, e => events.push(e))
    assertEquals(ok, false); assertEquals(calls, 1)
    assertEquals(events, [{ event: 'mux_upload_persistence_failed', upload_record_id: id, mux_upload_id: 'mux-upload', persistence_outcome: 'failed_or_unknown' }])
  }
})