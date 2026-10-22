/**
 * Session upload registry for composer Mux abandonment.
 *
 * Lifecycle identity for uploads lives here — NOT in the frozen/local preview
 * items, which stay purely visual. One entry per composer media tile, keyed by
 * the immutable `clientKey` (with `attemptId` recorded for diagnostics). The
 * registry survives the tile leaving the visible media array, so Remove and
 * Discard/Cancel can still abandon uploads whose tiles are already gone.
 *
 * Abandonment is driven ONLY by explicit intent (remove/replace/close/discard).
 * There is deliberately no unmount-based cleanup: unmount can follow a
 * successful save or normal navigation and is not proof of discard.
 */

export interface ComposerUploadEntry {
  clientKey: string;
  attemptId?: string;
  /** Mux upload id, once the upload-create call has returned it. */
  uploadId?: string;
  /** User explicitly removed/replaced the tile, or the session ended. */
  removed: boolean;
  /** The upload was saved onto content — never abandon it. */
  committed: boolean;
  /** An abandonment request was already sent for this upload. */
  abandoned: boolean;
}

export class ComposerUploadRegistry {
  private entries = new Map<string, ComposerUploadEntry>();

  /** Register a tile's upload attempt when the file is accepted. */
  register(clientKey: string, attemptId?: string): void {
    if (!clientKey || this.entries.has(clientKey)) return;
    this.entries.set(clientKey, { clientKey, attemptId, removed: false, committed: false, abandoned: false });
  }

  /**
   * Record the Mux upload id when it arrives. If the tile was already removed
   * (or the session already ended), the upload must be abandoned immediately —
   * the id is returned for that; otherwise null.
   */
  attachUploadId(clientKey: string, uploadId: string): string | null {
    const e = this.entries.get(clientKey);
    if (!e || !uploadId) return null;
    e.uploadId = uploadId;
    if (e.removed && !e.committed && !e.abandoned) {
      e.abandoned = true;
      return uploadId;
    }
    return null;
  }

  /**
   * Explicit Remove/Replace of a tile. Returns the upload id to abandon now,
   * or null if the id is not known yet (attachUploadId will return it later).
   */
  markRemoved(clientKey: string): string | null {
    const e = this.entries.get(clientKey);
    if (!e) return null;
    e.removed = true;
    if (e.uploadId && !e.committed && !e.abandoned) {
      e.abandoned = true;
      return e.uploadId;
    }
    return null;
  }

  /** Mark uploads as saved onto content; they are never abandoned afterwards. */
  markCommitted(uploadIds: Iterable<string>): void {
    const ids = new Set(uploadIds);
    for (const e of this.entries.values()) {
      if (e.uploadId && ids.has(e.uploadId)) e.committed = true;
    }
  }

  /**
   * The composer session is ending without saving (Discard/Cancel/Close/Back).
   * Every uncommitted entry is marked removed so late-arriving upload ids are
   * abandoned on attach; returns ids known now that still need abandonment.
   */
  endSession(): string[] {
    const out: string[] = [];
    for (const e of this.entries.values()) {
      e.removed = true;
      if (e.uploadId && !e.committed && !e.abandoned) {
        e.abandoned = true;
        out.push(e.uploadId);
      }
    }
    return out;
  }

  /** Test/inspection helper. */
  entry(clientKey: string): Readonly<ComposerUploadEntry> | undefined {
    return this.entries.get(clientKey);
  }
}
