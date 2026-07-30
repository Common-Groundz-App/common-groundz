/**
 * Grouping matrix: adjacency, the 24h window, eligibility fencing and the
 * count invariants that pagination/badges depend on.
 *
 * Vitest-compatible structure; harmless no-op if vitest is absent at import
 * time (project convention — see notificationDestination.test.ts).
 */
import type { Notification } from '@/services/notificationService';
import {
  GROUP_WINDOW_MS,
  formatGroupSummary,
  groupNotifications,
  isGroupableNotification,
} from './notificationGrouping';

const POST_A = '11111111-1111-4111-8111-111111111111';
const POST_B = '22222222-2222-4222-8222-222222222222';
const COMMENT_ID = '33333333-3333-4333-8333-333333333333';

const BASE = Date.parse('2026-01-10T12:00:00.000Z');
const at = (msAgo: number) => new Date(BASE - msAgo).toISOString();

let seq = 0;
const row = (over: Partial<Notification> = {}): Notification =>
  ({
    id: `n${++seq}`,
    user_id: 'u1',
    type: 'like',
    sender_id: `s${seq}`,
    title: 'Someone liked your post',
    message: 'My post',
    entity_type: 'post',
    entity_id: POST_A,
    is_read: false,
    action_url: null,
    created_at: at(0),
    updated_at: at(0),
    ...over,
  }) as Notification;

declare const describe: undefined | ((name: string, fn: () => void) => void);
declare const it: undefined | ((name: string, fn: () => void) => void);
declare const expect:
  | undefined
  | ((v: unknown) => {
      toEqual: (v: unknown) => void;
      toBe: (v: unknown) => void;
      toBeNull: () => void;
    });

