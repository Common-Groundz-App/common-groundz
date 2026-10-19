import { assertEquals } from 'jsr:@std/assert@1'
import { classifyDelete } from './outcome.ts'

Deno.test('200/204 -> deleted', () => { assertEquals(classifyDelete(200), 'deleted'); assertEquals(classifyDelete(204), 'deleted') })
Deno.test('404 -> not_found', () => assertEquals(classifyDelete(404), 'not_found'))
Deno.test('429/5xx/network -> retryable', () => {
  assertEquals(classifyDelete(429), 'retryable'); assertEquals(classifyDelete(503), 'retryable'); assertEquals(classifyDelete(null), 'retryable')
})
Deno.test('401/403/other 4xx -> failed', () => { assertEquals(classifyDelete(401), 'failed'); assertEquals(classifyDelete(400), 'failed') })
