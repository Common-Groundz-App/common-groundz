import { QueryClient, type QueryKey } from '@tanstack/react-query';
import type { HelpfulSnapshot } from './helpfulToggle';

export interface HelpfulReview {
  id: string;
  user_id: string;
  visibility?: string | null;
  likes?: number;
  isLiked?: boolean;
}

export const helpfulQueryKey = (id: string, viewer: string | null) =>
  ['review-helpful', id, viewer ?? 'guest'] as const;

export const isViewerReviewKey = (key: QueryKey, viewer: string | null) =>
  ['entity-detail', 'reviews', 'review-helpful'].includes(String(key[0])) &&
  key.length === 3 && key[2] === (viewer ?? 'guest');

/** Assignment, never another increment: one optimistic snapshot fans out. */
export function writeHelpfulSnapshot(client: QueryClient, id: string, viewer: string | null, next: HelpfulSnapshot) {
  client.setQueryData(helpfulQueryKey(id, viewer), next);
  client.setQueriesData({ predicate: q => isViewerReviewKey(q.queryKey, viewer) && q.queryKey[0] !== 'review-helpful' }, (old: unknown) => {
    const patch = (r: HelpfulReview) => r.id === id && r.visibility === 'public' ? { ...r, ...next } : r;
    if (Array.isArray(old)) return old.map(patch);
    if (old && typeof old === 'object' && 'reviews' in old && Array.isArray(old.reviews)) {
      return { ...old, reviews: old.reviews.map(patch) };
    }
    return old;
  });
}

/** Shared across providers/portals, but never across QueryClients or sessions. */
export function createHelpfulSession() {
  return { viewer: undefined as string | null | undefined, epoch: 0, revision: 0,
    pending: new Set<string>(), versions: new Map<string, number>(), listeners: new Set<() => void>() };
}
const sessions = new WeakMap<QueryClient, ReturnType<typeof createHelpfulSession>>();
export function helpfulSession(client: QueryClient) {
  let session = sessions.get(client);
  if (!session) { session = createHelpfulSession(); sessions.set(client, session); }
  return session;
}
export function emitHelpful(client: QueryClient) {
  const session = helpfulSession(client);
  session.revision++;
  session.listeners.forEach(listener => listener());
}