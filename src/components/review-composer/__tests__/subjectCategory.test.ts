import { describe, expect, it } from 'vitest';
import { toSubject } from '../screen/loaders';

describe('subject category context (Phase 5B)', () => {
  const row = { id: 'e1', name: 'X', type: 'event' } as never;
  it('carries category_id when present', () => {
    expect(toSubject({ ...(row as object), category_id: 'c1' } as never, null).categoryId).toBe('c1');
  });
  it('is null when the entity has no category, so switching never keeps a stale one', () => {
    expect(toSubject(row, null).categoryId).toBeNull();
  });
});
