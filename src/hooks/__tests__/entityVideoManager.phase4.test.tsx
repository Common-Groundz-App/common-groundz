import React, { useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';

class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } constructor(_cb: unknown) {} }
(globalThis as any).IntersectionObserver = IO;

import { FeedVideoManagerProvider, useFeedVideoSlot } from '@/hooks/useFeedVideoManager';

type Handle = { activate: () => boolean; state: () => { managed: boolean; isActive: boolean } };

const Slot = forwardRef<Handle, { id: string }>(({ id }, ref) => {
  const s = useFeedVideoSlot(id);
  const latest = React.useRef(s);
  latest.current = s;
  useImperativeHandle(ref, () => ({
    activate: () => latest.current.requestActivate(),
    state: () => ({ managed: latest.current.managed, isActive: latest.current.isActive }),
  }));
  return <video ref={s.registerEl} />;
});

describe('entity page shares one video manager (incl. the timeline viewer pop-up)', () => {
  it('a list video and a pop-up video are managed together and never both active', () => {
    const list = React.createRef<Handle>();
    const popup = React.createRef<Handle>();
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(
      <FeedVideoManagerProvider>
        <Slot ref={list} id="review:r1:u1" />
        {createPortal(<Slot ref={popup} id="review_update:x:u2" />, host)}
      </FeedVideoManagerProvider>,
    );
    expect(list.current!.state().managed).toBe(true);
    expect(popup.current!.state().managed).toBe(true);

    act(() => { list.current!.activate(); });
    act(() => { popup.current!.activate(); });
    const a = list.current!.state().isActive;
    const b = popup.current!.state().isActive;
    expect(a && b).toBe(false);
  });

  it('without a provider players fall back to unmanaged mode (old behaviour)', () => {
    const solo = React.createRef<Handle>();
    render(<Slot ref={solo} id="x" />);
    expect(solo.current!.state().managed).toBe(false);
  });
});

void vi;
