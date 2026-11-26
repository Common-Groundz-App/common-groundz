import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

const calls: Array<[string, unknown[]]> = [];
let result: { data: unknown; error: unknown } = { data: [], error: null };
const builder: any = new Proxy({}, {
  get(_t, prop: string) {
    if (prop === 'then') return (res: any) => res(result);
    return (...args: unknown[]) => { calls.push([prop, args]); return builder; };
  },
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => builder } }));

import { fetchUserEntityReview } from '@/services/ownerPrivateReview';
import { isReviewVideoVisibilityLocked, reviewVideoErrorMessage } from '@/utils/reviewVideoErrors';

beforeEach(() => { calls.length = 0; });

describe('owner private review lookup', () => {
  it('asks only for the caller\'s private published review', async () => {
    result = { data: [], error: null };
    await fetchUserEntityReview('e1', 'u1');
    expect(calls).toContainEqual(['eq', ['user_id', 'u1']]);
    expect(calls).toContainEqual(['eq', ['visibility', 'private']]);
  });
  it('drops a row belonging to another account', async () => {
    result = { data: [{ id: 'r', user_id: 'u2', visibility: 'private' }], error: null };
    expect(await fetchUserEntityReview('e1', 'u1')).toBeNull();
  });
  it('drops a public row', async () => {
    result = { data: [{ id: 'r', user_id: 'u1', visibility: 'public' }], error: null };
    expect(await fetchUserEntityReview('e1', 'u1')).toBeNull();
  });
});

describe('video visibility lock message', () => {
  it('matches only the specific lock, not other 22023 errors', () => {
    expect(isReviewVideoVisibilityLocked({ message: 'review_video_visibility_locked', code: '22023' })).toBe(true);
    expect(isReviewVideoVisibilityLocked({ message: 'invalid_spoiler_flag', code: '22023' })).toBe(false);
  });
  it('never suggests deleting the review', () => {
    const m = reviewVideoErrorMessage({ message: 'review_video_visibility_locked' })!;
    expect(m).toContain('must remain public for now');
    expect(m.toLowerCase()).not.toContain('delete');
  });
});

describe('public-only reader queries', () => {
  const src = (p: string) => readFileSync(p, 'utf8');
  it('entity gallery filters reviews and timeline updates to public', () => {
    const s = src('src/services/photoService.ts');
    expect(s).toContain(".eq('visibility', 'public')");
    expect(s).toContain(".eq('reviews.visibility', 'public')");
  });
  it('entity Experiences filter both post queries to public', () => {
    expect(src('src/services/entityPostsService.ts').match(/\.eq\('visibility', 'public'\)/g)?.length).toBe(2);
  });
  it('Circle reviews are public only', () => {
    expect(src('src/hooks/useCircleReviews.ts')).toContain(".eq('visibility', 'public')");
  });
  it('entity reviews collection stays public only', () => {
    expect(src('src/services/entityService.ts')).toContain(".eq('visibility', 'public')");
  });
});
