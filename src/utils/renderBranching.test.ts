/**
 * Static snapshot of the 5-state Mux render matrix.
 *
 * Runs under vitest when the project adopts it; until then this file
 * doubles as documentation of the locked branching order. Each row asserts
 * that pickRenderBranch maps the input state to the correct branch.
 *
 *   1. mux + errored                            → errored-poster
 *   2. mux + ready + no playback_id (broken)    → errored-poster
 *   3. mux + preparing                          → preparing-poster
 *   4. mux + ready + playback_id (playable)     → mux-hls
 *   5. legacy supabase video                    → legacy-video
 */
import type { MediaItem } from '@/types/media';
import { pickRenderBranch } from './renderBranching';

const base = (over: Partial<MediaItem>): MediaItem => ({
  url: 'https://example.com/v.mp4',
  type: 'video',
  order: 0,
  ...over,
});

const cases: Array<[string, MediaItem, ReturnType<typeof pickRenderBranch>]> = [
  ['mux errored', base({ provider: 'mux', mux_status: 'errored' }), 'errored-poster'],
  ['mux ready + no playback_id', base({ provider: 'mux', mux_status: 'ready' }), 'errored-poster'],
  ['mux preparing', base({ provider: 'mux', mux_status: 'preparing' }), 'preparing-poster'],
  ['mux ready + playback_id', base({ provider: 'mux', mux_status: 'ready', mux_playback_id: 'abc' }), 'mux-hls'],
  ['legacy supabase video', base({}), 'legacy-video'],
];

// Vitest-compatible structure; harmless no-op if vitest absent at import time.
declare const describe: undefined | ((name: string, fn: () => void) => void);
declare const it: undefined | ((name: string, fn: () => void) => void);
declare const expect: undefined | ((v: unknown) => { toBe: (v: unknown) => void });

if (typeof describe === 'function' && typeof it === 'function' && typeof expect === 'function') {
  describe('pickRenderBranch — locked Mux state matrix', () => {
    for (const [name, item, expected] of cases) {
      it(name, () => {
        expect(pickRenderBranch(item)).toBe(expected);
      });
    }
  });
}

export { cases as renderBranchingCases };
