import type { NotificationGroup } from './notificationGrouping';

/**
 * Date sectioning for the notification drawer.
 *
 * Pure, render-only layer: it partitions the ALREADY-GROUPED array into labelled
 * buckets and never fetches, sorts, filters or mutates anything. `now` is always
 * injected so the behaviour is deterministic under test — this module must never
 * read the ambient clock.
 *
 * Sectioning uses each group's REPRESENTATIVE timestamp (`representative.created_at`),
 * which is exactly the timestamp the row already renders. Using anything else
 * (e.g. the oldest child of a group) would let a header say "This week" above a
 * row that reads "2 hours ago".
 */

export type NotificationSectionLabel =
  | 'Today'
  | 'Yesterday'
  | 'This week'
  | 'This month'
  | 'Earlier';

export interface NotificationSection {
  label: NotificationSectionLabel;
  groups: NotificationGroup[];
}

/** Fixed render order. Empty buckets are dropped, never rendered. */
const SECTION_ORDER: NotificationSectionLabel[] = [
  'Today',
  'Yesterday',
  'This week',
  'This month',
  'Earlier',
];

/**
 * Ordinary client/server clock skew is seconds-to-minutes. Anything inside this
 * window that reads as "future" is treated as Today. Anything beyond it is
 * malformed data — it goes to `Earlier` rather than being labelled Today, and is
 * never dropped.
 */
const FUTURE_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/** Local midnight of the calendar day containing `d`. */
function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local midnight of the Monday that begins the calendar week containing `d`. */
function startOfLocalWeekMonday(d: Date): number {
  const dayOfWeek = d.getDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - daysSinceMonday
  ).getTime();
}

/** Local midnight of the 1st of the calendar month containing `d`. */
function startOfLocalMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/**
 * Classify a single timestamp. Exported for direct unit testing.
 *
 * Unparseable and missing timestamps resolve to `Earlier` so the row still
 * renders — dropping a notification is always worse than mis-labelling it.
 */
export function sectionLabelFor(
  createdAt: string | null | undefined,
  now: Date
): NotificationSectionLabel {
  if (!createdAt) return 'Earlier';
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 'Earlier';

  const nowMs = now.getTime();

  if (t > nowMs + FUTURE_SKEW_TOLERANCE_MS) return 'Earlier';
  // Within the skew window (including slightly-future) — the current day.
  if (t >= startOfLocalDay(now)) return 'Today';

  const yesterdayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1
  ).getTime();
  if (t >= yesterdayStart) return 'Yesterday';

  if (t >= startOfLocalWeekMonday(now)) return 'This week';
  if (t >= startOfLocalMonth(now)) return 'This month';
  return 'Earlier';
}

/**
 * Partition groups into ordered, non-empty sections.
 *
 * Guarantees relied on by the drawer and asserted in tests:
 *  - order within a section is exactly the incoming order (this never sorts)
 *  - total groups out === total groups in (nothing is ever dropped)
 *  - empty sections are omitted
 */
export function partitionIntoSections(
  groups: NotificationGroup[],
  now: Date
): NotificationSection[] {
  if (!groups || groups.length === 0) return [];

  const buckets = new Map<NotificationSectionLabel, NotificationGroup[]>();

  for (const group of groups) {
    const label = sectionLabelFor(group.representative?.created_at, now);
    const bucket = buckets.get(label);
    if (bucket) bucket.push(group);
    else buckets.set(label, [group]);
  }

  return SECTION_ORDER.filter((label) => (buckets.get(label)?.length ?? 0) > 0).map(
    (label) => ({ label, groups: buckets.get(label)! })
  );
}

/**
 * Milliseconds until the next local midnight (plus a second of slack so the
 * timer never fires a hair early and recomputes the same day).
 *
 * Used by the drawer to advance its `now` while it stays open across midnight —
 * a pure function cannot re-label anything on its own.
 */
export function msUntilNextLocalMidnight(now: Date): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  ).getTime();
  return Math.max(1000, nextMidnight - now.getTime() + 1000);
}
