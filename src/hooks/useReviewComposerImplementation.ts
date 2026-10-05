import { useAppConfig } from './useAppConfig';

/**
 * Step 3B (F6) — which review authoring implementation is active.
 *
 * The remote switch counts only after a successful, non-placeholder load;
 * loading or failure always returns the release default. No entry point reads
 * this in 3B — it only feeds the temporary direct-route gate.
 */
export type ReviewComposerImplementation = 'legacy' | 'page';

export const REVIEW_COMPOSER_RELEASE_DEFAULT: ReviewComposerImplementation = 'legacy';

export function resolveReviewComposerImplementation(input: {
  status: 'pending' | 'error' | 'success';
  isPlaceholderData: boolean;
  enabled: boolean | undefined;
}): ReviewComposerImplementation {
  if (input.status !== 'success' || input.isPlaceholderData) return REVIEW_COMPOSER_RELEASE_DEFAULT;
  return input.enabled === true ? 'page' : 'legacy';
}

export function useReviewComposerImplementation(): {
  implementation: ReviewComposerImplementation;
  isResolved: boolean;
} {
  const { data, status, isPlaceholderData } = useAppConfig();
  return {
    implementation: resolveReviewComposerImplementation({
      status,
      isPlaceholderData,
      enabled: data?.reviews?.composer_page_enabled,
    }),
    isResolved: status !== 'pending' && !isPlaceholderData,
  };
}
