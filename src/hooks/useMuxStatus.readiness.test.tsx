import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useMuxStatus } from './useMuxStatus';
import { composerMuxState } from '@/utils/composerVideoReadiness';

const mocks = vi.hoisted(() => ({ reads: vi.fn(), event: null as null | ((p: any) => void), remove: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ in: mocks.reads }) }),
  channel: () => {
    const channel = { on: (_: any, __: any, cb: any) => { mocks.event = cb; return channel; }, subscribe: () => channel };
    return channel;
  },
  removeChannel: mocks.remove,
} }));
const row = (extra = {}) => ({ upload_id: 'u1', status: 'ready', playback_id: 'p1', asset_id: 'a1', error: null, duration: 8, updated_at: '2026-10-14T09:00:02Z', ...extra });
beforeEach(() => { mocks.reads.mockReset(); mocks.remove.mockClear(); mocks.event = null; mocks.reads.mockResolvedValue({ data: [row()], error: null }); });
afterEach(cleanup);

describe('owner readiness hook', () => {
  it('reads authoritative duration and identifiers', async () => {
    const { result } = renderHook(() => useMuxStatus(['u1']));
    await waitFor(() => expect(composerMuxState(result.current.u1)).toBe('ready'));
    expect(result.current.u1.duration).toBe(8);
  });
  it('accepts duration-only realtime updates', async () => {
    mocks.reads.mockResolvedValue({ data: [row({ duration: null })], error: null });
    const { result } = renderHook(() => useMuxStatus(['u1']));
    await waitFor(() => expect(result.current.u1).toBeDefined());
    expect(composerMuxState(result.current.u1)).toBe('processing');
    act(() => mocks.event?.({ new: row({ updated_at: '2026-10-14T09:00:03Z' }) }));
    expect(composerMuxState(result.current.u1)).toBe('ready');
  });
  it('does not let a delayed initial read regress a realtime ready result', async () => {
    let resolve: ((value: any) => void) | undefined;
    mocks.reads.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useMuxStatus(['u1']));
    act(() => mocks.event?.({ new: row() }));
    await act(async () => resolve?.({ data: [row({ status: 'waiting', duration: null })], error: null }));
    expect(composerMuxState(result.current.u1)).toBe('ready');
  });
  it('removed/replaced selection ignores late events and old reads', async () => {
    const { result, rerender } = renderHook(({ ids }) => useMuxStatus(ids), { initialProps: { ids: ['u1'] } });
    await waitFor(() => expect(result.current.u1).toBeDefined());
    const late = mocks.event;
    mocks.reads.mockResolvedValue({ data: [row({ upload_id: 'u2', status: 'waiting', duration: null })], error: null });
    rerender({ ids: ['u2'] });
    act(() => late?.({ new: row() }));
    expect(result.current.u1).toBeUndefined();
    await waitFor(() => expect(result.current.u2).toBeDefined());
    expect(composerMuxState(result.current.u2)).toBe('processing');
  });
  it('manual recheck/reconnect recovers after a failed read', async () => {
    mocks.reads.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    const { result } = renderHook(() => useMuxStatus(['u1']));
    await act(async () => {});
    act(() => window.dispatchEvent(new Event('mux:recheck')));
    await waitFor(() => expect(composerMuxState(result.current.u1)).toBe('ready'));
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(mocks.reads.mock.calls.length).toBeGreaterThanOrEqual(3));
  });
  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useMuxStatus(['u1']));
    unmount();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});