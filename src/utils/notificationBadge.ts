/**
 * Shared formatting for compact unread notification badges.
 *
 * Every entry point (bells, sidebar, bottom nav) uses the same cap so the same
 * unread state never reads as two different numbers across the app. The badge is
 * an attention indicator, not an analytics counter — the exact number lives
 * inside the notification drawer.
 */

/** Highest number rendered literally on a compact entry-point badge. */
export const ENTRY_BADGE_CAP = 9;

/**
 * Returns the badge label, or `null` when nothing should render.
 *
 * - `null` / `undefined` (count not resolved yet) → null
 * - `0` or negative → null
 * - `1..cap` → exact number
 * - `> cap` → `"{cap}+"`
 */
export function formatUnreadBadge(
  count: number | null | undefined,
  cap: number = ENTRY_BADGE_CAP,
): string | null {
  if (count === null || count === undefined) return null;
  if (typeof count !== 'number' || !Number.isFinite(count)) return null;

  const normalized = Math.floor(count);
  if (normalized <= 0) return null;
  if (normalized > cap) return `${cap}+`;

  return String(normalized);
}
