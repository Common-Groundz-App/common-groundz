/** Server refused a photo that was already removed and is queued/being deleted (D2 guard). */
export function isMediaRetiredError(error: unknown): boolean {
  const e = error as { message?: unknown } | null;
  return typeof e?.message === 'string' && e.message.includes('MEDIA_PATH_RETIRED');
}
