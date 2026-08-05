import { describe, expect, it } from 'vitest';
import {
  FOLLOW_STATUS_CHANGED_EVENT,
  isFollowEventFor,
  isUniqueViolation,
  parseFollowStatusChanged,
} from './followEvents';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('parseFollowStatusChanged', () => {
  it('accepts a well-formed detail', () => {
    const event = new CustomEvent(FOLLOW_STATUS_CHANGED_EVENT, {
      detail: { follower: A, following: B, action: 'follow' },
    });
    expect(parseFollowStatusChanged(event)).toEqual({
      follower: A,
      following: B,
      action: 'follow',
    });
  });

  it('rejects a missing detail', () => {
    expect(parseFollowStatusChanged(new Event(FOLLOW_STATUS_CHANGED_EVENT))).toBeNull();
  });

  it('rejects an unknown action', () => {
    const event = new CustomEvent(FOLLOW_STATUS_CHANGED_EVENT, {
      detail: { follower: A, following: B, action: 'block' },
    });
    expect(parseFollowStatusChanged(event)).toBeNull();
  });

  it('rejects blank or non-string ids', () => {
    for (const detail of [
      { follower: '', following: B, action: 'follow' },
      { follower: A, following: null, action: 'follow' },
      { follower: 1, following: B, action: 'unfollow' },
    ]) {
      const event = new CustomEvent(FOLLOW_STATUS_CHANGED_EVENT, { detail });
      expect(parseFollowStatusChanged(event)).toBeNull();
    }
  });
});

describe('isFollowEventFor', () => {
  const detail = { follower: A, following: B, action: 'follow' } as const;

  it('matches when the viewer acted on the shown target', () => {
    expect(isFollowEventFor(detail, A, B)).toBe(true);
  });

  it('ignores events from another account', () => {
    expect(isFollowEventFor(detail, C, B)).toBe(false);
  });

  it('ignores events about another target', () => {
    expect(isFollowEventFor(detail, A, C)).toBe(false);
  });

  it('ignores missing ids', () => {
    expect(isFollowEventFor(detail, null, B)).toBe(false);
    expect(isFollowEventFor(detail, A, undefined)).toBe(false);
  });
});

describe('isUniqueViolation', () => {
  it('detects the follows duplicate-key code', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isUniqueViolation({ code: '42501' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });
});
