/**
 * Converts a URL slug into a human-readable name.
 * e.g. "23rd-street-pizza" → "23rd Street Pizza"
 */
export function formatSlugAsName(slug: string): string {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }
  return decoded
    .replace(/[-_]/g, ' ')
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
