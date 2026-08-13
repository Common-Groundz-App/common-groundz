import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useSoftwareKeyboardOpen } from './useSoftwareKeyboardOpen';

type Listener = () => void;

const makeViewport = (height: number, width: number) => {
  const listeners: Record<string, Listener[]> = {};
  return {
    height,
    width,
    scale: 1,
    addEventListener: vi.fn((type: string, fn: Listener) => {
      (listeners[type] ||= []).push(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: Listener) => {
      listeners[type] = (listeners[type] || []).filter((l) => l !== fn);
    }),
    emit(type: string) {
      (listeners[type] || []).forEach((l) => l());
    },
    listenerCount(type: string) {
      return (listeners[type] || []).length;
    },
  };
};

let vv: ReturnType<typeof makeViewport>;
let mediaListeners: Listener[];
let portraitMatches: boolean;
let frames: FrameRequestCallback[];

const Probe = ({ active }: { active: boolean }) => {
  const open = useSoftwareKeyboardOpen({ editableActive: active });
  return <span data-testid="state">{open ? 'open' : 'closed'}</span>;
};

const flushFrames = () => {
  const pending = frames;
  frames = [];
  act(() => {
    pending.forEach((fn) => fn(0));
  });
};

beforeEach(() => {
  vv = makeViewport(700, 390);
  mediaListeners = [];
  portraitMatches = true;
  frames = [];

  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true, writable: true });
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return portraitMatches;
    },
    addEventListener: (_t: string, fn: Listener) => mediaListeners.push(fn),
    removeEventListener: (_t: string, fn: Listener) => {
      mediaListeners = mediaListeners.filter((l) => l !== fn);
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.push(fn);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames[id - 1] = () => {};
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSoftwareKeyboardOpen', () => {
  it('samples synchronously and reports closed while unfocused', () => {
    const { getByTestId } = render(<Probe active={false} />);
    expect(getByTestId('state').textContent).toBe('closed');
  });

  it('reports open once a credible shrink arrives while active', () => {
    const { getByTestId, rerender } = render(<Probe active={false} />);

    // Focus first, then the keyboard resizes the visual viewport.
    act(() => rerender(<Probe active />));
    vv.height = 320;
    act(() => vv.emit('resize'));
    flushFrames();

    expect(getByTestId('state').textContent).toBe('open');
  });

  it('keeps the baseline out of reach of keyboard frames (recovers on blur)', () => {
    const { getByTestId, rerender } = render(<Probe active={false} />);
    act(() => rerender(<Probe active />));
    vv.height = 320;
    act(() => vv.emit('resize'));
    flushFrames();
    expect(getByTestId('state').textContent).toBe('open');

    vv.height = 700;
    act(() => rerender(<Probe active={false} />));
    expect(getByTestId('state').textContent).toBe('closed');

    // Re-focus and shrink again: the original baseline still classifies.
    act(() => rerender(<Probe active />));
    vv.height = 320;
    act(() => vv.emit('resize'));
    flushFrames();
    expect(getByTestId('state').textContent).toBe('open');
  });

  it('re-samples immediately when activity flips', () => {
    const { getByTestId, rerender } = render(<Probe active={false} />);
    vv.height = 320; // keyboard already up (e.g. focus moved between composers)
    act(() => rerender(<Probe active />));
    // No resize event needed — the activity change forces a sample.
    expect(getByTestId('state').textContent).toBe('open');
  });

  it('subscribes to viewport, window and media-query events and cleans them up', () => {
    const { unmount, rerender } = render(<Probe active={false} />);
    expect(vv.listenerCount('resize')).toBe(1);
    expect(vv.listenerCount('scroll')).toBe(1);
    expect(mediaListeners.length).toBe(1);

    act(() => rerender(<Probe active />));
    unmount();
    expect(vv.listenerCount('resize')).toBe(0);
    expect(vv.listenerCount('scroll')).toBe(0);
    expect(mediaListeners.length).toBe(0);
  });

  it('propagates an orientation label change from the media query', () => {
    const { getByTestId, rerender } = render(<Probe active={false} />);
    act(() => rerender(<Probe active />));
    vv.height = 320;
    act(() => vv.emit('resize'));
    flushFrames();
    expect(getByTestId('state').textContent).toBe('open');

    // A real rotation invalidates the baseline → conservative "closed".
    portraitMatches = false;
    vv.width = 700;
    act(() => mediaListeners.forEach((l) => l()));
    flushFrames();
    expect(getByTestId('state').textContent).toBe('closed');
  });

  it('reports false when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
    const { getByTestId } = render(<Probe active />);
    expect(getByTestId('state').textContent).toBe('closed');
  });

  it('does not update state after unmount', () => {
    const { unmount } = render(<Probe active />);
    unmount();
    expect(() => {
      vv.height = 320;
      vv.emit('resize');
      flushFrames();
    }).not.toThrow();
  });
});
