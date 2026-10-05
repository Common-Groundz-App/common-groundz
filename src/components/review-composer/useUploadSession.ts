/**
 * Stable upload session for a logical composer session (F7).
 *
 * The id lives in a ref keyed by `sessionKey`: it survives re-renders, step
 * changes, validation, upload progress and retries, and is regenerated only
 * when the session key itself changes. A key change never triggers cleanup of
 * the previous session — its uploads stay until their fate is settled.
 */
import { useCallback, useRef, useState } from 'react';
import {
  cleanupCandidates,
  createUploadSession,
  uploadSessionReducer,
  type UploadSessionEvent,
  type UploadSessionState,
} from './uploadSession';

export function useUploadSession(sessionKey: string) {
  const ref = useRef<UploadSessionState | null>(null);
  const previous = useRef<UploadSessionState[]>([]);
  if (!ref.current || ref.current.key !== sessionKey) {
    if (ref.current) previous.current.push(ref.current);
    ref.current = createUploadSession(sessionKey);
  }
  const [, force] = useState(0);

  const send = useCallback((event: UploadSessionEvent) => {
    if (!ref.current) return;
    const next = uploadSessionReducer(ref.current, event);
    if (next !== ref.current) {
      ref.current = next;
      force((n) => n + 1);
    }
  }, []);

  const recordUpload = useCallback(
    (forKey: string, url: string) => send({ type: 'UPLOADED', key: forKey, url }),
    [send],
  );

  const session = ref.current;
  return {
    sessionId: session.id,
    uploads: session.uploads,
    settlement: session.settlement,
    recordUpload,
    send,
    cleanupCandidates: (preexisting: readonly string[] = []) => cleanupCandidates(session, preexisting),
    /** Earlier sessions in this mount; never auto-cleaned. */
    previousSessions: previous.current,
  };
}
