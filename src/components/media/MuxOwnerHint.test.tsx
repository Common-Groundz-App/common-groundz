/**
 * Phase 3C.2-lite — MuxOwnerHint "Edit post" CTA gating regression gate.
 *
 * Encoded as a vitest test for when the project adopts vitest. Until then,
 * this file serves as executable documentation of the three gating cases
 * for the failed-Mux Edit CTA. The gating logic is centralised in
 * canEditPost() — these cases pin the inputs we feed it from MuxOwnerHint.
 *
 * Cases:
 *   1. Owner + failed + within edit window → "Edit post" CTA renders.
 *   2. Owner + failed + expired window (non-admin) → CTA hidden; fallback
 *      copy "Please create a new post." shown.
 *   3. Non-owner → component returns null (existing owner gate regression).
 */
import { canEditPost, EDIT_WINDOW_MS } from '@/utils/postEditPolicy';

declare const describe: undefined | ((name: string, fn: () => void) => void);
declare const it: undefined | ((name: string, fn: () => void) => void);
declare const expect:
  | undefined
  | ((v: unknown) => { toBe: (v: unknown) => void });

const OWNER_ID = 'owner-uuid';
const OTHER_ID = 'other-uuid';

const recent = () => new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5m ago
const expired = () =>
  new Date(Date.now() - (EDIT_WINDOW_MS + 60 * 1000)).toISOString();

if (
  typeof describe === 'function' &&
  typeof it === 'function' &&
  typeof expect === 'function'
) {
  describe('MuxOwnerHint — failed-video Edit CTA gating', () => {
    it('owner + within edit window → CTA renders (canEdit=true)', () => {
      const canEdit = canEditPost(
        { user_id: OWNER_ID, created_at: recent(), last_edited_at: null },
        OWNER_ID,
        false,
      );
      expect(canEdit).toBe(true);
    });

    it('owner + expired window + non-admin → CTA hidden (canEdit=false)', () => {
      const canEdit = canEditPost(
        { user_id: OWNER_ID, created_at: expired(), last_edited_at: null },
        OWNER_ID,
        false,
      );
      expect(canEdit).toBe(false);
    });

    it('non-owner → CTA hidden (canEdit=false)', () => {
      const canEdit = canEditPost(
        { user_id: OWNER_ID, created_at: recent(), last_edited_at: null },
        OTHER_ID,
        false,
      );
      expect(canEdit).toBe(false);
    });

    it('admin bypasses edit window even when expired', () => {
      const canEdit = canEditPost(
        { user_id: OWNER_ID, created_at: expired(), last_edited_at: null },
        OTHER_ID,
        true,
      );
      expect(canEdit).toBe(true);
    });
  });
}

export {};
