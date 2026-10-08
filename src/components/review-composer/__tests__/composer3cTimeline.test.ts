import { describe, expect, it, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const chain: any = {};
let updateRow: any = null;
let latestRow: any = null;
let selectError: any = null;
chain.select = () => chain;
chain.eq = () => chain;
chain.order = () => chain;
chain.limit = () => ({ maybeSingle: async () => ({ data: latestRow, error: selectError }) });
chain.maybeSingle = async () => ({ data: updateRow, error: selectError });
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ ...chain, insert: (row: any) => { insert(row); return Promise.resolve({ error: null }); } }),
    rpc: vi.fn(),
  },
}));
vi.mock('@/services/enhancedUnifiedProfileService', () => ({ attachProfilesToEntities: async (x: any) => x }));

import { addReviewUpdate } from '@/services/review/timeline';
import { buildCreateTimelinePayload, buildEditTimelinePayload } from '../saveBuilders';
import { emptyComposerValues } from '../values';
import { hydrateValues } from '../sections';
import { MODES } from '../modes';
import { loadUpdateForEdit } from '../screen/timelineLoaders';
import { timelineAmbiguousCopy, TIMELINE_COPY } from '../screen/TimelineComposerScreen';

const R = '11111111-1111-4111-8111-111111111111';
const U = '22222222-2222-4222-8222-222222222222';
const values = (over: Partial<ReturnType<typeof emptyComposerValues>> = {}) => ({ ...emptyComposerValues(), text: ' changed ', ...over });

describe('3C create contract', () => {
  const build = (v: any, touched = false) => {
    const r = buildCreateTimelinePayload({ values: v, reviewId: R, recommendationTouched: touched });
    if (!r.ok) throw new Error();
    return r.payload;
  };
  it('untouched → omitted', () => expect('would_recommend' in build(values())).toBe(false));
  it('yes/maybe/no → value', () => {
    for (const c of ['yes', 'maybe', 'no'] as const) expect(build(values({ recommendation: { baseOnRating: false, choice: c } }), true).would_recommend).toBe(c);
  });
  it('base on rating → auto', () => expect(build(values({ recommendation: { baseOnRating: true, choice: null } }), true).would_recommend).toBe('auto'));
  it('explicitly cleared → null', () => expect(build(values(), true).would_recommend).toBeNull());
  it('rating cleared → omitted; comment trimmed', () => {
    const p = build(values({ rating: null }));
    expect('rating' in p).toBe(false);
    expect(p.comment).toBe('changed');
  });
});

describe('3C edit contract — five states round-trip', () => {
  for (const w of ['yes', 'maybe', 'no', 'auto', null] as const) {
    it(`${w} survives a comment-only edit`, () => {
      const v = hydrateValues({ update: { id: U, review_id: R, user_id: 'u', rating: 3, comment: 'a', media: [], would_recommend: w } }, MODES['edit-timeline-update']);
      const r = buildEditTimelinePayload({ values: { ...v, text: 'b' }, reviewId: R, updateId: U });
      expect(r.ok && r.payload.would_recommend).toBe(w);
    });
  }
  it('rating cleared → null', () => {
    const r = buildEditTimelinePayload({ values: values({ rating: null }), reviewId: R, updateId: U });
    expect(r.ok && r.payload.rating).toBeNull();
  });
});

describe('addReviewUpdate — existing callers unchanged', () => {
  beforeEach(() => insert.mockClear());
  it('legacy call with null omits the column', async () => {
    await addReviewUpdate(R, 'u', null, 'c', [], null);
    expect('would_recommend' in insert.mock.calls[0][0]).toBe(false);
  });
  it('legacy call with undefined omits the column', async () => {
    await addReviewUpdate(R, 'u', null, 'c', []);
    expect('would_recommend' in insert.mock.calls[0][0]).toBe(false);
  });
  it('page call sends explicit null only when asked', async () => {
    await addReviewUpdate(R, 'u', null, 'c', [], null, { sendExplicitNull: true });
    expect(insert.mock.calls[0][0].would_recommend).toBeNull();
  });
});

