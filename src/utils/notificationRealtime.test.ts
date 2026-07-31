import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateRealtimePayload,
  classifyInsert,
  mergeRealtimeRow,
  applyRealtimeUpdate,
  createTrailingScheduler,
} from './notificationRealtime';
import { rowCursorKey, type Notification } from '@/services/notificationService';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const rawRow = (overrides: Record<string, unknown> = {}) => ({
  id: '33333333-3333-4333-8333-333333333333',
  user_id: USER,
  type: 'like',
  sender_id: OTHER,
  title: 'New like',
  message: 'someone liked your post',
  entity_type: 'post',
  entity_id: '44444444-4444-4444-8444-444444444444',
  is_read: false,
  image_url: null,
  action_url: null,
  created_at: '2026-07-31T10:00:00.123456+00:00',
  updated_at: '2026-07-31T10:00:00.123456+00:00',
  metadata: { comment_id: null },
  ...overrides,
});

const row = (id: string, createdAt: string, extra: Partial<Notification> = {}): Notification => ({
  id,
  user_id: USER,
  type: 'like',
  title: 'New like',
  message: 'someone liked your post',
  is_read: false,
  image_url: null,
  action_url: null,
  created_at: createdAt,
  updated_at: createdAt,
  ...extra,
});

describe('validateRealtimePayload', () => {
  it('accepts a well-formed row for the expected user', () => {
    const result = validateRealtimePayload(rawRow(), USER);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(result!.type).toBe('like');
    expect(result!.is_read).toBe(false);
  });

  it('normalizes nullable columns to undefined/null consistently', () => {
    const result = validateRealtimePayload(
      rawRow({ sender_id: null, entity_type: null, entity_id: null, metadata: null }),
      USER
    );
    expect(result).not.toBeNull();
    expect(result!.sender_id).toBeUndefined();
    expect(result!.entity_type).toBeUndefined();
    expect(result!.entity_id).toBeUndefined();
    expect(result!.metadata).toBeUndefined();
    expect(result!.image_url).toBeNull();
  });

  it('rejects rows belonging to another user', () => {
    expect(validateRealtimePayload(rawRow({ user_id: OTHER }), USER)).toBeNull();
  });

  it('rejects a non-uuid expected user id', () => {
    expect(validateRealtimePayload(rawRow(), 'not-a-uuid')).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(validateRealtimePayload(null, USER)).toBeNull();
    expect(validateRealtimePayload(undefined, USER)).toBeNull();
    expect(validateRealtimePayload('row', USER)).toBeNull();
    expect(validateRealtimePayload([rawRow()], USER)).toBeNull();
  });

  it('rejects unknown notification and entity types', () => {
    expect(validateRealtimePayload(rawRow({ type: 'poke' }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ entity_type: 'planet' }), USER)).toBeNull();
  });

  it('rejects malformed ids and wrong primitive types', () => {
    expect(validateRealtimePayload(rawRow({ id: 'abc' }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ sender_id: 'abc' }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ entity_id: 'abc' }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ title: 12 }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ message: null }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ is_read: 'false' }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ image_url: 5 }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ metadata: [] }), USER)).toBeNull();
  });

  it('rejects unkeyable timestamps rather than letting them reach state', () => {
    expect(validateRealtimePayload(rawRow({ created_at: 'yesterday' }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ created_at: null }), USER)).toBeNull();
    expect(validateRealtimePayload(rawRow({ updated_at: 42 }), USER)).toBeNull();
  });
});

