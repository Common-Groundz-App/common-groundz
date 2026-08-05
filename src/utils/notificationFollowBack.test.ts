import { describe, expect, it } from 'vitest';
import {
  chunkFollowBackActorIds,
  collectFollowBackActorIds,
  getFollowBackActorId,
} from '@/utils/notificationFollowBack';
import type { NotificationGroup } from '@/utils/notificationGrouping';

const VIEWER = '11111111-1111-4111-8111-111111111111';
const ACTOR_A = '22222222-2222-4222-8222-222222222222';
const ACTOR_B = '33333333-3333-4333-8333-333333333333';

const group = (
  overrides: Partial<{
    type: string;
    entity_type: string | null;
    sender_id: string | null;
    aggregated: boolean;
  }> = {},
): NotificationGroup => {
  const rep = {
    id: 'n1',
    type: overrides.type ?? 'follow',
    entity_type: overrides.entity_type === undefined ? 'profile' : overrides.entity_type,
    sender_id: overrides.sender_id === undefined ? ACTOR_A : overrides.sender_id,
    created_at: new Date().toISOString(),
    is_read: false,
  } as any;
  const rows = overrides.aggregated ? [rep, { ...rep, id: 'n2', sender_id: ACTOR_B }] : [rep];
  return {
    key: 'k',
    representative: rep,
    notifications: rows,
    eventIds: rows.map((r: any) => r.id),
    unreadEventIds: rows.map((r: any) => r.id),
    actorIds: rows.map((r: any) => r.sender_id).filter(Boolean),
    isUnread: true,
    isAggregated: rows.length > 1,
  } as NotificationGroup;
};

describe('getFollowBackActorId', () => {
  it('returns the actor for a single follow row', () => {
    expect(getFollowBackActorId(group(), VIEWER)).toBe(ACTOR_A);
  });

  it('accepts a follow row with a missing entity_type', () => {
    expect(getFollowBackActorId(group({ entity_type: null }), VIEWER)).toBe(ACTOR_A);
  });

  it('rejects aggregated follow groups', () => {
    expect(getFollowBackActorId(group({ aggregated: true }), VIEWER)).toBeNull();
  });

  it('rejects non-follow types', () => {
    expect(getFollowBackActorId(group({ type: 'like', entity_type: 'post' }), VIEWER)).toBeNull();
    expect(getFollowBackActorId(group({ type: 'comment', entity_type: 'post' }), VIEWER)).toBeNull();
  });

  it('rejects a follow row pointing at non-profile content', () => {
    expect(getFollowBackActorId(group({ entity_type: 'post' }), VIEWER)).toBeNull();
  });

  it('rejects self-follow rows', () => {
    expect(getFollowBackActorId(group({ sender_id: VIEWER }), VIEWER)).toBeNull();
  });

  it('rejects missing or malformed actor ids', () => {
    expect(getFollowBackActorId(group({ sender_id: null }), VIEWER)).toBeNull();
    expect(getFollowBackActorId(group({ sender_id: 'system' }), VIEWER)).toBeNull();
  });

  it('rejects when there is no signed-in viewer', () => {
    expect(getFollowBackActorId(group(), null)).toBeNull();
    expect(getFollowBackActorId(group(), '')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(getFollowBackActorId(null, VIEWER)).toBeNull();
    expect(getFollowBackActorId(undefined, VIEWER)).toBeNull();
  });
});

describe('collectFollowBackActorIds', () => {
  it('returns distinct sorted ids and skips ineligible rows', () => {
    const ids = collectFollowBackActorIds(
      [
        group({ sender_id: ACTOR_B }),
        group({ sender_id: ACTOR_A }),
        group({ sender_id: ACTOR_A }),
        group({ type: 'like', entity_type: 'post' }),
        group({ aggregated: true }),
        null,
      ],
      VIEWER,
    );
    expect(ids).toEqual([ACTOR_A, ACTOR_B]);
  });

  it('returns nothing when signed out', () => {
    expect(collectFollowBackActorIds([group()], null)).toEqual([]);
  });
});

describe('chunkFollowBackActorIds', () => {
  it('bounds batch size', () => {
    const ids = Array.from({ length: 5 }, (_, i) => `id-${i}`);
    expect(chunkFollowBackActorIds(ids, 2)).toEqual([
      ['id-0', 'id-1'],
      ['id-2', 'id-3'],
      ['id-4'],
    ]);
  });

  it('handles an empty list and guards against a zero size', () => {
    expect(chunkFollowBackActorIds([], 200)).toEqual([]);
    expect(chunkFollowBackActorIds(['a', 'b'], 0)).toEqual([['a'], ['b']]);
  });
});