describe('loadUpdateForEdit — every check separate', () => {
  const row = (o: any = {}) => ({ id: U, review_id: R, user_id: 'me', rating: null, comment: 'x', media: [], would_recommend: null, created_at: new Date().toISOString(), ...o });
  beforeEach(() => { selectError = null; updateRow = row(); latestRow = row(); });
  it('ok', async () => expect((await loadUpdateForEdit(R, U, 'me')).status).toBe('ok'));
  it('malformed id → not_found', async () => expect((await loadUpdateForEdit('x', U, 'me')).status).toBe('not_found'));
  it('missing → not_found', async () => { updateRow = null; expect((await loadUpdateForEdit(R, U, 'me')).status).toBe('not_found'); });
  it('other review → wrong_review', async () => { updateRow = row({ review_id: U }); expect((await loadUpdateForEdit(R, U, 'me')).status).toBe('wrong_review'); });
  it('other author → unauthorized', async () => { updateRow = row({ user_id: 'x' }); expect((await loadUpdateForEdit(R, U, 'me')).status).toBe('unauthorized'); });
  it('newer exists → not_latest', async () => { latestRow = row({ id: R }); expect((await loadUpdateForEdit(R, U, 'me')).status).toBe('not_latest'); });
  it('network failure → error, never not_found', async () => { selectError = { message: 'down' }; expect((await loadUpdateForEdit(R, U, 'me')).status).toBe('error'); });
  it('device clock past the hour → still ok, advisory only', async () => {
    const r = await loadUpdateForEdit(R, U, 'me', Date.now() + 2 * 3600_000);
    expect(r.status).toBe('ok');
    expect(r.status === 'ok' && r.mayBeExpired).toBe(true);
  });
});

describe('ambiguous copy', () => {
  it('add warns about a second update; edit does not', () => {
    expect(timelineAmbiguousCopy(false, { status: 'not-observed' }).retryWarning).toBe(TIMELINE_COPY.addRetryWarning);
    expect(timelineAmbiguousCopy(true, { status: 'not-observed' }).retryWarning).toBe(TIMELINE_COPY.editRetryWarning);
    expect(TIMELINE_COPY.editRetryWarning).not.toMatch(/second/);
  });
  it('a found add entry is never called saved', () => {
    const c = timelineAmbiguousCopy(false, { status: 'candidate-found', strength: 'weak', candidate: { id: U, comment: 'hi' } as any });
    expect(c.title).not.toMatch(/saved/i);
    expect(c.found).toBe('hi');
  });
  it('edit mismatch stays unconfirmed', () => {
    const c = timelineAmbiguousCopy(true, { status: 'candidate-found', strength: 'compare', candidate: { id: U } as any, matchesAttempt: false });
    expect(c.title).toMatch(/couldn't confirm/);
  });
});

import { createUploadSession, uploadSessionReducer, committedLeftovers } from '../uploadSession';
describe('photos removed before a confirmed save', () => {
  const up = (s: any, url: string) => uploadSessionReducer(s, { type: 'UPLOADED', key: 'k', url });
  it('only after commit, only unsaved session uploads, never pre-existing', () => {
    let s = createUploadSession('k', 'id');
    s = up(up(up(s, 'a'), 'b'), 'old');
    expect(committedLeftovers(s, ['a'])).toEqual([]); // still open
    s = uploadSessionReducer(s, { type: 'SAVING' });
    expect(committedLeftovers(s, ['a'])).toEqual([]);
    s = uploadSessionReducer(s, { type: 'AMBIGUOUS' });
    expect(committedLeftovers(s, ['a'])).toEqual([]);
    s = uploadSessionReducer(s, { type: 'COMMITTED' });
    expect(committedLeftovers(s, ['a'], ['old'])).toEqual(['b']);
  });
});