describe('classifyInsert', () => {
  const boundary = rowCursorKey(row('x', '2026-07-31T09:00:00.000000+00:00'));

  it('merges anything once the lane has reached the end of the list', () => {
    const older = row('a', '2020-01-01T00:00:00.000000+00:00');
    expect(classifyInsert(older, boundary, false)).toBe('merge');
    expect(classifyInsert(older, null, false)).toBe('merge');
  });

  it('treats rows as out-of-window when nothing has been fetched yet', () => {
    expect(classifyInsert(row('a', '2026-07-31T10:00:00Z'), null, true)).toBe('out-of-window');
  });

  it('merges rows newer than the server cursor', () => {
    expect(classifyInsert(row('a', '2026-07-31T10:00:00Z'), boundary, true)).toBe('merge');
  });

  it('merges a row exactly at the server cursor boundary', () => {
    expect(
      classifyInsert(row('a', '2026-07-31T09:00:00.000000+00:00'), boundary, true)
    ).toBe('merge');
  });

  it('leaves rows older than the server cursor to pagination', () => {
    expect(classifyInsert(row('a', '2026-07-31T08:59:59Z'), boundary, true)).toBe(
      'out-of-window'
    );
  });

  it('compares at sub-millisecond precision', () => {
    const micro = rowCursorKey(row('x', '2026-07-31T09:00:00.000002+00:00'));
    expect(
      classifyInsert(row('a', '2026-07-31T09:00:00.000001+00:00'), micro, true)
    ).toBe('out-of-window');
    expect(
      classifyInsert(row('a', '2026-07-31T09:00:00.000003+00:00'), micro, true)
    ).toBe('merge');
  });

  it('normalizes offsets before comparing', () => {
    // 14:30+05:30 === 09:00Z, i.e. exactly the boundary.
    expect(
      classifyInsert(row('a', '2026-07-31T14:30:00.000000+05:30'), boundary, true)
    ).toBe('merge');
  });
});

describe('mergeRealtimeRow', () => {
  it('inserts in created_at DESC order', () => {
    const rows = [
      row('b', '2026-07-31T10:00:00Z'),
      row('a', '2026-07-31T08:00:00Z'),
    ];
    const merged = mergeRealtimeRow(rows, row('c', '2026-07-31T09:00:00Z'));
    expect(merged.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('is idempotent for a duplicate delivery', () => {
    const rows = [row('b', '2026-07-31T10:00:00Z')];
    const once = mergeRealtimeRow(rows, row('c', '2026-07-31T09:00:00Z'));
    const twice = mergeRealtimeRow(once, row('c', '2026-07-31T09:00:00Z'));
    expect(twice.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('never resurrects a locally-read row as unread', () => {
    const rows = [row('b', '2026-07-31T10:00:00Z', { is_read: true })];
    const merged = mergeRealtimeRow(rows, row('b', '2026-07-31T10:00:00Z', { is_read: false }));
    expect(merged[0].is_read).toBe(true);
  });
});

describe('applyRealtimeUpdate', () => {
  it('updates an already-loaded row', () => {
    const rows = [row('b', '2026-07-31T10:00:00Z')];
    const updated = applyRealtimeUpdate(rows, row('b', '2026-07-31T10:00:00Z', { is_read: true }));
    expect(updated[0].is_read).toBe(true);
  });

  it('drops updates for rows that were never loaded', () => {
    const rows = [row('b', '2026-07-31T10:00:00Z')];
    const updated = applyRealtimeUpdate(rows, row('zzz', '2026-07-31T11:00:00Z'));
    expect(updated).toBe(rows);
  });
});

describe('createTrailingScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('collapses a burst into exactly one trailing run', () => {
    const run = vi.fn();
    const scheduler = createTrailingScheduler(run, 250);

    for (let i = 0; i < 20; i += 1) {
      scheduler.schedule();
      vi.advanceTimersByTime(10);
    }
    expect(run).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs again for a burst that arrives after the window closed', () => {
    const run = vi.fn();
    const scheduler = createTrailingScheduler(run, 250);

    scheduler.schedule();
    vi.advanceTimersByTime(250);
    scheduler.schedule();
    vi.advanceTimersByTime(250);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('cancel drops the pending run', () => {
    const run = vi.fn();
    const scheduler = createTrailingScheduler(run, 250);

    scheduler.schedule();
    expect(scheduler.isPending()).toBe(true);
    scheduler.cancel();
    expect(scheduler.isPending()).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
  });

  it('flush runs immediately, and is a no-op when nothing is pending', () => {
    const run = vi.fn();
    const scheduler = createTrailingScheduler(run, 250);

    scheduler.flush();
    expect(run).not.toHaveBeenCalled();

    scheduler.schedule();
    scheduler.flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.isPending()).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
