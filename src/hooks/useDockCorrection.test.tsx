import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDockCorrection } from '@/hooks/useDockCorrection';

type Listener = () => void;

const vvListeners: Record<string, Listener[]> = { resize: [], scroll: [] };
let frames: Array<() => void> = [];
let removed: string[] = [];

const setViewport = (height: number, offsetTop = 0, scale = 1) => {
  Object.assign(window.visualViewport as unknown as Record<string, unknown>, {
    height,
    offsetTop,
    scale,
  });
};

const flushFrames = () => {
  const pending = frames;
  frames = [];
  pending.forEach((fn) => fn());
};

beforeEach(() => {
  vvListeners.resize = [];
  vvListeners.scroll = [];
  frames = [];
  removed = [];

  (window as unknown as Record<string, unknown>).visualViewport = {
    height: 800,
    offsetTop: 0,
    scale: 1,
    addEventListener: (type: string, fn: Listener) => {
      vvListeners[type] = vvListeners[type] ?? [];
      vvListeners[type].push(fn);
    },
    removeEventListener: (type: string, fn: Listener) => {
      removed.push(type);
      vvListeners[type] = (vvListeners[type] ?? []).filter((l) => l !== fn);
    },
  };

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    frames.push(() => cb(0));
    return frames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Fake shell whose rect bottom follows the applied correction. */
const makeShell = (layoutBottom: number) => {
  const node = document.createElement('div');
  let correction = 0;
  Object.defineProperty(node, 'getBoundingClientRect', {
    value: () => ({ bottom: layoutBottom - correction }) as DOMRect,
  });
  return {
    ref: { current: node } as React.RefObject<HTMLElement | null>,
    apply: (px: number) => {
      correction = px;
    },
  };
};

describe('useDockCorrection', () => {
  it('measures immediately on enable with no viewport event', () => {
    const shell = makeShell(800);
    setViewport(500);
    const { result } = renderHook(() =>
      useDockCorrection({
        enabled: true,
        keyboardStatus: 'open',
        shrinkPx: 300,
        orientation: 'portrait',
        shellRef: shell.ref,
      })
    );
    expect(result.current).toBe(300);
  });

  it('follow-up frame yields the same value (fixed point)', () => {
    const shell = makeShell(800);
    setViewport(500);
    const { result } = renderHook(() =>
      useDockCorrection({
        enabled: true,
        keyboardStatus: 'open',
        shrinkPx: 300,
        orientation: 'portrait',
        shellRef: shell.ref,
      })
    );
    shell.apply(result.current);
    act(() => flushFrames());
    expect(result.current).toBe(300);
  });

  it('coalesces resize + scroll in one frame into a single calculation', () => {
    const shell = makeShell(800);
    setViewport(500);
    renderHook(() =>
      useDockCorrection({
        enabled: true,
        keyboardStatus: 'open',
        shrinkPx: 300,
        orientation: 'portrait',
        shellRef: shell.ref,
      })
    );
    act(() => flushFrames());
    frames = [];
    act(() => {
      vvListeners.resize.forEach((fn) => fn());
      vvListeners.scroll.forEach((fn) => fn());
    });
    expect(frames).toHaveLength(1);
  });

  it('resets to 0 when disabled, when the keyboard closes, and on rotation', () => {
    const shell = makeShell(800);
    setViewport(500);
    const { result, rerender } = renderHook((props: Parameters<typeof useDockCorrection>[0]) =>
      useDockCorrection(props), {
      initialProps: {
        enabled: true,
        keyboardStatus: 'open' as const,
        shrinkPx: 300,
        orientation: 'portrait' as const,
        shellRef: shell.ref,
      },
    });
    expect(result.current).toBe(300);

    rerender({
      enabled: false,
      keyboardStatus: 'open',
      shrinkPx: 300,
      orientation: 'portrait',
      shellRef: shell.ref,
    });
    expect(result.current).toBe(0);

    rerender({
      enabled: true,
      keyboardStatus: 'closed',
      shrinkPx: 0,
      orientation: 'portrait',
      shellRef: shell.ref,
    });
    expect(result.current).toBe(0);

    rerender({
      enabled: true,
      keyboardStatus: 'open',
      shrinkPx: 300,
      orientation: 'landscape',
      shellRef: shell.ref,
    });
    expect(result.current).toBe(300);
  });

  it('removes listeners on unmount', () => {
    const shell = makeShell(800);
    setViewport(500);
    const { unmount } = renderHook(() =>
      useDockCorrection({
        enabled: true,
        keyboardStatus: 'open',
        shrinkPx: 300,
        orientation: 'portrait',
        shellRef: shell.ref,
      })
    );
    unmount();
    expect(removed).toContain('resize');
    expect(removed).toContain('scroll');
    expect(vvListeners.resize).toHaveLength(0);
    expect(vvListeners.scroll).toHaveLength(0);
  });
});
