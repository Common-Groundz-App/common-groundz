import { describe, it, expect, vi, beforeEach } from 'vitest';

let fakeDuration = 10;
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

beforeEach(() => {
  (globalThis as any).URL.createObjectURL = () => 'blob:x';
  (globalThis as any).URL.revokeObjectURL = () => {};
  (globalThis as any).document = {
    createElement: () => {
      const v: any = {};
      Object.defineProperty(v, 'src', {
        set() { Object.defineProperty(v, 'duration', { value: fakeDuration }); setTimeout(() => v.onloadedmetadata?.(), 0); },
      });
      return v;
    },
  };
});

const file = () => ({ type: 'video/mp4', size: 1000, name: 'v.mp4' }) as unknown as File;

describe('review video length rule', async () => {
  const { validateMediaFile } = await import('@/services/mediaService');

  it('known over 60 s is refused (reviews and posts)', async () => {
    fakeDuration = 65;
    expect((await validateMediaFile(file(), { unknownDurationAllowed: true })).valid).toBe(false);
    expect((await validateMediaFile(file())).valid).toBe(false);
  });
  it('under 60 s is allowed, not flagged', async () => {
    fakeDuration = 30;
    const r = await validateMediaFile(file(), { unknownDurationAllowed: true });
    expect(r).toEqual({ valid: true });
  });
  it('unknown length is allowed on purpose for reviews and flagged', async () => {
    for (const d of [NaN, Infinity]) {
      fakeDuration = d;
      const r = await validateMediaFile(file(), { unknownDurationAllowed: true });
      expect(r.valid).toBe(true);
      expect(r.durationUnknown).toBe(true);
    }
  });
  it('posts unchanged: never flagged; Infinity still refused, NaN still passes (recorded gap)', async () => {
    fakeDuration = Infinity;
    expect((await validateMediaFile(file())).valid).toBe(false);
    fakeDuration = NaN;
    const r = await validateMediaFile(file());
    expect(r.valid).toBe(true);
    expect(r.durationUnknown).toBeUndefined();
  });
});
