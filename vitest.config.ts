import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Kept in a dedicated file (not merged into vite.config.ts) so the `test` key
 * can never be silently dropped by Vite's own config typing — a missing runner
 * config is exactly how the notification suites previously "passed" without
 * executing a single assertion.
 *
 * Every suite listed below is pure TypeScript: no DOM, no React rendering, no
 * Supabase client. That is why there is no jsdom / testing-library dependency.
 *
 * The include list is explicit rather than a broad `src/**\/*.test.ts` glob
 * because `src` still holds non-executable scratch/spec files that would break
 * a wildcard run. Broaden this to the glob once those are cleaned up.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/utils/notificationGrouping.test.ts',
      'src/utils/notificationDestination.test.ts',
      'src/utils/notificationRealtime.test.ts',
      'src/utils/brandTextHelpers.test.ts',
      'src/utils/renderBranching.test.ts',
      'src/hooks/useMuxStatus.test.ts',
      'src/components/comments/useMentionAutocomplete.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
