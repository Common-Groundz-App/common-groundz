import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const toast = vi.fn();
const uploadMedia = vi.fn(() => new Promise(() => undefined));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/services/mediaService', async (orig) => ({
  ...(await orig<typeof import('@/services/mediaService')>()),
  uploadMedia: (...a: unknown[]) => uploadMedia(...(a as [])),
  validateMediaFile: vi.fn(async () => ({ valid: true })),
}));
vi.mock('@/utils/codecSupport', () => ({ detectHEVCRisk: vi.fn(async () => false) }));
vi.mock('@/utils/videoPoster', async (orig) => ({
  ...(await orig<typeof import('@/utils/videoPoster')>()),
  generateVideoPoster: vi.fn(() => new Promise(() => undefined)),
}));

import { MediaUploader } from '@/components/media/MediaUploader';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';

const vid = () => new File(['v'], 'v.mp4', { type: 'video/mp4' });
const img = (i = 0) => new File(['x'], `p${i}.jpg`, { type: 'image/jpeg' });

function drop(files: File[], text: RegExp) {
  const zone = screen.getByText(text).closest('div')!;
  fireEvent.drop(zone, { dataTransfer: { files, types: ['Files'] } });
}

describe('photo-only review uploader', () => {
  beforeEach(() => { toast.mockClear(); uploadMedia.mockClear(); });

  it('dropped video is refused: no slot reserved, no upload, toast shown', async () => {
    const reserve = vi.fn((n: number) => n);
    render(<MediaUploader sessionId="s" onMediaUploaded={() => {}} reserveSlots={reserve} releaseSlot={() => {}} allowVideo={false} />);
    drop([vid()], /^Add photos$/);
    await waitFor(() => expect(toast.mock.calls.some((c) => c[0].title === 'Photos only')).toBe(true));
    expect(reserve).not.toHaveBeenCalled();
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it('mixed selection keeps only photos and reserves only their slots', async () => {
    const reserve = vi.fn((n: number) => n);
    render(<MediaUploader sessionId="s" onMediaUploaded={() => {}} reserveSlots={reserve} releaseSlot={() => {}} allowVideo={false} />);
    drop([vid(), img(1), img(2)], /^Add photos$/);
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(2));
    expect(reserve).toHaveBeenCalledWith(2);
    expect(uploadMedia.mock.calls.every((c: unknown[]) => (c[0] as File).type === 'image/jpeg')).toBe(true);
  });

  it('picker only offers image types when video is off', () => {
    const created: HTMLInputElement[] = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((t: string) => {
      const el = orig(t);
      if (t === 'input') { created.push(el as HTMLInputElement); (el as HTMLInputElement).click = () => {}; }
      return el;
    });
    render(<MediaUploader sessionId="s" onMediaUploaded={() => {}} allowVideo={false} />);
    fireEvent.click(screen.getByText(/^Add photos$/));
    expect(created[0].accept).not.toMatch(/video/);
    spy.mockRestore();
  });

  it('posts default is unchanged: video still accepted', async () => {
    render(<MediaUploader sessionId="s" onMediaUploaded={() => {}} />);
    drop([vid()], /Add photos or a short video/);
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls.some((c) => c[0].title === 'Photos only')).toBe(false);
  });
});

describe('existing videos cannot be removed', () => {
  it('hides remove only for videos', () => {
    const media = [
      { url: 'https://x/storage/v1/object/public/post_media/a.jpg', type: 'image' as const, order: 0 },
      { url: 'https://x/storage/v1/object/public/post_media/b.mp4', type: 'video' as const, order: 1 },
    ];
    render(<CompactMediaGrid media={media} onRemove={() => {}} canRemove={(m) => m.type !== 'video'} />);
    expect(screen.getAllByText('Remove')).toHaveLength(1);
  });
});
