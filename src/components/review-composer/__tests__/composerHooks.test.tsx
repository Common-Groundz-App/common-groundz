import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUploadSession } from '../useUploadSession';
import { useComposerController } from '../store';

describe('useUploadSession', () => {
  it('keeps the id across re-renders and regenerates only on a new session key', () => {
    const { result, rerender } = renderHook(({ k }) => useUploadSession(k), { initialProps: { k: 'edit-review:r1' } });
    const first = result.current.sessionId;
    rerender({ k: 'edit-review:r1' });
    rerender({ k: 'edit-review:r1' });
    expect(result.current.sessionId).toBe(first);
    act(() => result.current.recordUpload('edit-review:r1', 'u1'));
    expect(result.current.uploads).toEqual(['u1']);
    rerender({ k: 'edit-review:r2' });
    expect(result.current.sessionId).not.toBe(first);
    expect(result.current.uploads).toEqual([]);
    // old session's uploads are kept aside, never auto-cleaned
    expect(result.current.previousSessions[0].uploads).toEqual(['u1']);
    act(() => result.current.recordUpload('edit-review:r1', 'late'));
    expect(result.current.uploads).toEqual([]);
  });
  it('nothing is a cleanup candidate while ambiguous', () => {
    const { result } = renderHook(() => useUploadSession('k'));
    act(() => result.current.recordUpload('k', 'u'));
    act(() => result.current.send({ type: 'AMBIGUOUS' }));
    expect(result.current.cleanupCandidates()).toEqual([]);
  });
});

describe('useComposerController', () => {
  it('the create-review nonce belongs to the controller and survives re-renders', () => {
    const { result, rerender } = renderHook(() => useComposerController({ mode: 'create-review' }));
    const key = result.current.sessionKey;
    rerender();
    expect(result.current.sessionKey).toBe(key);
    act(() => result.current.resetSession());
    expect(result.current.sessionKey).not.toBe(key);
  });
  it('switching resource starts a fresh session', () => {
    const { result, rerender } = renderHook(({ id }) => useComposerController({ mode: 'edit-review', reviewId: id }), {
      initialProps: { id: 'a' },
    });
    expect(result.current.state.sessionKey).toBe('edit-review:a');
    rerender({ id: 'b' });
    expect(result.current.state.sessionKey).toBe('edit-review:b');
    expect(result.current.state.status).toBe('loading');
  });
});
