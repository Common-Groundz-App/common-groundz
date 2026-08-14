import { describe, it, expect } from 'vitest';
import {
  createKeyboardState,
  reduceKeyboardState,
  type KeyboardState,
  type KeyboardStatus,
  type KeyboardViewportSample,
} from './viewportKeyboard';

const sample = (over: Partial<KeyboardViewportSample> = {}): KeyboardViewportSample => ({
  visualHeight: 700,
  visualWidth: 390,
  scale: 1,
  orientation: 'portrait',
  editableActive: false,
  ...over,
});

const run = (state: KeyboardState, samples: Partial<KeyboardViewportSample>[]) => {
  let current = state;
  let keyboardOpen = false;
  let keyboardStatus: KeyboardStatus = 'unknown';
  let shrinkPx = 0;
  for (const s of samples) {
    const result = reduceKeyboardState(current, sample(s));
    current = result.state;
    keyboardOpen = result.keyboardOpen;
    keyboardStatus = result.keyboardStatus;
    shrinkPx = result.shrinkPx;
  }
  return { state: current, keyboardOpen, keyboardStatus, shrinkPx };
};


describe('viewportKeyboard', () => {
  it('seeds and raises the baseline only while inactive, then classifies a shrink', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 640 }, { visualHeight: 700 }]);
    expect(seeded.state.baseline).toBe(700);
    expect(seeded.keyboardOpen).toBe(false);

    const open = run(seeded.state, [{ visualHeight: 320, editableActive: true }]);
    expect(open.keyboardOpen).toBe(true);

    const closed = run(open.state, [{ visualHeight: 700, editableActive: true }]);
    expect(closed.keyboardOpen).toBe(false);
  });

  it('never writes the baseline while a composer is active', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 700 }]);
    const active = run(seeded.state, [
      { visualHeight: 300, editableActive: true },
      { visualHeight: 280, editableActive: true },
      { visualHeight: 900, editableActive: true },
    ]);
    expect(active.state.baseline).toBe(700);
  });

  it('keeps the frozen baseline through width jitter while active', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 700, visualWidth: 390 }]);
    const jittered = run(seeded.state, [
      { visualHeight: 300, visualWidth: 389, editableActive: true },
      { visualHeight: 300, visualWidth: 390, editableActive: true },
    ]);
    expect(jittered.state.baseline).toBe(700);
    expect(jittered.keyboardOpen).toBe(true);
  });

  it('treats a keyboard shrink as a keyboard, not a rotation', () => {
    // 390x700 portrait baseline, then 390x300 while the label is still portrait.
    const seeded = run(createKeyboardState(), [{ visualHeight: 700, visualWidth: 390 }]);
    const shrunk = run(seeded.state, [
      { visualHeight: 300, visualWidth: 390, orientation: 'portrait', editableActive: true },
    ]);
    expect(shrunk.keyboardOpen).toBe(true);
    expect(shrunk.state.baseline).toBe(700);
  });

  it('invalidates the baseline on an independently reported orientation change', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 700 }]);
    const rotatedActive = run(seeded.state, [
      { visualHeight: 300, visualWidth: 700, orientation: 'landscape', editableActive: true },
    ]);
    // Conservative: unknown baseline → padding retained.
    expect(rotatedActive.keyboardOpen).toBe(false);
    expect(rotatedActive.state.baseline).toBeNull();

    const reseeded = run(rotatedActive.state, [
      { visualHeight: 360, visualWidth: 700, orientation: 'landscape' },
    ]);
    expect(reseeded.state.baseline).toBe(360);
    expect(reseeded.state.baselineOrientation).toBe('landscape');
  });

  it('ignores pinch zoom', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 700 }]);
    const zoomed = run(seeded.state, [
      { visualHeight: 300, scale: 2, editableActive: true },
    ]);
    expect(zoomed.keyboardOpen).toBe(false);
    expect(zoomed.state.baseline).toBe(700);

    const zoomedInactive = run(seeded.state, [{ visualHeight: 900, scale: 2 }]);
    expect(zoomedInactive.state.baseline).toBe(700);
  });

  it('does not treat a toolbar-sized shrink as a keyboard', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 700 }]);
    // 700 * 0.15 = 105 → threshold is the 120px floor.
    const toolbar = run(seeded.state, [{ visualHeight: 600, editableActive: true }]);
    expect(toolbar.keyboardOpen).toBe(false);
  });

  it('reports nothing until a baseline exists', () => {
    const cold = run(createKeyboardState(), [{ visualHeight: 300, editableActive: true }]);
    expect(cold.keyboardOpen).toBe(false);
    expect(cold.state.baseline).toBeNull();
  });

  it('survives the full focus-to-keyboard transition with the baseline intact', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 700, visualWidth: 390 }]);
    const baseline = seeded.state.baseline;

    const transition = run(seeded.state, [
      // Activity flips before the first keyboard resize sample.
      { visualHeight: 700, visualWidth: 390, editableActive: true },
      // Intermediate presentation frames, incl. width jitter + aspect crossing.
      { visualHeight: 560, visualWidth: 389, editableActive: true },
      { visualHeight: 380, visualWidth: 390, editableActive: true },
      { visualHeight: 340, visualWidth: 390, editableActive: true },
      // Scroll-driven samples interleaved.
      { visualHeight: 336, visualWidth: 390, editableActive: true },
      { visualHeight: 336, visualWidth: 390, editableActive: true },
    ]);

    expect(transition.state.baseline).toBe(baseline);
    expect(transition.keyboardOpen).toBe(true);
  });

  it('distinguishes closed from unknown', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 700 }]);
    // Inactive samples are always unknown, never closed.
    expect(seeded.keyboardStatus).toBe('unknown');

    const open = run(seeded.state, [{ visualHeight: 320, editableActive: true }]);
    expect(open.keyboardStatus).toBe('open');

    // Recovered height while still focused = confirmed dismissal.
    const closed = run(open.state, [{ visualHeight: 700, editableActive: true }]);
    expect(closed.keyboardStatus).toBe('closed');
    expect(closed.keyboardOpen).toBe(false);

    // Zoomed, rotated and baseline-less samples are unknown.
    expect(run(open.state, [{ visualHeight: 700, scale: 2, editableActive: true }]).keyboardStatus)
      .toBe('unknown');
    expect(
      run(open.state, [
        { visualHeight: 380, visualWidth: 700, orientation: 'landscape', editableActive: true },
      ]).keyboardStatus
    ).toBe('unknown');
    expect(
      run(createKeyboardState(), [{ visualHeight: 320, editableActive: true }]).keyboardStatus
    ).toBe('unknown');
  });

  it('ignores offsetTop entirely (not part of the sample shape)', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 700 }]);
    expect(Object.keys(seeded.state)).toEqual(['baseline', 'baselineOrientation', 'lastWidth']);
  });

  it('reports shrinkPx only for trustworthy open-session samples', () => {
    const seeded = run(createKeyboardState(), [{ visualHeight: 800 }]);
    expect(seeded.shrinkPx).toBe(0); // inactive samples say nothing

    const open = run(seeded.state, [{ visualHeight: 500, editableActive: true }]);
    expect(open.keyboardStatus).toBe('open');
    expect(open.shrinkPx).toBe(300);

    // Zoomed / rotated / baseline-less samples contribute no shrink.
    expect(run(open.state, [{ visualHeight: 500, scale: 2, editableActive: true }]).shrinkPx).toBe(0);
    expect(
      run(open.state, [
        { visualHeight: 380, visualWidth: 700, orientation: 'landscape', editableActive: true },
      ]).shrinkPx
    ).toBe(0);
    expect(run(createKeyboardState(), [{ visualHeight: 320, editableActive: true }]).shrinkPx).toBe(0);
  });
});
