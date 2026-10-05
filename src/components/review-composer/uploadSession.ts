/**
 * Upload-session bookkeeping (pure). One stable id per logical composer
 * session; tracks uploads made in this session and whether their fate is
 * settled. Cleanup candidates exist only for an open, unsaved session — never
 * while saving or ambiguous, never after commit, never pre-existing media.
 */
import { generateUUID } from '@/lib/uuid';

export type UploadSettlement = 'open' | 'saving' | 'ambiguous' | 'committed';

export interface UploadSessionState {
  key: string;
  id: string;
  uploads: string[];
  settlement: UploadSettlement;
}

export function createUploadSession(key: string, id: string = generateUUID()): UploadSessionState {
  return { key, id, uploads: [], settlement: 'open' };
}

export type UploadSessionEvent =
  | { type: 'UPLOADED'; key: string; url: string }
  | { type: 'SAVING' }
  | { type: 'SAVE_FAILED' }
  | { type: 'AMBIGUOUS' }
  | { type: 'COMMITTED' };

export function uploadSessionReducer(s: UploadSessionState, e: UploadSessionEvent): UploadSessionState {
  switch (e.type) {
    case 'UPLOADED':
      if (e.key !== s.key || s.uploads.includes(e.url)) return s; // stale callback
      return { ...s, uploads: [...s.uploads, e.url] };
    case 'SAVING':
      return { ...s, settlement: 'saving' };
    case 'SAVE_FAILED':
      return s.settlement === 'saving' ? { ...s, settlement: 'open' } : s;
    case 'AMBIGUOUS':
      return { ...s, settlement: 'ambiguous' };
    case 'COMMITTED':
      return { ...s, settlement: 'committed' };
  }
}

/** Session uploads safe to delete on Cancel. */
export function cleanupCandidates(s: UploadSessionState, preexistingUrls: readonly string[] = []): string[] {
  if (s.settlement !== 'open') return [];
  return s.uploads.filter((u) => !preexistingUrls.includes(u));
}
