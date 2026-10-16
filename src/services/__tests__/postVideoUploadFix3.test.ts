/**
 * Fix 3 — Post composer Mux upload pipeline.
 * Poster work never gates the video PUT; cancellation, failures and late
 * poster completion are bounded to the active attempt; Review path unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const log: string[] = [];
let t0 = 0;
const at = (e: string) => log.push(`${e}@${Date.now() - t0}`);
let posterDelay = 800;
let posterFails = false;
let createDelay = 300;
let createFails = false;
let putDelay = 200;
let putFails = false;
let putStatus = 200;
const stages: string[] = [];
const removed: string[][] = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: { mux: { uploads_enabled: true, mode: 'test' } }, error: null })),
    functions: {
      invoke: vi.fn(async (_n: string, opts: any) => {
        at(`create:${JSON.stringify(opts.body)}`);
        await new Promise((r) => setTimeout(r, createDelay));
        if (createFails) return { data: null, error: new Error('boom') };
        return { data: { upload_id: 'up_1', upload_url: 'https://mux/put', is_test: true, expires_at: '' }, error: null };
      }),
    },
    storage: {
      from: () => ({
        upload: async () => { await new Promise((r) => setTimeout(r, 100)); at('posterStored'); return { error: null }; },
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x/storage/v1/object/public/post_media/${p}` } }),
        remove: async (paths: string[]) => { removed.push(paths); return { error: null }; },
      }),
    },
  },
}));
vi.mock('@/services/storageService', () => ({ ensureBucketPolicies: async () => {} }));
vi.mock('@/services/analytics', () => ({
  analytics: new Proxy({}, { get: () => () => {} }),
}));
vi.mock('@/utils/videoPoster', () => ({
  generateVideoPoster: async () => {
    at('posterStart');
    await new Promise((r) => setTimeout(r, posterDelay));
    if (posterFails) throw new Error('no poster');
    return { posterBlob: new Blob(), width: 1080, height: 1920, duration: 12 };
  },
}));

class FakeXHR {
  upload: any = {};
  onload?: () => void; onerror?: () => void; onabort?: () => void;
  status = 0; statusText = '';
  private timer: any;
  open() {}
  send() {
    at('putStart');
    this.timer = setTimeout(() => {
      if (putFails) { this.onerror?.(); return; }
      this.upload.onload?.(); at('putSent');
      this.status = putStatus; at('putDone'); this.onload?.();
    }, putDelay);
  }
  abort() { clearTimeout(this.timer); at('putAborted'); this.onabort?.(); }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  log.length = 0; removed.length = 0; t0 = Date.now();
  posterDelay = 800; posterFails = false; createDelay = 300; createFails = false; putDelay = 200; putFails = false; putStatus = 200; stages.length = 0;
  (globalThis as any).XMLHttpRequest = FakeXHR;
  (globalThis as any).URL.createObjectURL = () => 'blob:x';
  (globalThis as any).URL.revokeObjectURL = () => {};
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'video') return realCreate(tag);
    const v: any = {};
    Object.defineProperty(v, 'src', { set() { v.duration = 12; setTimeout(() => v.onloadedmetadata?.(), 0); } });
    return v;
  }) as any);
});

const file = () => ({ type: 'video/mp4', size: 1000, name: 'clip.mp4' }) as unknown as File;
const ms = (e: string) => Number(log.find((l) => l.startsWith(e))!.split('@')[1]);

async function run<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return p;
}

describe('Fix 3 — Post Mux upload pipeline', async () => {
  const svc = await import('@/services/mediaService');
  beforeEach(() => svc.__resetMuxConfigCache());

  it('starts the PUT as soon as the upload URL arrives, before the poster finishes', async () => {
    const item = await run(svc.uploadMedia(file(), 'u', 's'));
    expect(ms('putStart')).toBeLessThan(ms('posterStored'));
    expect(ms('putStart') - ms('create')).toBe(createDelay);
    expect(item).toMatchObject({ provider: 'mux', mux_upload_id: 'up_1', mux_status: 'preparing', width: 1080 });
    expect(item!.mux_playback_id).toBeUndefined(); // readiness stays server-owned
    console.info(`[Fix3 measurement] simulated: PUT start ${ms('putStart')}ms (old sequential path: ${posterDelay + 100 + createDelay}ms)`);
  });

  it('poster failure does not fail the video', async () => {
    posterFails = true;
    const item = await run(svc.uploadMedia(file(), 'u', 's'));
    expect(item).toMatchObject({ mux_upload_id: 'up_1', url: '' });
    expect(item!.thumbnail_url).toBeUndefined();
  });

  it('cancel before the URL arrives never starts the PUT and discards the poster', async () => {
    const c = new AbortController();
    const p = svc.uploadMedia(file(), 'u', 's', undefined, { signal: c.signal });
    await vi.advanceTimersByTimeAsync(50);
    c.abort();
    expect(await run(p)).toBeNull();
    expect(log.some((l) => l.startsWith('putStart'))).toBe(false);
  });

  it('cancel during the PUT aborts the transfer and cleans the poster', async () => {
    putDelay = 5000;
    const c = new AbortController();
    const p = svc.uploadMedia(file(), 'u', 's', undefined, { signal: c.signal });
    await vi.advanceTimersByTimeAsync(1500);
    c.abort();
    expect(await run(p)).toBeNull();
    expect(log.some((l) => l.startsWith('putAborted'))).toBe(true);
    expect(removed.length).toBe(1);
  });

  it('create-upload and PUT failures fail the attempt and clean the poster', async () => {
    createFails = true;
    expect(await run(svc.uploadMedia(file(), 'u', 's'))).toBeNull();
    expect(log.some((l) => l.startsWith('putStart'))).toBe(false);
    expect(removed.length).toBe(1);
    createFails = false; putFails = true; removed.length = 0; log.length = 0;
    expect(await run(svc.uploadMedia(file(), 'u', 's'))).toBeNull();
    expect(removed.length).toBe(1);
  });

  it('late poster is delivered once to the active attempt only', async () => {
    posterDelay = 4000;
    const late = vi.fn();
    const item = await run(svc.uploadMedia(file(), 'u', 's', undefined, { onLatePoster: late }));
    expect(item).toMatchObject({ url: '', mux_upload_id: 'up_1' });
    expect(late).toHaveBeenCalledTimes(1);
    expect(late.mock.calls[0][0]).toBe('up_1');
    expect(late.mock.calls[0][1]).toMatchObject({ width: 1080, height: 1920 });
  });

  it('late poster after cancellation is discarded, never delivered', async () => {
    posterDelay = 4000;
    const late = vi.fn();
    const c = new AbortController();
    const p = svc.uploadMedia(file(), 'u', 's', undefined, { signal: c.signal, onLatePoster: late });
    await vi.advanceTimersByTimeAsync(2100); // PUT done, grace expired, item emitted
    const item = await p;
    expect(item).not.toBeNull();
    c.abort(); // e.g. composer closed
    await vi.runAllTimersAsync();
    expect(late).not.toHaveBeenCalled();
    expect(removed.length).toBe(0); // aborted before storage: never stored
    expect(log.some((l) => l.startsWith("posterStored"))).toBe(false);
  });

  it('Review path stays sequential (poster before handshake) and sends declared size', async () => {
    const item = await run(svc.uploadMedia(file(), 'u', 's', undefined, { videoMuxOnly: true }));
    expect(ms('create')).toBeGreaterThanOrEqual(ms('posterStored'));
    expect(log.find((l) => l.startsWith('create'))).toContain('declared_size');
    expect(item!.thumbnail_url).toBeTruthy();
  });

  it('reports all-bytes-sent as 100% "finalizing" and never drops back to 0', async () => {
    const item = await run(svc.uploadMedia(file(), 'u', 's', (p, st) => stages.push(`${st}:${p}`)));
    expect(item).not.toBeNull();
    const firstFinal = stages.findIndex((x) => x.startsWith('finalizing'));
    expect(stages[firstFinal]).toBe('finalizing:100');
    expect(stages.slice(firstFinal).every((x) => x.endsWith(':100'))).toBe(true);
  });

  it('a non-2xx reply is a failure, not a confirmed upload', async () => {
    putStatus = 500;
    expect(await run(svc.uploadMedia(file(), 'u', 's'))).toBeNull();
  });
});
