export type Outcome = 'deleted' | 'not_found' | 'retryable' | 'failed'

/** null = network failure / timeout. */
export function classifyDelete(status: number | null): Outcome {
  if (status === 200 || status === 204) return 'deleted'
  if (status === 404) return 'not_found'
  if (status === null || status === 429 || status >= 500) return 'retryable'
  return 'failed'
}
