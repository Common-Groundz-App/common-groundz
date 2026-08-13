import React, { useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import {
  ComposerFocusProvider,
  useComposerFocus,
  useComposerFocusRegion,
} from './ComposerFocusContext';

/**
 * requestAnimationFrame is driven manually so the deferred blur check can be
 * flushed explicitly — an implicit timer would make these tests racy.
 */
let rafQueue: FrameRequestCallback[] = [];

beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    rafQueue[handle - 1] = () => {};
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const flushRaf = () => {
  act(() => {
    const queue = rafQueue;
    rafQueue = [];
    queue.forEach((cb) => cb(0));
  });
};

/** Mirrors BottomNavigation's contract: render nothing while a composer is active. */
const NavProbe = () => {
  const { isComposerActive } = useComposerFocus();
  if (isComposerActive) return null;
  return <div data-testid="nav">nav</div>;
};

const Composer = ({
  id,
  enabled = true,
  label = 'composer',
}: {
  id: string;
  enabled?: boolean;
  label?: string;
}) => {
  const { isActive, ...region } = useComposerFocusRegion(id, { enabled });
  return (
    <div {...region}>
      <textarea aria-label={`${label}-input`} />
      <button type="button" aria-label={`${label}-send`}>
        send
      </button>
      <span data-testid={`${label}-active`}>{isActive ? 'active' : 'idle'}</span>
    </div>
  );
};


const renderApp = (ui: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={['/post/1']}>
      <ComposerFocusProvider>
        <Routes>
          <Route path="/post/1" element={<>{ui}</>} />
          <Route path="/home" element={<div>home</div>} />
        </Routes>
        <NavProbe />
      </ComposerFocusProvider>
    </MemoryRouter>
  );

const focus = (el: HTMLElement) => act(() => el.focus());
const blur = (el: HTMLElement) => act(() => el.blur());

describe('ComposerFocusContext', () => {
  it('hides the nav on capture-phase focus of an editable element', () => {
    renderApp(<Composer id="a" />);
    expect(screen.getByTestId('nav')).toBeInTheDocument();

    focus(screen.getByLabelText('composer-input'));
    expect(screen.queryByTestId('nav')).toBeNull();
  });

  it('restores the nav only after the deferred blur check runs', () => {
    renderApp(<Composer id="a" />);
    const input = screen.getByLabelText('composer-input');
    focus(input);
    blur(input);

    // Still hidden until the rAF callback is flushed.
    expect(screen.queryByTestId('nav')).toBeNull();
    flushRaf();
    expect(screen.getByTestId('nav')).toBeInTheDocument();
  });

  it('stays active when focus moves to another control inside the region', () => {
    renderApp(<Composer id="a" />);
    focus(screen.getByLabelText('composer-input'));
    focus(screen.getByLabelText('composer-send'));
    flushRaf();
    expect(screen.queryByTestId('nav')).toBeNull();
  });

  it('exposes isActive for the focused region only', () => {
    renderApp(
      <>
        <Composer id="a" label="one" />
        <Composer id="b" label="two" />
      </>
    );
    expect(screen.getByTestId('one-active').textContent).toBe('idle');
    expect(screen.getByTestId('two-active').textContent).toBe('idle');

    focus(screen.getByLabelText('one-input'));
    expect(screen.getByTestId('one-active').textContent).toBe('active');
    expect(screen.getByTestId('two-active').textContent).toBe('idle');
  });

  it('never reports isActive for a disabled (guest) region', () => {
    renderApp(<Composer id="a" enabled={false} label="guest" />);
    focus(screen.getByLabelText('guest-input'));
    expect(screen.getByTestId('guest-active').textContent).toBe('idle');
  });

  it('stays active while the textarea keeps focus after submit', () => {
    // Submitting clears text without blurring; the nav must not flash back.
    const Submitting = () => {
      const { isActive, ...region } = useComposerFocusRegion('main');
      const [value, setValue] = useState('hi');
      return (
        <div {...region}>
          <textarea aria-label="main-input" value={value} onChange={() => {}} />
          <button type="button" aria-label="submit" onClick={() => setValue('')}>
            post
          </button>
          <span data-testid="main-active">{isActive ? 'active' : 'idle'}</span>
        </div>
      );
    };
    // Submitting clears text without blurring; the nav must not flash back.
    const Submitting = () => {
      const region = useComposerFocusRegion('main');
      const [value, setValue] = useState('hi');
      return (
        <div {...region}>
          <textarea aria-label="main-input" value={value} onChange={() => {}} />
          <button type="button" aria-label="submit" onClick={() => setValue('')}>
            post
          </button>
        </div>
      );
    };
    renderApp(<Submitting />);
    const input = screen.getByLabelText('main-input');
    focus(input);
    act(() => screen.getByLabelText('submit').click());
    flushRaf();
    expect(document.activeElement).toBe(input);
    expect(screen.queryByTestId('nav')).toBeNull();
  });

  it('ignores disabled (guest) regions', () => {
    renderApp(<Composer id="a" enabled={false} />);
    focus(screen.getByLabelText('composer-input'));
    expect(screen.getByTestId('nav')).toBeInTheDocument();
  });

  it('releases on unmount', () => {
    const Wrapper = () => {
      const [show, setShow] = useState(true);
      return (
        <>
          {show && <Composer id="reply" label="reply" />}
          <button type="button" aria-label="cancel" onClick={() => setShow(false)}>
            cancel
          </button>
        </>
      );
    };
    renderApp(<Wrapper />);
    focus(screen.getByLabelText('reply-input'));
    expect(screen.queryByTestId('nav')).toBeNull();

    act(() => screen.getByLabelText('cancel').click());
    expect(screen.getByTestId('nav')).toBeInTheDocument();
  });

  it('keeps the nav hidden while a second overlapping region is still focused', () => {
    renderApp(
      <>
        <Composer id="one" label="one" />
        <Composer id="two" label="two" />
      </>
    );
    focus(screen.getByLabelText('one-input'));
    focus(screen.getByLabelText('two-input'));
    flushRaf();
    expect(screen.queryByTestId('nav')).toBeNull();

    blur(screen.getByLabelText('two-input'));
    flushRaf();
    expect(screen.getByTestId('nav')).toBeInTheDocument();
  });

  it('resets on route change', () => {
    const Nav = () => {
      const navigate = useNavigate();
      return (
        <button type="button" aria-label="go-home" onClick={() => navigate('/home')}>
          home
        </button>
      );
    };
    renderApp(
      <>
        <Composer id="a" />
        <Nav />
      </>
    );
    focus(screen.getByLabelText('composer-input'));
    expect(screen.queryByTestId('nav')).toBeNull();

    act(() => screen.getByLabelText('go-home').click());
    expect(screen.getByTestId('nav')).toBeInTheDocument();
  });
});
