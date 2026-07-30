/**
 * Destination resolution matrix for every notification shape actually emitted
 * by the database (post like, recommendation like, legacy post comment, legacy
 * recommendation comment, mention, reply, comment like, follow), plus the
 * degraded and hostile inputs the safe-URL parser must reject.
 *
 * Vitest-compatible structure; harmless no-op if vitest is absent at import
 * time (matches the project convention in renderBranching.test.ts).
 */
import type { NotificationType } from '@/services/notificationService';
import {
  normalizeInternalPath,
  resolveNotificationDestination,
  type NotificationDestination,
  type NotificationDestinationInput,
} from './notificationDestination';

const POST_ID = '11111111-1111-4111-8111-111111111111';
const REC_ID = '22222222-2222-4222-8222-222222222222';
const COMMENT_ID = '33333333-3333-4333-8333-333333333333';
const SENDER_ID = '44444444-4444-4444-4444-444444444444';

const n = (
  over: Partial<NotificationDestinationInput> & { type: NotificationType }
): NotificationDestinationInput => ({
  entity_type: null,
  entity_id: null,
  action_url: null,
  sender_id: SENDER_ID,
  metadata: null,
  ...over,
});

const destinationCases: Array<[string, NotificationDestinationInput, NotificationDestination]> = [
  // --- emitted shapes -------------------------------------------------------
  [
    'post like → post viewer',
    n({ type: 'like', entity_type: 'post', entity_id: POST_ID, action_url: `/post/${POST_ID}` }),
    { kind: 'viewer', contentType: 'post', id: POST_ID, commentId: null },
  ],
  [
    'recommendation like → recommendation viewer',
    n({ type: 'like', entity_type: 'recommendation', entity_id: REC_ID }),
    { kind: 'viewer', contentType: 'recommendation', id: REC_ID, commentId: null },
  ],
  [
    'legacy post comment (no comment_id) → parent, no false highlight',
    n({
      type: 'comment',
      entity_type: 'post',
      entity_id: POST_ID,
      action_url: `/post/${POST_ID}`,
      metadata: { comment_text: 'hi' },
    }),
    { kind: 'viewer', contentType: 'post', id: POST_ID, commentId: null },
  ],
  [
    'legacy recommendation comment → recommendation viewer',
    n({
      type: 'comment',
      entity_type: 'recommendation',
      entity_id: REC_ID,
      action_url: `/recommendations/${REC_ID}`,
      metadata: { comment_text: 'hi' },
    }),
    { kind: 'viewer', contentType: 'recommendation', id: REC_ID, commentId: null },
  ],
  [
    'mention → viewer with commentId',
    n({
      type: 'comment',
      entity_type: 'post',
      entity_id: POST_ID,
      metadata: { event: 'mention', comment_id: COMMENT_ID },
    }),
    { kind: 'viewer', contentType: 'post', id: POST_ID, commentId: COMMENT_ID },
  ],
  [
    'reply → viewer with commentId',
    n({
      type: 'comment',
      entity_type: 'recommendation',
      entity_id: REC_ID,
      metadata: { event: 'reply', comment_id: COMMENT_ID },
    }),
    { kind: 'viewer', contentType: 'recommendation', id: REC_ID, commentId: COMMENT_ID },
  ],
  [
    'comment like → viewer with commentId',
    n({
      type: 'like',
      entity_type: 'post',
      entity_id: POST_ID,
      metadata: { event: 'comment_like', comment_id: COMMENT_ID },
    }),
    { kind: 'viewer', contentType: 'post', id: POST_ID, commentId: COMMENT_ID },
  ],
  [
    'follow → profile route',
    n({ type: 'follow', entity_type: 'profile', entity_id: SENDER_ID }),
    { kind: 'route', path: `/profile/${SENDER_ID}` },
  ],
  [
    'follow with only sender_id → sender profile',
    n({ type: 'follow' }),
    { kind: 'route', path: `/profile/${SENDER_ID}` },
  ],

  // --- degraded shapes ------------------------------------------------------
  [
    'non-UUID entity_id falls through to action_url',
    n({ type: 'like', entity_type: 'post', entity_id: 'not-a-uuid', action_url: `/post/${POST_ID}` }),
    { kind: 'route', path: `/post/${POST_ID}` },
  ],
  [
    'non-UUID comment_id is dropped',
    n({ type: 'comment', entity_type: 'post', entity_id: POST_ID, metadata: { comment_id: 'nope' } }),
    { kind: 'viewer', contentType: 'post', id: POST_ID, commentId: null },
  ],
  [
    'legacy singular recommendation action_url is rewritten',
    n({ type: 'comment', action_url: `/recommendation/${REC_ID}?commentId=${COMMENT_ID}`, sender_id: null }),
    { kind: 'route', path: `/recommendations/${REC_ID}?commentId=${COMMENT_ID}` },
  ],
  [
    'nothing usable → missing-target',
    n({ type: 'system', sender_id: null }),
    { kind: 'none', reason: 'missing-target' },
  ],
  [
    'review without action_url → unsupported-type',
    n({ type: 'system', entity_type: 'review', entity_id: POST_ID, sender_id: null }),
    { kind: 'none', reason: 'unsupported-type' },
  ],
  [
    'external action_url → unsafe-url',
    n({ type: 'system', action_url: 'https://evil.com', sender_id: null }),
    { kind: 'none', reason: 'unsafe-url' },
  ],
];

const pathAcceptCases: Array<[string, string]> = [
  [`/recommendation/${REC_ID}?commentId=${COMMENT_ID}`, `/recommendations/${REC_ID}?commentId=${COMMENT_ID}`],
  [`/post/${POST_ID}?focus=comment`, `/post/${POST_ID}?focus=comment`],
  [`/post/${POST_ID}?next=https://evil.com`, `/post/${POST_ID}`],
  [`/post/${POST_ID}?commentId=nope`, `/post/${POST_ID}`],
  ['/u/some.user_1', '/u/some.user_1'],
  ['/my-stuff', '/my-stuff'],
  [`/profile/${SENDER_ID}`, `/profile/${SENDER_ID}`],
];

const pathRejectCases: unknown[] = [
  'https://evil.com',
  '//evil.com',
  'javascript:alert(1)',
  `../post/${POST_ID}`,
  `post/${POST_ID}`,
  '/post/not-a-uuid',
  '/u/bad name',
  `/u/${'a'.repeat(31)}`,
  '/unknown/route',
  `/post/${POST_ID}\\x`,
  '/post/\u0000',
  '',
  null,
  undefined,
  42,
];

// Vitest-compatible structure; harmless no-op if vitest absent at import time.
declare const describe: undefined | ((name: string, fn: () => void) => void);
declare const it: undefined | ((name: string, fn: () => void) => void);
declare const expect:
  | undefined
  | ((v: unknown) => { toEqual: (v: unknown) => void; toBeNull: () => void });

if (typeof describe === 'function' && typeof it === 'function' && typeof expect === 'function') {
  describe('resolveNotificationDestination — emitted + degraded shapes', () => {
    for (const [name, input, expected] of destinationCases) {
      it(name, () => {
        expect(resolveNotificationDestination(input)).toEqual(expected);
      });
    }
  });

  describe('normalizeInternalPath — accepts safe internal paths', () => {
    for (const [input, expected] of pathAcceptCases) {
      it(input, () => {
        expect(normalizeInternalPath(input)).toEqual(expected);
      });
    }
  });

  describe('normalizeInternalPath — rejects unsafe input', () => {
    for (const input of pathRejectCases) {
      it(String(input), () => {
        expect(normalizeInternalPath(input)).toBeNull();
      });
    }
  });
}
