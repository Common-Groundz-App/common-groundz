import { assertEquals } from 'jsr:@std/assert@1';
import { runWorker, type WorkerDeps } from './worker.ts';

function deps(over: Partial<WorkerDeps> & { finishes?: string[] } = {}): WorkerDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    recheckKept: async () => 0,
    claim: async () => [{ path: 'u/s/a.png', claim_token: 't1' }],
    processingEnabled: async () => true,
    removeObject: async (p) => { calls.push('remove:' + p); return null; },
    finish: async (p, t, o) => { calls.push(`finish:${p}:${t}:${o}`); return o === 'deleted' ? 'deleted' : 'retry'; },
    ...over,
  };
}

Deno.test('deletes a claimed file and finishes with its token', async () => {
  const d = deps();
  const r = await runWorker(d);
  assertEquals(r.deleted, 1);
  assertEquals(d.calls, ['remove:u/s/a.png', 'finish:u/s/a.png:t1:deleted']);
});

Deno.test('already-missing object (no storage error) counts as deleted', async () => {
  const d = deps({ removeObject: async () => null });
  assertEquals((await runWorker(d)).deleted, 1);
});

Deno.test('storage error -> retry; repeated -> failed', async () => {
  let n = 0;
  const d = deps({ removeObject: async () => 'timeout', finish: async () => (++n >= 2 ? 'failed' : 'retry') });
  assertEquals((await runWorker(d)).retry, 1);
  assertEquals((await runWorker(d)).failed, 1);
});

Deno.test('thrown storage call is treated as an error, never as deleted', async () => {
  const seen: string[] = [];
  const d = deps({ removeObject: async () => { throw new Error('network'); }, finish: async (_p, _t, o) => { seen.push(o); return 'retry'; } });
  await runWorker(d);
  assertEquals(seen, ['error']);
});

Deno.test('token mismatch (stale claim) is reported, not counted as deleted', async () => {
  const d = deps({ finish: async () => 'stale' });
  const r = await runWorker(d);
  assertEquals([r.deleted, r.stale], [0, 1]);
});

Deno.test('processing switched off mid-run: no storage call', async () => {
  const d = deps({ processingEnabled: async () => false });
  const r = await runWorker(d);
  assertEquals(r.skippedProcessingOff, ['u/s/a.png']);
  assertEquals(d.calls.length, 0);
});

Deno.test('running twice is idempotent when nothing is claimable', async () => {
  const d = deps({ claim: async () => [] });
  const a = await runWorker(d); const b = await runWorker(d);
  assertEquals(a, b);
  assertEquals(d.calls.length, 0);
});
