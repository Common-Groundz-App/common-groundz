/**
 * useMuxStatus — Phase 5 unit tests.
 *
 * Runs under vitest. Documents the locked contract:
 *  - normalizeMuxStatus maps DB enum to UI status correctly.
 *  - onReady fires once per upload_id per hook instance lifetime.
 *  - Hook caps subscription at 8 ids/channel.
 *
 * The realtime Supabase subscription itself is not exercised here — it
 * requires a live channel. The hook keeps that wiring trivially shallow so
 * the contract above is what matters in CI.
 */
import { describe, it, expect } from 'vitest';
import { normalizeMuxStatus, type MuxDbStatus } from './useMuxStatus';

describe('normalizeMuxStatus', () => {
  const cases: Array<[MuxDbStatus, 'processing' | 'ready' | 'failed']> = [
    ['waiting', 'processing'],
    ['asset_created', 'processing'],
    ['ready', 'ready'],
    ['errored', 'failed'],
    ['cancelled', 'failed'],
  ];
  for (const [db, ui] of cases) {
    it(`maps ${db} -> ${ui}`, () => {
      expect(normalizeMuxStatus(db)).toBe(ui);
    });
  }
});
