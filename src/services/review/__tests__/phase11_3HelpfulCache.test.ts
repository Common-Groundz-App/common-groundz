import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeHelpfulSnapshot, helpfulQueryKey } from '../helpfulCache';
import { fetchUserReviews } from '../fetch';
import { fetchUserReviews as fetchProfileReviews } from '@/services/reviewService';

const db = vi.hoisted(() => ({ rpc: vi.fn(), rows: [] as any[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: (...args: unknown[]) => db.rpc(...args),
  from: () => { const query: any = { select: () => query, eq: () => query, order: async () => ({ data: db.rows, error: null }) }; return query; },
} }));
vi.mock('@/services/enhancedUnifiedProfileService', () => ({ attachProfilesToEntities: async (rows: any[]) => rows.map(r => ({ ...r, user: { displayName: 'Author', avatar_url: null } })) }));

describe('Phase 11.3 guest counts and viewer-scoped cache assignments', () => {
  beforeEach(() => { db.rpc.mockReset(); db.rows = [{ id: 'root', user_id: 'author', visibility: 'public' }]; });
  it.each([fetchUserReviews, fetchProfileReviews])('guests get real public aggregates without calling viewer-state RPC', async fetch => {
    db.rpc.mockResolvedValue({ data: [{ review_id: 'root', like_count: 12 }], error: null });
    const rows = await fetch(null, 'author');
    expect(rows[0].likes).toBe(12);
    expect(rows[0].isLiked).toBe(false);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('get_review_likes_batch', { p_review_ids: ['root'] });
  });
  it('signed-in viewers use aggregate and their own vote RPC only', async () => {
    db.rpc.mockImplementation(async (name: string) => ({ data: name === 'get_review_likes_batch' ? [{ review_id: 'root', like_count: 3 }] : [{ review_id: 'root' }], error: null }));
    const rows = await fetchUserReviews('viewer', 'author');
    expect(rows[0].likes).toBe(3);
    expect(rows[0].isLiked).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith('get_user_review_likes', { p_review_ids: ['root'] });
  });
  it('one assigned snapshot updates matching Entity/Profile partitions but never guests, another viewer or Private rows', () => {
    const client = new QueryClient();
    const publicRow = { id: 'root', visibility: 'public', likes: 3, isLiked: false };
    for (const viewer of ['viewer', 'other', 'guest']) {
      client.setQueryData(['reviews', 'author', viewer], [publicRow]);
      client.setQueryData(['entity-detail', 'slug', viewer], { reviews: [publicRow] });
    }
    client.setQueryData(['reviews', 'private-author', 'viewer'], [{ ...publicRow, visibility: 'private' }]);
    writeHelpfulSnapshot(client, 'root', 'viewer', { likes: 4, isLiked: true });
    writeHelpfulSnapshot(client, 'root', 'viewer', { likes: 4, isLiked: true });
    expect(client.getQueryData<any>(helpfulQueryKey('root', 'viewer'))).toEqual({ likes: 4, isLiked: true });
    expect(client.getQueryData<any>(['reviews', 'author', 'viewer'])[0].likes).toBe(4);
    expect(client.getQueryData<any>(['entity-detail', 'slug', 'viewer']).reviews[0].isLiked).toBe(true);
    for (const viewer of ['other', 'guest']) expect(client.getQueryData<any>(['reviews', 'author', viewer])[0]).toEqual(publicRow);
    expect(client.getQueryData<any>(['reviews', 'private-author', 'viewer'])[0].likes).toBe(3);
  });
});