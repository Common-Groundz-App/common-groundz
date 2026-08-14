import { describe, it, expect } from 'vitest';
import { shouldDockMainComposer } from './composerDocking';

const base = {
  isMainComposerActive: true,
  viewportBelowXl: true,
  keyboardStatus: 'open' as const,
};

describe('shouldDockMainComposer', () => {
  it('docks when active, below xl, and the keyboard is confirmed open', () => {
    expect(shouldDockMainComposer(base)).toBe(true);
  });

  it('stays in flow while the keyboard status is unknown (first focus)', () => {
    expect(shouldDockMainComposer({ ...base, keyboardStatus: 'unknown' })).toBe(false);
  });

  it('stays in flow when the keyboard is closed (hardware keyboard case)', () => {
    expect(shouldDockMainComposer({ ...base, keyboardStatus: 'closed' })).toBe(false);
  });

  it('never docks at or above 1280px', () => {
    expect(shouldDockMainComposer({ ...base, viewportBelowXl: false })).toBe(false);
  });

  it('never docks while the composer is inactive', () => {
    expect(shouldDockMainComposer({ ...base, isMainComposerActive: false })).toBe(false);
  });

  it('requires every condition simultaneously', () => {
    expect(
      shouldDockMainComposer({
        isMainComposerActive: false,
        viewportBelowXl: false,
        keyboardStatus: 'closed',
      })
    ).toBe(false);
  });
});
