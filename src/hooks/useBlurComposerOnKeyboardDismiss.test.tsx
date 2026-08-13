import React, { useRef } from 'react';
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { useBlurComposerOnKeyboardDismiss } from './useBlurComposerOnKeyboardDismiss';
import type { KeyboardStatus } from '@/utils/viewportKeyboard';

interface HarnessProps {
  status: KeyboardStatus;
  sessionId: string | null;
  enabled?: boolean;
}

const Harness = ({ status, sessionId, enabled = true }: HarnessProps) => {
  const mainRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLDivElement>(null);

  useBlurComposerOnKeyboardDismiss({
    status,
    sessionId,
    enabled,
    regionRefs: [mainRef, replyRef],
  });

  return (
    <>
      <div ref={mainRef}>
        <textarea data-testid="main" />
        <button data-testid="send">Send</button>
      </div>
      <div ref={replyRef}>
        <textarea data-testid="reply" />
      </div>
      <textarea data-testid="outside" />
    </>
  );
};

const MAIN = 'thread:main';
const REPLY = 'thread:reply';

describe('useBlurComposerOnKeyboardDismiss', () => {
  it('blurs the focused composer on a consecutive open -> closed transition', () => {
    const { getByTestId, rerender } = render(<Harness status="unknown" sessionId={MAIN} />);
    const textarea = getByTestId('main') as HTMLTextAreaElement;
    act(() => textarea.focus());

    act(() => rerender(<Harness status="open" sessionId={MAIN} />));
    expect(document.activeElement).toBe(textarea);

    act(() => rerender(<Harness status="closed" sessionId={MAIN} />));
    expect(document.activeElement).not.toBe(textarea);
  });

  it('does not blur when unknown interrupts the transition (pinch zoom)', () => {
    const { getByTestId, rerender } = render(<Harness status="unknown" sessionId={MAIN} />);
    const textarea = getByTestId('main') as HTMLTextAreaElement;
    act(() => textarea.focus());

    act(() => rerender(<Harness status="open" sessionId={MAIN} />));
    act(() => rerender(<Harness status="unknown" sessionId={MAIN} />));
    act(() => rerender(<Harness status="closed" sessionId={MAIN} />));

    expect(document.activeElement).toBe(textarea);
  });

  it('does not blur when the editable session changed while the keyboard stayed open', () => {
    const { getByTestId, rerender } = render(<Harness status="unknown" sessionId={MAIN} />);
    act(() => (getByTestId('main') as HTMLTextAreaElement).focus());
    act(() => rerender(<Harness status="open" sessionId={MAIN} />));

    const reply = getByTestId('reply') as HTMLTextAreaElement;
    act(() => reply.focus());
    act(() => rerender(<Harness status="closed" sessionId={REPLY} />));

    expect(document.activeElement).toBe(reply);
  });

  it('does nothing when disabled (e.g. desktop above the nav breakpoint)', () => {
    const { getByTestId, rerender } = render(
      <Harness status="unknown" sessionId={MAIN} enabled={false} />
    );
    const textarea = getByTestId('main') as HTMLTextAreaElement;
    act(() => textarea.focus());

    act(() => rerender(<Harness status="open" sessionId={MAIN} enabled={false} />));
    act(() => rerender(<Harness status="closed" sessionId={MAIN} enabled={false} />));

    expect(document.activeElement).toBe(textarea);
  });

  it('never blurs a non-editable control or an element outside the regions', () => {
    const { getByTestId, rerender } = render(<Harness status="unknown" sessionId={MAIN} />);

    // Focus inside an active region, but on the send button.
    const send = getByTestId('send') as HTMLButtonElement;
    act(() => send.focus());
    act(() => rerender(<Harness status="open" sessionId={MAIN} />));
    act(() => rerender(<Harness status="closed" sessionId={MAIN} />));
    expect(document.activeElement).toBe(send);

    // Focus an editable outside every region of this thread.
    const outside = getByTestId('outside') as HTMLTextAreaElement;
    act(() => outside.focus());
    act(() => rerender(<Harness status="open" sessionId={MAIN} />));
    act(() => rerender(<Harness status="closed" sessionId={MAIN} />));
    expect(document.activeElement).toBe(outside);
  });

  it('does not fire twice off one armed transition', () => {
    const { getByTestId, rerender } = render(<Harness status="unknown" sessionId={MAIN} />);
    const textarea = getByTestId('main') as HTMLTextAreaElement;
    act(() => textarea.focus());
    act(() => rerender(<Harness status="open" sessionId={MAIN} />));
    act(() => rerender(<Harness status="closed" sessionId={MAIN} />));
    expect(document.activeElement).not.toBe(textarea);

    // Re-focus without a new confirmed `open`: a later `closed` must be inert.
    act(() => textarea.focus());
    act(() => rerender(<Harness status="closed" sessionId={MAIN} />));
    expect(document.activeElement).toBe(textarea);
  });
});
