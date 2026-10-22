import { describe, expect, it } from 'vitest';
import { ComposerUploadRegistry } from '../composerUploadRegistry';

describe('ComposerUploadRegistry', () => {
  it('reproduces the reported bug: frozen placeholder tile removed after upload is ready', () => {
    // Sequence: tile added with local preview (no upload id yet) → Mux upload
    // finishes and the LIVE item gains mux_upload_id → user clicks X on the
    // FROZEN preview tile (no upload id on it) → Cancel with empty media.
    const r = new ComposerUploadRegistry();
    r.register('ck-1', 'attempt-1');

    // Upload id arrives while tile is still present.
    expect(r.attachUploadId('ck-1', 'upload-1')).toBeNull();

    // Remove resolves the id from live state/registry, not the frozen tile.
    expect(r.markRemoved('ck-1')).toBe('upload-1');

    // Cancel afterwards must not double-abandon or lose anything.
    expect(r.endSession()).toEqual([]);
  });

  it('sub-second remove: id arrives after the tile was removed → abandon on attach', () => {
    const r = new ComposerUploadRegistry();
    r.register('ck-1', 'attempt-1');

    // Removed before the upload-create call returned an id.
    expect(r.markRemoved('ck-1')).toBeNull();

    // Late id must be abandoned immediately.
    expect(r.attachUploadId('ck-1', 'upload-1')).toBe('upload-1');
  });

  it('discard with empty media abandons all uncommitted session uploads', () => {
    const r = new ComposerUploadRegistry();
    r.register('ck-1');
    r.register('ck-2');
    r.attachUploadId('ck-1', 'upload-1');
    r.attachUploadId('ck-2', 'upload-2');

    // Tile for ck-1 was removed earlier; ck-2's tile is also gone by now.
    r.markRemoved('ck-1');

    expect(r.endSession()).toEqual(['upload-2']);
  });

  it('late id arriving after the session ended is abandoned on attach', () => {
    const r = new ComposerUploadRegistry();
    r.register('ck-1');
    r.endSession();
    expect(r.attachUploadId('ck-1', 'upload-1')).toBe('upload-1');
  });

  it('committed uploads are never abandoned, even after remove/endSession', () => {
    const r = new ComposerUploadRegistry();
    r.register('ck-1');
    r.attachUploadId('ck-1', 'upload-1');
    r.markCommitted(['upload-1']);

    expect(r.markRemoved('ck-1')).toBeNull();
    expect(r.endSession()).toEqual([]);
    expect(r.entry('ck-1')?.committed).toBe(true);
  });

  it('register is idempotent per clientKey and unknown keys are safe', () => {
    const r = new ComposerUploadRegistry();
    r.register('ck-1', 'a1');
    r.register('ck-1', 'a2');
    expect(r.entry('ck-1')?.attemptId).toBe('a1');
    expect(r.markRemoved('nope')).toBeNull();
    expect(r.attachUploadId('nope', 'upload-x')).toBeNull();
  });
});
