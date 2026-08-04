import { describe, expect, it } from 'vitest';
import {
  msUntilNextLocalMidnight,
  partitionIntoSections,
  sectionLabelFor,
} from './notificationSections';
import type { NotificationGroup } from './notificationGrouping';

/**
 * All fixtures build timestamps from LOCAL calendar constructors so the suite is
 * timezone-independent, and every case injects `now` — nothing here reads the
 * real clock.
 */

let seq = 0;
function group(createdAt: string | null): NotificationGroup {
  seq += 1;
  return {
    key: `g${seq}`,
    representative: { created_at: createdAt },
  } as unknown as NotificationGroup;
}

/** Local Date -> the ISO string the database would return. */
function iso(d: Date): string {
  return d.toISOString();
}

function local(
  y: number,
  m: number,
  d: number,
  h = 12,
  min = 0,
  s = 0
): Date {
  return new Date(y, m, d, h, min, s);
}

describe('sectionLabelFor', () => {
  // Wednesday 2026-08-05, midday.
  const now = local(2026, 7, 5, 12, 0, 0);

  it('labels the current local calendar day Today', () => {
    expect(sectionLabelFor(iso(local(2026, 7, 5, 0, 0, 1)), now)).toBe('Today');
    expect(sectionLabelFor(iso(local(2026, 7, 5, 11, 59, 59)), now)).toBe('Today');
  });

  it('splits at local midnight', () => {
    expect(sectionLabelFor(iso(local(2026, 7, 4, 23, 59, 59)), now)).toBe('Yesterday');
    expect(sectionLabelFor(iso(local(2026, 7, 5, 0, 0, 0)), now)).toBe('Today');
  });

  it('treats the rest of the Monday-started week as This week', () => {
    // Monday 2026-08-03 is the week start; Tue 04 is Yesterday, Mon 03 is This week.
    expect(sectionLabelFor(iso(local(2026, 7, 3, 9, 0, 0)), now)).toBe('This week');
  });

  it('does not put the previous Sunday in This week', () => {
    // Monday 2026-08-03 as `now`: Sunday 02 is Yesterday, Saturday 01 is This month.
    const monday = local(2026, 7, 3, 9, 0, 0);
    expect(sectionLabelFor(iso(local(2026, 7, 2, 20, 0, 0)), monday)).toBe('Yesterday');
    expect(sectionLabelFor(iso(local(2026, 7, 1, 20, 0, 0)), monday)).toBe('This month');
  });

  it('respects the calendar month boundary', () => {
    expect(sectionLabelFor(iso(local(2026, 7, 1, 0, 30, 0)), now)).toBe('This month');
    expect(sectionLabelFor(iso(local(2026, 6, 31, 23, 30, 0)), now)).toBe('Earlier');
  });

  it('treats small clock skew as Today but far-future as Earlier', () => {
    expect(sectionLabelFor(iso(local(2026, 7, 5, 12, 3, 0)), now)).toBe('Today');
    expect(sectionLabelFor(iso(local(2027, 8, 5, 12, 0, 0)), now)).toBe('Earlier');
  });

  it('never throws on malformed input', () => {
    expect(sectionLabelFor(null, now)).toBe('Earlier');
    expect(sectionLabelFor(undefined, now)).toBe('Earlier');
    expect(sectionLabelFor('not-a-date', now)).toBe('Earlier');
  });
});

describe('partitionIntoSections', () => {
  const now = local(2026, 7, 5, 12, 0, 0);

  it('returns an empty array for no groups', () => {
    expect(partitionIntoSections([], now)).toEqual([]);
    expect(partitionIntoSections(undefined as never, now)).toEqual([]);
  });

  it('emits sections in fixed order and omits empty ones', () => {
    const sections = partitionIntoSections(
      [
        group(iso(local(2026, 5, 1, 12, 0, 0))), // Earlier
        group(iso(local(2026, 7, 5, 10, 0, 0))), // Today
        group(iso(local(2026, 7, 4, 10, 0, 0))), // Yesterday
      ],
      now
    );

    expect(sections.map((s) => s.label)).toEqual(['Today', 'Yesterday', 'Earlier']);
  });

  it('preserves incoming order inside a section', () => {
    const a = group(iso(local(2026, 7, 5, 10, 0, 0)));
    const b = group(iso(local(2026, 7, 5, 9, 0, 0)));
    const c = group(iso(local(2026, 7, 5, 11, 0, 0)));

    const [today] = partitionIntoSections([a, b, c], now);
    expect(today.groups.map((g) => g.key)).toEqual([a.key, b.key, c.key]);
  });

  it('never drops a group, including malformed timestamps', () => {
    const input = [
      group(iso(local(2026, 7, 5, 10, 0, 0))),
      group(null),
      group('garbage'),
      group(iso(local(2020, 0, 1, 10, 0, 0))),
    ];
    const total = partitionIntoSections(input, now).reduce(
      (n, s) => n + s.groups.length,
      0
    );
    expect(total).toBe(input.length);
  });

  it('sections a group by its representative (newest) timestamp', () => {
    // Representative is just after midnight; an older child would have landed
    // in Yesterday, the representative keeps the row in Today.
    const straddling = group(iso(local(2026, 7, 5, 0, 5, 0)));
    const sections = partitionIntoSections([straddling], now);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('Today');
  });
});

describe('msUntilNextLocalMidnight', () => {
  it('is always positive and lands after the next local midnight', () => {
    const now = local(2026, 7, 5, 23, 59, 30);
    const ms = msUntilNextLocalMidnight(now);
    expect(ms).toBeGreaterThan(0);
    const fired = new Date(now.getTime() + ms);
    expect(fired.getDate()).toBe(6);
  });

  it('never returns a zero or negative delay at exact midnight', () => {
    expect(msUntilNextLocalMidnight(local(2026, 7, 5, 0, 0, 0))).toBeGreaterThanOrEqual(1000);
  });
});
