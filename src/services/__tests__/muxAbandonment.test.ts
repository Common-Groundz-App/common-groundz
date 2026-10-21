import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setAbandonRpcForTests, abandonMuxUploads, flushMuxAbandonments, sessionNewMuxIds } from '../muxAbandonment';
import type { MediaItem } from '@/types/media';

const v = (id: string) => ({ id, url: id, type: 'video', provider: 'mux', mux_upload_id: id }) as unknown as MediaItem;
afterEach(() => __setAbandonRpcForTests(null));

describe('muxAbandonment', () => {
  it('edit cancel never abandons saved media; only session-new uploads', () => {
    expect(sessionNewMuxIds([v('saved'), v('new')], [v('saved')])).toEqual(['new']);
    expect(sessionNewMuxIds([v('saved')], [v('saved')])).toEqual([]);
  });
  it('duplicate concurrent requests for one upload send once', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    __setAbandonRpcForTests(rpc);
    const a = abandonMuxUploads(['u1'], 'composer_media_removed');
    const b = abandonMuxUploads(['u1'], 'composer_discarded');
    await Promise.all([a, b]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('a failed request is retried, then reported failed (not assumed delivered)', async () => {
    vi.useFakeTimers();
    const rpc = vi.fn().mockResolvedValue({ error: new Error('x') });
    __setAbandonRpcForTests(rpc);
    const p = abandonMuxUploads(['u2'], 'composer_media_removed', 3);
    await vi.runAllTimersAsync();
    expect(await p).toBe('failed');
    expect(rpc).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
  it('leave waits for earlier pending removals, bounded', async () => {
    let resolve!: () => void;
    __setAbandonRpcForTests(() => new Promise((r) => { resolve = () => r({ error: null }); }));
    void abandonMuxUploads(['u3'], 'composer_media_removed');
    expect(await flushMuxAbandonments(20)).toBe('timed_out');
    resolve();
    expect(await flushMuxAbandonments(500)).toBe('settled');
  });
});