if (typeof describe === 'function' && typeof it === 'function' && typeof expect === 'function') {
  describe('isGroupableNotification — eligibility fence', () => {
    it('accepts a top-level post like', () => {
      expect(isGroupableNotification(row())).toBe(true);
    });
    it('accepts a recommendation like', () => {
      expect(isGroupableNotification(row({ entity_type: 'recommendation' }))).toBe(true);
    });
    it('rejects comment likes (they have a distinct destination)', () => {
      expect(isGroupableNotification(row({ metadata: { comment_id: COMMENT_ID } }))).toBe(false);
    });
    it('rejects comments', () => {
      expect(isGroupableNotification(row({ type: 'comment' }))).toBe(false);
    });
    it('rejects follows', () => {
      expect(isGroupableNotification(row({ type: 'follow', entity_type: 'profile' }))).toBe(false);
    });
    it('rejects malformed entity ids', () => {
      expect(isGroupableNotification(row({ entity_id: 'not-a-uuid' }))).toBe(false);
    });
  });

  describe('groupNotifications — adjacency and windowing', () => {
    it('collapses adjacent same-target likes', () => {
      const rows = [row(), row(), row()];
      const groups = groupNotifications(rows);
      expect(groups.length).toBe(1);
      expect(groups[0].eventIds).toEqual(rows.map((r) => r.id));
      expect(groups[0].isAggregated).toBe(true);
    });

    it('never reorders: a non-groupable row breaks the run', () => {
      const a = row();
      const follow = row({ type: 'follow', entity_type: 'profile' });
      const b = row();
      const groups = groupNotifications([a, follow, b]);
      expect(groups.map((g) => g.eventIds)).toEqual([[a.id], [follow.id], [b.id]]);
    });

    it('does not merge different targets', () => {
      const a = row();
      const b = row({ entity_id: POST_B });
      expect(groupNotifications([a, b]).length).toBe(2);
    });

    it('breaks the run outside the 24h window', () => {
      const a = row({ created_at: at(0) });
      const b = row({ created_at: at(GROUP_WINDOW_MS + 1000) });
      expect(groupNotifications([a, b]).length).toBe(2);
    });

    it('anchors the window on the newest child (no transitive chaining)', () => {
      const a = row({ created_at: at(0) });
      const b = row({ created_at: at(GROUP_WINDOW_MS - 1000) });
      const c = row({ created_at: at(GROUP_WINDOW_MS + 60_000) });
      const groups = groupNotifications([a, b, c]);
      expect(groups.length).toBe(2);
      expect(groups[0].eventIds).toEqual([a.id, b.id]);
      expect(groups[1].eventIds).toEqual([c.id]);
    });

    it('never aggregates rows with unparseable timestamps', () => {
      const a = row({ created_at: 'nonsense' });
      const b = row({ created_at: 'nonsense' });
      expect(groupNotifications([a, b]).length).toBe(2);
    });
  });

  describe('groupNotifications — count invariants', () => {
    it('preserves the total EVENT count across groups', () => {
      const rows = [row(), row(), row({ entity_id: POST_B }), row({ type: 'comment' })];
      const groups = groupNotifications(rows);
      const total = groups.reduce((sum, g) => sum + g.eventIds.length, 0);
      expect(total).toBe(rows.length);
    });

    it('preserves the unread EVENT count across groups', () => {
      const rows = [row(), row({ is_read: true }), row()];
      const groups = groupNotifications(rows);
      const unread = groups.reduce((sum, g) => sum + g.unreadEventIds.length, 0);
      expect(unread).toBe(2);
    });

    it('marks a group unread when any child is unread', () => {
      const groups = groupNotifications([row({ is_read: true }), row()]);
      expect(groups[0].isUnread).toBe(true);
    });

    it('representative is the newest child', () => {
      const a = row();
      const b = row();
      expect(groupNotifications([a, b])[0].representative.id).toBe(a.id);
    });
  });

  describe('formatGroupPrimary — event-aware, name-aware copy', () => {
    it('uses the sentence (message) for singleton likes', () => {
      const g = groupNotifications([row({ message: 'linda liked your post' })])[0];
      expect(formatGroupPrimary(g)).toBe('linda liked your post');
    });

    it('uses the title for mentions (title carries the sentence there)', () => {
      const g = groupNotifications([
        row({ type: 'comment', title: 'linda mentioned you', message: 'hey @me', metadata: { event: 'mention' } }),
      ])[0];
      expect(formatGroupPrimary(g)).toBe('linda mentioned you');
      expect(getPreviewLine(g.representative)).toBe('hey @me');
    });

    it('falls back to the single sentence when all events share one actor', () => {
      const groups = groupNotifications([
        row({ sender_id: 'same', message: 'linda liked your post' }),
        row({ sender_id: 'same', message: 'linda liked your post' }),
      ]);
      expect(formatGroupPrimary(groups[0])).toBe('linda liked your post');
    });

    it('names two actors when both resolve', () => {
      const groups = groupNotifications([row(), row()]);
      expect(formatGroupPrimary(groups[0], ['linda', 'hana'])).toBe('linda and hana liked your post');
    });

    it('adds the others remainder against distinct actors', () => {
      const groups = groupNotifications([row(), row(), row(), row(), row()]);
      expect(formatGroupPrimary(groups[0], ['linda', 'hana'])).toBe(
        'linda, hana and 3 others liked your post'
      );
    });

    it('singularises one other with a single resolved name', () => {
      const groups = groupNotifications([row(), row()]);
      expect(formatGroupPrimary(groups[0], ['linda'])).toBe('linda and 1 other liked your post');
    });

    it('degrades to a countable sentence when no name resolves', () => {
      const groups = groupNotifications([row(), row(), row()]);
      expect(formatGroupPrimary(groups[0], [])).toBe('3 people liked your post');
    });

    it('uses the recommendation noun', () => {
      const groups = groupNotifications([
        row({ entity_type: 'recommendation', entity_id: POST_B }),
        row({ entity_type: 'recommendation', entity_id: POST_B }),
      ]);
      expect(formatGroupPrimary(groups[0], ['linda', 'hana'])).toBe(
        'linda and hana liked your recommendation'
      );
    });
  });

}
