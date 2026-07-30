import { describe, expect, it } from 'vitest';
import {
  normalizeInternalPath,
  resolveNotificationDestination,
} from './notificationDestination';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const REC_ID = '22222222-2222-4222-8222-222222222222';
const COMMENT_ID = '33333333-3333-4333-8333-333333333333';
const SENDER_ID = '44444444-4444-4444-4444-444444444444';

const base = {
  type: 'like',
  entity_type: null as any,
  entity_id: null as any,
  action_url: null as any,
  sender_id: SENDER_ID,
  metadata: null as any,
};

describe('resolveNotificationDestination — emitted shapes', () => {
  it('post like → post viewer', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        type: 'like',
        entity_type: 'post',
        entity_id: POST_ID,
        action_url: `/post/${POST_ID}`,
      })
    ).toEqual({
      kind: 'viewer',
      contentType: 'post',
      id: POST_ID,
      commentId: null,
    });
  });

  it('recommendation like → recommendation viewer', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        type: 'like',
        entity_type: 'recommendation',
        entity_id: REC_ID,
      })
    ).toEqual({
      kind: 'viewer',
      contentType: 'recommendation',
      id: REC_ID,
      commentId: null,
    });
  });

  it('legacy post comment (no comment_id) → parent, no false highlight', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        type: 'comment',
        entity_type: 'post',
        entity_id: POST_ID,
        action_url: `/post/${POST_ID}`,
        metadata: { comment_text: 'hi' },
      })
    ).toEqual({
      kind: 'viewer',
      contentType: 'post',
      id: POST_ID,
      commentId: null,
    });
  });

  it('legacy recommendation comment → recommendation viewer', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        type: 'comment',
        entity_type: 'recommendation',
        entity_id: REC_ID,
        action_url: `/recommendations/${REC_ID}`,
        metadata: { comment_text: 'hi' },
      })
    ).toMatchObject({ kind: 'viewer', contentType: 'recommendation' });
  });

  it('mention → viewer with commentId', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        type: 'comment',
        entity_type: 'post',
        entity_id: POST_ID,
        metadata: { event: 'mention', comment_id: COMMENT_ID },
      })
    ).toEqual({
      kind: 'viewer',
      contentType: 'post',
      id: POST_ID,
      commentId: COMMENT_ID,
    });
  });

  it('reply → viewer with commentId', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        type: 'comment',
        entity_type: 'recommendation',
        entity_id: REC_ID,
        metadata: { event: 'reply', comment_id: COMMENT_ID },
      })
    ).toEqual({
      kind: 'viewer',
      contentType: 'recommendation',
      id: REC_ID,
      commentId: COMMENT_ID,
    });
  });

  it('comment like → viewer with commentId', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        type: 'like',
        entity_type: 'post',
        entity_id: POST_ID,
        metadata: { event: 'comment_like', comment_id: COMMENT_ID },
      })
    ).toMatchObject({ commentId: COMMENT_ID });
  });

  it('follow → profile route', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        type: 'follow',
        entity_type: 'profile',
        entity_id: SENDER_ID,
      })
    ).toEqual({ kind: 'route', path: `/profile/${SENDER_ID}` });
  });

  it('follow with only sender_id falls back to sender', () => {
    expect(
      resolveNotificationDestination({ ...base, type: 'follow' })
    ).toEqual({ kind: 'route', path: `/profile/${SENDER_ID}` });
  });
});

describe('resolveNotificationDestination — degraded shapes', () => {
  it('non-UUID entity_id falls through to action_url', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        entity_type: 'post',
        entity_id: 'not-a-uuid',
        action_url: `/post/${POST_ID}`,
      })
    ).toEqual({ kind: 'route', path: `/post/${POST_ID}` });
  });

  it('non-UUID comment_id is dropped, not forwarded', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        entity_type: 'post',
        entity_id: POST_ID,
        metadata: { comment_id: 'nope' },
      })
    ).toMatchObject({ commentId: null });
  });

  it('missing everything → missing-target', () => {
    expect(
      resolveNotificationDestination({ ...base, sender_id: null as any })
    ).toEqual({ kind: 'none', reason: 'missing-target' });
  });

  it('review without action_url → unsupported-type', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        entity_type: 'review',
        entity_id: POST_ID,
        sender_id: null as any,
      })
    ).toEqual({ kind: 'none', reason: 'unsupported-type' });
  });

  it('unsafe action_url → unsafe-url', () => {
    expect(
      resolveNotificationDestination({
        ...base,
        sender_id: null as any,
        action_url: 'https://evil.com',
      })
    ).toEqual({ kind: 'none', reason: 'unsafe-url' });
  });
});

describe('normalizeInternalPath', () => {
  it('rewrites legacy singular recommendation paths and keeps commentId', () => {
    expect(
      normalizeInternalPath(`/recommendation/${REC_ID}?commentId=${COMMENT_ID}`)
    ).toBe(`/recommendations/${REC_ID}?commentId=${COMMENT_ID}`);
  });

  it('keeps focus=comment', () => {
    expect(normalizeInternalPath(`/post/${POST_ID}?focus=comment`)).toBe(
      `/post/${POST_ID}?focus=comment`
    );
  });

  it('strips foreign params', () => {
    expect(
      normalizeInternalPath(`/post/${POST_ID}?next=https://evil.com`)
    ).toBe(`/post/${POST_ID}`);
  });

  it('allows /u/:username and /my-stuff', () => {
    expect(normalizeInternalPath('/u/some.user_1')).toBe('/u/some.user_1');
    expect(normalizeInternalPath('/my-stuff')).toBe('/my-stuff');
  });

  it.each([
    'https://evil.com',
    '//evil.com',
    'javascript:alert(1)',
    `../post/${POST_ID}`,
    `post/${POST_ID}`,
    '/post/not-a-uuid',
    '/u/bad name',
    '/u/' + 'a'.repeat(31),
    '/unknown/route',
    `/post/${POST_ID}\\x`,
    '',
    null,
    undefined,
    42,
  ])('rejects %p', (input) => {
    expect(normalizeInternalPath(input as any)).toBeNull();
  });
});
