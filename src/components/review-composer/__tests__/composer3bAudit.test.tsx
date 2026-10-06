import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { shouldShowLocationPrompt, LAST_SHOWN_KEY, LAST_SKIPPED_KEY } from '../screen/locationPromptPolicy';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/services/mediaService', async (orig) => ({
  ...(await orig<typeof import('@/services/mediaService')>()),
  uploadMedia: vi.fn(() => new Promise(() => undefined)),
  validateMediaFile: vi.fn(async () => ({ valid: true })),
}));
vi.mock('@/utils/codecSupport', () => ({ detectHEVCRisk: vi.fn(async () => false) }));

import { MediaUploader } from '@/components/media/MediaUploader';

const files = (n: number) => Array.from({ length: n }, (_, i) => new File(['x'], `p${i}.jpg`, { type: 'image/jpeg' }));

function drop(n: number) {
  const zone = screen.getByText(/Add photos or a short video/i).closest('div')!;
  fireEvent.drop(zone, { dataTransfer: { files: files(n), types: ['Files'] } });
}

describe('too many photos warning', () => {
  beforeEach(() => toast.mockClear());
  const tooMany = () => toast.mock.calls.map((c) => c[0]).find((t) => t.title === 'Too many files selected');

  it('reserved-slot path warns when 6 picked with 0 added', async () => {
    const reserve = vi.fn((n: number) => n);
    render(<MediaUploader sessionId="s" onMediaUploaded={() => {}} maxMediaCount={4} reserveSlots={reserve} releaseSlot={() => {}} />);
    drop(6);
    await waitFor(() => expect(tooMany()?.description).toBe('Only the first 4 files will be processed.'));
    expect(reserve).toHaveBeenCalledWith(4);
  });

  it('reserved-slot path warns when 3 picked with 2 added', async () => {
    const initial = [0, 1].map((i) => ({ url: `u${i}`, type: 'image' as const, order: i }));
    render(<MediaUploader sessionId="s" onMediaUploaded={() => {}} initialMedia={initial} maxMediaCount={4} reserveSlots={(n) => n} releaseSlot={() => {}} />);
    drop(3);
    await waitFor(() => expect(tooMany()?.description).toBe('Only the first 2 files will be processed.'));
  });

  it('popup path (no reservation) is unchanged', async () => {
    render(<MediaUploader sessionId="s" onMediaUploaded={() => {}} maxMediaCount={4} />);
    drop(6);
    await waitFor(() => expect(tooMany()?.description).toBe('Only the first 4 files will be processed.'));
  });
});

describe('location prompt policy (audit cases)', () => {
  const store = (init: Record<string, string> = {}) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  const now = 100 * 3600_000;
  const base = { eligible: true, locationEnabled: false, permissionStatus: 'prompt', now };
  it('place + location off + Ask + no snooze → shown', () => expect(shouldShowLocationPrompt({ ...base, storage: store() })).toBe(true));
  it('browser already allows → hidden', () => expect(shouldShowLocationPrompt({ ...base, permissionStatus: 'granted', storage: store() })).toBe(false));
  it('app location on → hidden', () => expect(shouldShowLocationPrompt({ ...base, locationEnabled: true, storage: store() })).toBe(false));
  it('ineligible type (movie/book) → hidden', () => expect(shouldShowLocationPrompt({ ...base, eligible: false, storage: store() })).toBe(false));
  it('Skip 1h ago → hidden; 3h ago → shown (Skip rule wins over shown)', () => {
    expect(shouldShowLocationPrompt({ ...base, storage: store({ [LAST_SKIPPED_KEY]: String(now - 3600_000) }) })).toBe(false);
    expect(shouldShowLocationPrompt({ ...base, storage: store({ [LAST_SKIPPED_KEY]: String(now - 3 * 3600_000), [LAST_SHOWN_KEY]: String(now - 60_000) }) })).toBe(true);
  });
});
