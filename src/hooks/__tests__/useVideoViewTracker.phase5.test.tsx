import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

let ioCb: ((e: any[]) => void) | null = null;
class IO { constructor(cb: any) { ioCb = cb; } observe() {} disconnect() {} }
(globalThis as any).IntersectionObserver = IO;
const invoke = vi.fn((..._a: any[]) => Promise.resolve({}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: any[]) => invoke(...a) } } }));

import { useVideoViewTracker, type ViewSource } from '@/hooks/useVideoViewTracker';

let frames: ((t: number) => void)[] = [];
let now = 0;
/** Advance simulated time in 100ms frames. */
function advance(ms: number) {
  for (let t = 0; t < ms; t += 100) {
    now += 100;
    const f = frames; frames = [];
    f.forEach((cb) => cb(now));
  }
}

let videoEl: HTMLVideoElement;
function Probe({ source, mediaPath = 'p', mediaId = 'm1' }: { source: ViewSource; mediaPath?: string; mediaId?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const auto = useRef(true);
  useVideoViewTracker({ videoRef: ref, source, sourceId: 's', mediaPath, mediaId, autoplayRef: auto });
  return <video ref={(el) => { (ref as any).current = el; if (el) videoEl = el; }} />;
}

const fire = (name: string) => act(() => { videoEl.dispatchEvent(new Event(name)); });
const show = (ratio = 1) => act(() => { ioCb?.([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]); });

beforeEach(() => {
  invoke.mockClear(); frames = []; now = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: any) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
});
afterEach(() => vi.unstubAllGlobals());

describe('Phase 5 review view tracking', () => {
  it('accumulates across pause/resume and sends review_update with mediaId', () => {
    render(<Probe source="review_update" />);
    show(); fire('playing'); advance(1500);
    fire('pause'); advance(3000);
    expect(invoke).not.toHaveBeenCalled();
    fire('playing'); advance(1300);
    expect(invoke).toHaveBeenCalledTimes(1);
    const body = (invoke.mock.calls[0] as any)[1].body;
    expect(body.source).toBe('review_update');
    expect(body.mediaId).toBe('m1');
  });

  it('buffering and seeking time does not count for reviews', () => {
    render(<Probe source="review" />);
    show(); fire('playing'); advance(1000);
    fire('waiting'); advance(5000);
    fire('seeking'); advance(5000);
    expect(invoke).not.toHaveBeenCalled();
    fire('playing'); advance(1800);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('less than 50% visible does not count', () => {
    render(<Probe source="review" />);
    show(0.4); fire('playing'); advance(5000);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('timer resets when media changes', () => {
    const { rerender } = render(<Probe source="review" mediaPath="a" mediaId="a" />);
    show(); fire('playing'); advance(2000);
    rerender(<Probe source="review" mediaPath="b" mediaId="b" />);
    show(); fire('playing'); advance(1000);
    expect(invoke).not.toHaveBeenCalled();
    advance(1600);
    expect((invoke.mock.calls[0] as any)[1].body.mediaId).toBe('b');
  });

  it('post behaviour unchanged: waiting is not excluded, no mediaId sent', () => {
    render(<Probe source="post" />);
    show(); fire('playing'); fire('waiting'); advance(2600);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect((invoke.mock.calls[0] as any)[1].body.mediaId).toBeUndefined();
  });
});
