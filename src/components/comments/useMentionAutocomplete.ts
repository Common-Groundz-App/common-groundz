import { useCallback, useState } from 'react';

/**
 * Shared, caret-aware mention autocomplete controller for every comment
 * surface (inline main / reply / edit, dialog main / edit).
 *
 * The detection + insertion math is exported as pure functions so it can be
 * unit tested without React or a DOM.
 */

export type MentionTargetKind = 'main' | 'reply' | 'edit';

export interface MentionTarget {
  kind: MentionTargetKind;
  /** Only set for `edit`, so popups stay scoped to a single comment row. */
  commentId?: string;
}

export interface MentionToken {
  /** Text typed after the `@`, never empty (empty closes the popup). */
  query: string;
  /** Index of the `@` character. */
  start: number;
  /** Caret index (exclusive end of the token). */
  end: number;
}

/**
 * Matches a partial `@mention` immediately before the caret. The `@` must be at
 * the start of the text or preceded by a character that can't be part of a
 * username/email, so `a@b.com` never triggers.
 */
const MENTION_TOKEN_REGEX = /(?:^|[^a-z0-9._@])@([a-z0-9._]*)$/i;

export function detectMentionToken(value: string, caretIndex: number): MentionToken | null {
  const caret = Math.max(0, Math.min(caretIndex, value.length));
  const match = value.slice(0, caret).match(MENTION_TOKEN_REGEX);
  if (!match) return null;

  const query = match[1];
  // Keep parity with the existing main/reply behaviour: at least one character
  // after `@` before we search (a bare `@` has no query to search on).
  if (query.length === 0) return null;

  return { query, start: caret - query.length - 1, end: caret };
}

export function insertMentionAtToken(
  value: string,
  token: MentionToken,
  username: string
): { value: string; caret: number } {
  const replacement = `@${username} `;
  return {
    value: value.slice(0, token.start) + replacement + value.slice(token.end),
    caret: token.start + replacement.length,
  };
}

interface MentionState {
  visible: boolean;
  query: string;
  target: MentionTarget | null;
  token: MentionToken | null;
}

const CLOSED: MentionState = { visible: false, query: '', target: null, token: null };

export function useMentionAutocomplete() {
  const [state, setState] = useState<MentionState>(CLOSED);

  /** Call on every change / caret move of a mention-aware textarea. */
  const detect = useCallback((value: string, caretIndex: number, target: MentionTarget) => {
    const token = detectMentionToken(value, caretIndex);
    if (!token) {
      setState(prev => (prev.visible ? CLOSED : prev));
      return;
    }
    setState({ visible: true, query: token.query, target, token });
  }, []);

  /** Replaces only the detected token; returns the new value + caret offset. */
  const insert = useCallback(
    (value: string, username: string): { value: string; caret: number } | null => {
      if (!state.token) return null;
      return insertMentionAtToken(value, state.token, username);
    },
    [state.token]
  );

  const close = useCallback(() => setState(CLOSED), []);
  const reset = close;

  const isOpenFor = useCallback(
    (kind: MentionTargetKind, commentId?: string) =>
      state.visible && state.target?.kind === kind && state.target?.commentId === commentId,
    [state.visible, state.target]
  );

  return {
    visible: state.visible,
    query: state.query,
    target: state.target,
    detect,
    insert,
    close,
    reset,
    isOpenFor,
  };
}

export type MentionAutocompleteController = ReturnType<typeof useMentionAutocomplete>;
