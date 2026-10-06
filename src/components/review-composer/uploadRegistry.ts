/**
 * In-memory upload registry (3B close-out). One entry per upload-session id;
 * it outlives the composer screen so an upload that finishes after the user
 * left is still decided against the session it started in.
 *
 * Slots: reserved when a file is accepted, released exactly once per file.
 * Entries are removed once the session has ended and nothing is pending.
 * The orphan list is in-memory only — NOT durable cleanup tracking.
 */
import type { UploadSettlement } from './uploadSession';

export const MAX_COMPOSER_MEDIA = 4;

export type LateUploadDecision = 'add' | 'delete' | 'keep-orphan';

interface Entry {
  reserved: number;
  /** Media currently on the form (kept in sync by the screen). */
  committed: number;
  settlement: UploadSettlement;
  ended: boolean;
  orphans: string[];
}

const registry = new Map<string, Entry>();

function entry(id: string): Entry {
  let e = registry.get(id);
  if (!e) {
    e = { reserved: 0, committed: 0, settlement: 'open', ended: false, orphans: [] };
    registry.set(id, e);
  }
  return e;
}

function maybeRemove(id: string) {
  const e = registry.get(id);
  if (e && e.ended && e.reserved === 0) registry.delete(id);
}

export function syncCommitted(id: string, count: number) {
  entry(id).committed = count;
}

export function setSettlement(id: string, settlement: UploadSettlement) {
  entry(id).settlement = settlement;
}

/** Atomically reserve up to `requested` slots; returns how many were granted. */
export function reserveSlots(id: string, requested: number, max = MAX_COMPOSER_MEDIA): number {
  const e = entry(id);
  if (e.ended) return 0;
  const granted = Math.max(0, Math.min(requested, max - e.committed - e.reserved));
  e.reserved += granted;
  return granted;
}

export function releaseSlot(id: string) {
  const e = registry.get(id);
  if (!e) return;
  e.reserved = Math.max(0, e.reserved - 1);
  maybeRemove(id);
}

/**
 * Decide a finished upload. Call BEFORE releaseSlot for that file.
 * - open + live + room → add
 * - open + (left or over the limit) → delete
 * - saving / ambiguous (live or left) after leaving → keep as orphan
 */
export function decideFinishedUpload(id: string, url: string, alive: boolean): LateUploadDecision {
  const e = registry.get(id);
  if (!e) return 'delete';
  if (!e.ended && alive) {
    if (e.committed >= MAX_COMPOSER_MEDIA) return 'delete';
    e.committed += 1;
    return 'add';
  }
  if (e.settlement === 'saving' || e.settlement === 'ambiguous') {
    e.orphans.push(url);
    return 'keep-orphan';
  }
  return e.settlement === 'committed' ? 'keep-orphan' : 'delete';
}

/** Mark the session as left; it is removed once nothing is pending. */
export function endSession(id: string) {
  const e = registry.get(id);
  if (!e) return;
  e.ended = true;
  maybeRemove(id);
}

export function getOrphans(id: string): readonly string[] {
  return registry.get(id)?.orphans ?? [];
}

/** Test/inspection helpers. */
export function hasSession(id: string) {
  return registry.has(id);
}
export function __resetRegistry() {
  registry.clear();
}
