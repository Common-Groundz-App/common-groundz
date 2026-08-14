import { describe, it, expect } from 'vitest';
import { nextDockCorrection, type DockCorrectionInput } from '@/utils/dockCorrection';

const base: DockCorrectionInput = {
  shellBottom: 800,
  visualOffsetTop: 0,
  visualHeight: 800,
  scale: 1,
  currentCorrection: 0,
  shrinkPx: 300,
  keyboardStatus: 'open',
};

const px = (input: Partial<DockCorrectionInput>) => nextDockCorrection({ ...base, ...input });

describe('nextDockCorrection', () => {
  it('returns 0 when already flush', () => {
    expect(px({})).toEqual({ kind: 'correction', px: 0 });
  });

  it('ignores sub-tolerance rect noise', () => {
    expect(px({ shellBottom: 801.4 })).toEqual({ kind: 'correction', px: 0 });
  });

  it('returns 0 when the shell sits above the visual bottom', () => {
    expect(px({ shellBottom: 700 })).toEqual({ kind: 'correction', px: 0 });
  });

  it('lifts by the measured overhang when behind the keyboard', () => {
    // Viewport shrank to 500 but the shell is still at the 800px layout bottom.
    expect(px({ visualHeight: 500, shrinkPx: 300 })).toEqual({ kind: 'correction', px: 300 });
  });

  it('accounts for visualViewport offsetTop', () => {
    expect(px({ visualOffsetTop: 100, visualHeight: 600 })).toEqual({
      kind: 'correction',
      px: 100,
    });
  });

  it('clamps the correction to the trustworthy shrink', () => {
    expect(px({ visualHeight: 400, shrinkPx: 250 })).toEqual({ kind: 'correction', px: 250 });
  });

  it('returns 0 when shrink is untrustworthy', () => {
    expect(px({ visualHeight: 400, shrinkPx: 0 })).toEqual({ kind: 'correction', px: 0 });
  });

  it('is a fixed point once the correction is applied', () => {
    const first = px({ visualHeight: 500 });
    expect(first).toEqual({ kind: 'correction', px: 300 });
    // Shell rect now reflects the lift.
    const second = px({ visualHeight: 500, shellBottom: 500, currentCorrection: 300 });
    expect(second).toEqual({ kind: 'correction', px: 300 });
  });

  it('skips when the keyboard is not confirmed open', () => {
    expect(px({ keyboardStatus: 'closed' })).toEqual({ kind: 'skip' });
    expect(px({ keyboardStatus: 'unknown' })).toEqual({ kind: 'skip' });
  });

  it('skips when zoomed', () => {
    expect(px({ scale: 1.5, visualHeight: 500 })).toEqual({ kind: 'skip' });
  });

  it('skips on invalid geometry', () => {
    expect(px({ visualHeight: 0 })).toEqual({ kind: 'skip' });
    expect(px({ shellBottom: Number.NaN })).toEqual({ kind: 'skip' });
    expect(px({ shrinkPx: Number.POSITIVE_INFINITY })).toEqual({ kind: 'skip' });
  });
});
