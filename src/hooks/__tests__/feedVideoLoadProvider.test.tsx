import React, { forwardRef, useImperativeHandle } from 'react';
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';

class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } constructor(_cb: unknown) {} }
(globalThis as any).IntersectionObserver = IO;

import { FeedVideoManagerProvider, useFeedVideoSlot, useFeedVideoManagerControls } from '@/hooks/useFeedVideoManager';

type H = { pin: () => void; release: () => void; load: () => boolean; lb: (o: boolean) => void };
const Slot = forwardRef<H, { id: string }>(({ id }, ref) => {
  const s = useFeedVideoSlot(id);
  const c = useFeedVideoManagerControls();
  const l = React.useRef(s); l.current = s;
  useImperativeHandle(ref, () => ({ pin: () => l.current.pinHandoff(), release: () => l.current.releaseHandoff(), load: () => l.current.loadAllowed, lb: c.setLightboxOpen }));
  return <video ref={s.registerEl} />;
});

describe('provider loading budget wiring', () => {
  it('unmanaged players always load (legacy)', () => {
    const r = React.createRef<H>();
    render(<Slot ref={r} id="solo" />);
    expect(r.current!.load()).toBe(true);
  });

  it('managed far/unmeasured players are poster-only; a handoff pin attaches and is released', () => {
    const refs = ['a', 'b', 'c'].map(() => React.createRef<H>());
    render(<FeedVideoManagerProvider>{refs.map((r, i) => <Slot key={i} ref={r} id={`s${i}`} />)}</FeedVideoManagerProvider>);
    expect(refs.every((r) => !r.current!.load())).toBe(true);
    act(() => { refs[1].current!.lb(true); refs[1].current!.pin(); });
    expect(refs.map((r) => r.current!.load())).toEqual([false, true, false]);
    act(() => { refs[1].current!.release(); });
    expect(refs[1].current!.load()).toBe(false);
  });
});
