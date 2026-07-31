/**
 * useMuxStatus — Phase 5 unit tests.
 *
 * Documents and asserts the locked contract:
 *  - normalizeMuxStatus maps each DB enum value to the correct UI status.
 *
 * Realtime subscription wiring is intentionally not exercised here — it
 * requires a live Supabase channel. The hook keeps that path trivially
 * shallow so the public contract above is what matters in CI.
 *
 * Vitest-compatible structure; harmless no-op if vitest is absent at
 * import time (mirrors the pattern used in src/utils/renderBranching.test.ts).
 */
import { normalizeMuxStatus, type MuxDbStatus, type MuxUiStatus } from './useMuxStatus';

const cases: Array<[MuxDbStatus, MuxUiStatus]> = [
  ['waiting', 'processing'],
  ['asset_created', 'processing'],
  ['ready', 'ready'],
  ['errored', 'failed'],
  ['cancelled', 'failed'],
];

import { describe, expect, it } from 'vitest';

describe('useMuxStatus — normalizeMuxStatus', () => {
  for (const [db, ui] of cases) {
    it(`maps ${db} -> ${ui}`, () => {
      expect(normalizeMuxStatus(db)).toBe(ui);
    });
  }
});

export { cases as muxStatusNormalizationCases };
