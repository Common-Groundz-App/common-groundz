import { describe, it, expect } from 'vitest';
import {
  canEditReview,
  canEditTimelineUpdate,
  isEditWindowClosedError,
  isWithinEditWindow,
} from '../reviewEditPolicy';

const T0 = Date.parse('2026-10-03T10:00:00Z');
const at = (ms: number) => T0 + ms;
const MIN = 60 * 1000;
const created = new Date(T0).toISOString();

describe('review edit window', () => {
  it('open at 59:59, closed at exactly 60:00', () => {
    expect(isWithinEditWindow(created, at(60 * MIN - 1000))).toBe(true);
    expect(isWithinEditWindow(created, at(60 * MIN))).toBe(false);
  });

  it('owner only; admin bypasses', () => {
    const r = { user_id: 'u1', created_at: created };
    expect(canEditReview(r, 'u1', false, at(10 * MIN))).toBe(true);
    expect(canEditReview(r, 'u2', false, at(10 * MIN))).toBe(false);
    expect(canEditReview(r, 'u1', false, at(61 * MIN))).toBe(false);
    expect(canEditReview(r, 'u2', true, at(61 * MIN))).toBe(true);
    expect(canEditReview(r, 'u1', true, at(60 * MIN))).toBe(true);
  });

  it('timeline update: latest only, owner only, within its hour', () => {
    const u = { user_id: 'u1', created_at: created };
    expect(canEditTimelineUpdate(u, 'u1', true, at(5 * MIN))).toBe(true);
    expect(canEditTimelineUpdate(u, 'u1', false, at(5 * MIN))).toBe(false);
    expect(canEditTimelineUpdate(u, 'u2', true, at(5 * MIN))).toBe(false);
    expect(canEditTimelineUpdate(u, 'u1', true, at(60 * MIN))).toBe(false);
    expect(canEditTimelineUpdate(u, 'u1', false, at(60 * MIN - 1000))).toBe(false);
  });

  it('recognises the server window error', () => {
    expect(isEditWindowClosedError({ message: 'review_edit_window_closed' })).toBe(true);
    expect(isEditWindowClosedError(new Error('other'))).toBe(false);
  });
});
