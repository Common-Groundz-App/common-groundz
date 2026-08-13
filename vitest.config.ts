import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';

/**
 * Kept in a dedicated file (not merged into vite.config.ts) so the `test` key
 * can never be silently dropped by Vite's own config typing — a missing runner
 * config is exactly how the notification suites previously "passed" without
 * executing a single assertion.
 *
 * Two projects, deliberately:
 *
 * - `node`  — the original pure-TypeScript suites. Same environment and same
 *             explicit allowlist as before; nothing about them changed. The
 *             include list is explicit rather than a broad glob because `src`
 *             still holds non-executable scratch/spec files.
 * - `dom`   — React/DOM suites (`*.test.tsx`) rendered under jsdom with
 *             Testing Library. Needed for focus, capture events and
 *             requestAnimationFrame behaviour.
 */
const alias = {
  '@': path.resolve(__dirname, './src'),
  '@shared': path.resolve(__dirname, './shared'),
};

const nodeIncludes = [
  'src/utils/notificationGrouping.test.ts',
  'src/utils/notificationDestination.test.ts',
  'src/utils/notificationRealtime.test.ts',
  'src/utils/notificationPreferences.test.ts',
  'src/utils/notificationSections.test.ts',
  'src/utils/notificationThumbnail.test.ts',
  'src/utils/notificationFollowBack.test.ts',
  'src/utils/followEvents.test.ts',
  'src/utils/notificationBadge.test.ts',

  'src/utils/brandTextHelpers.test.ts',
  'src/utils/renderBranching.test.ts',
  'src/hooks/useMuxStatus.test.ts',
  'src/components/comments/useMentionAutocomplete.test.ts',
];

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: nodeIncludes,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'dom',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          // Explicit, like the node list: `src` still holds scratch spec files
          // (e.g. LightboxPreview.handoff.test.tsx) with no executable tests.
          include: [
            'src/contexts/ComposerFocusContext.test.tsx',
            'src/components/media/MuxOwnerHint.test.tsx',
          ],
        },
      },
    ],
  },
});
