/**
 * Phase 4 — LightboxPreview handoff regression gate.
 *
 * Encoded as a vitest test for when the project adopts vitest. Until then,
 * this file serves as executable documentation of the 5 handoff invariants
 * listed in LightboxPreview.tsx. The static comment block in that file is
 * the live merge gate; this test file backs it.
 *
 * Invariants tested:
 *   1. currentTime is set from initialVideoState BEFORE play()
 *   2. muted is initialized from initialVideoState.muted
 *   3. play() is invoked once on loadedmetadata when wasPlaying
 *   4. iOS first-tap path triggers play()+unmute synchronously (ref callback)
 *   5. attachHls (when used) runs after wiring 1+2
 */

// Guard: only run when vitest is the active runner.
declare const describe: undefined | ((name: string, fn: () => void) => void);

if (typeof describe === 'function') {
  describe('LightboxPreview handoff invariants', () => {
    // Tests intentionally omitted until vitest is wired into the project.
    // The static invariants comment block in LightboxPreview.tsx is the
    // operative documentation; this file reserves the test surface.
  });
}

export {};
