import { describe, expect, it } from 'vitest';
import { ENTRY_BADGE_CAP, formatUnreadBadge } from './notificationBadge';

describe('formatUnreadBadge', () => {
  it('renders nothing when the count is unresolved', () => {
    expect(formatUnreadBadge(null)).toBeNull();
    expect(formatUnreadBadge(undefined)).toBeNull();
  });

  it('renders nothing for zero or negative counts', () => {
    expect(formatUnreadBadge(0)).toBeNull();
    expect(formatUnreadBadge(-5)).toBeNull();
  });

  it('renders exact counts up to the cap', () => {
    expect(formatUnreadBadge(1)).toBe('1');
    expect(formatUnreadBadge(9)).toBe('9');
  });

  it('caps everything above the cap', () => {
    expect(formatUnreadBadge(10)).toBe('9+');
    expect(formatUnreadBadge(29)).toBe('9+');
    expect(formatUnreadBadge(150)).toBe('9+');
  });

  it('guards non-finite values', () => {
    expect(formatUnreadBadge(Number.NaN)).toBeNull();
    expect(formatUnreadBadge(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('floors fractional counts', () => {
    expect(formatUnreadBadge(3.7)).toBe('3');
  });

  it('supports an explicit cap for reuse', () => {
    expect(formatUnreadBadge(29, 99)).toBe('29');
    expect(formatUnreadBadge(150, 99)).toBe('99+');
  });

  it('defaults to a cap of 9', () => {
    expect(ENTRY_BADGE_CAP).toBe(9);
  });
});
