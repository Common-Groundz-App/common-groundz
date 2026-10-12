import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { MediaItem, VideoExitHandoff } from '@/types/media';
import {
  mockMuxPreparingMediaItem,
  mockMuxErroredMediaItem,
  mockMuxReadyMediaItem,
} from '@/utils/__fixtures__/muxMedia';
import {
  displayStateFor,
  visibleReviewMedia,
  isGalleryVisible,
  stableReviewMediaId,
  REVIEW_MEDIA_OWNER_COPY,
} from '@/utils/reviewMediaDisplay';

// ---- capture shared-player and viewer props -------------------------------
const feedVideoCalls: any[] = [];
let lightboxProps: any = null;
vi.mock('@/components/media/FeedVideo', () => ({
  FeedVideo: (p: any) => {
    feedVideoCalls.push(p);
    return (
      <button data-testid={`fv-${p.item.id}`} onClick={() => p.onTap?.({ currentTime: 7, wasPlaying: true, muted: true })}>
        video
      </button>
    );
  },
}));
vi.mock('@/components/media/LightboxPreview', () => ({
  LightboxPreview: (p: any) => {
    lightboxProps = p;
    return <div data-testid="lightbox" />;
  },
}));
const setManagerLightboxOpen = vi.fn();
vi.mock('@/hooks/useFeedVideoManager', () => ({
  useFeedVideoManagerControls: () => ({ isPresent: true, setLightboxOpen: setManagerLightboxOpen }),
}));

import { ReviewMediaBlock } from '@/components/media/ReviewMediaBlock';
import { YelpStyleMediaPreview } from '@/components/media/YelpStyleMediaPreview';

const photo = (id: string, order: number): MediaItem => ({ id, url: `https://x/${id}.jpg`, type: 'image', order });
const ready = (upload: string, order: number): MediaItem => ({
  ...mockMuxReadyMediaItem, id: undefined, url: '', mux_upload_id: upload, order,
});
const owner = { isOwner: true, canEdit: true };
const ownerLocked = { isOwner: true, canEdit: false };
const other = { isOwner: false, canEdit: false };

beforeEach(() => {
  cleanup();
  feedVideoCalls.length = 0;
  lightboxProps = null;
  setManagerLightboxOpen.mockClear();
});

describe('display rule', () => {
  it('photos and legacy stored videos always show', () => {
    expect(displayStateFor(photo('p', 0), other)).toBe('show');
    expect(displayStateFor({ url: 'https://x/v.mp4', type: 'video', order: 0 }, other)).toBe('show');
  });
  it('ready Mux shows for everyone', () => {
    expect(displayStateFor(mockMuxReadyMediaItem, other)).toBe('show');
    expect(displayStateFor(mockMuxReadyMediaItem, owner)).toBe('show');
  });
  it('processing: author only', () => {
    expect(displayStateFor(mockMuxPreparingMediaItem, owner)).toBe('owner_processing');
    expect(displayStateFor(mockMuxPreparingMediaItem, other)).toBe('hidden');
  });
  it('failed / too long: author only, message depends on the entry window', () => {
    const tooLong = { ...mockMuxErroredMediaItem, mux_error: 'too_long' };
    for (const m of [mockMuxErroredMediaItem, tooLong]) {
      expect(displayStateFor(m, owner)).toBe('owner_failed_editable');
      expect(displayStateFor(m, ownerLocked)).toBe('owner_failed_locked');
      expect(displayStateFor(m, other)).toBe('hidden');
    }
  });
  it('ready without playback id counts as failed', () => {
    const broken = { ...mockMuxReadyMediaItem, mux_playback_id: undefined };
    expect(displayStateFor(broken, other)).toBe('hidden');
  });
});

describe('stable identity', () => {
  it('uses owner + upload id, never position', () => {
    const a = visibleReviewMedia([ready('u1', 0), photo('p', 1)], { kind: 'review', ownerId: 'r1', ...other });
    const b = visibleReviewMedia([photo('p', 0), ready('u1', 1)], { kind: 'review', ownerId: 'r1', ...other });
    const idA = a.items.find((m) => m.type === 'video')!.id;
    const idB = b.items.find((m) => m.type === 'video')!.id;
    expect(idA).toBe('review:r1:u1');
    expect(idA).toBe(idB);
  });
  it('same upload under different entries never shares identity', () => {
    expect(stableReviewMediaId('review', 'r1', { mux_upload_id: 'u', url: '' }))
      .not.toBe(stableReviewMediaId('review_update', 'r1', { mux_upload_id: 'u', url: '' }));
  });
  it('filtering keeps order and drops hidden items for others', () => {
    const media = [photo('a', 0), { ...mockMuxPreparingMediaItem, order: 1 }, photo('b', 2)];
    const v = visibleReviewMedia(media, { kind: 'review', ownerId: 'r', ...other });
    expect(v.items.map((m) => m.url)).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
    expect(v.ownerNotice).toBeNull();
  });
});

describe('gallery', () => {
  it('ready-only videos, keeps photos and legacy video', () => {
    expect(isGalleryVisible(photo('p', 0))).toBe(true);
    expect(isGalleryVisible({ ...mockMuxReadyMediaItem, url: '' })).toBe(true);
    expect(isGalleryVisible(mockMuxPreparingMediaItem)).toBe(false);
    expect(isGalleryVisible(mockMuxErroredMediaItem)).toBe(false);
    expect(isGalleryVisible({ url: 'https://x/v.mp4', type: 'video', order: 0 })).toBe(true);
    expect(isGalleryVisible({ url: '', type: 'image', order: 0 })).toBe(false);
  });
});

describe('ReviewMediaBlock', () => {
  it('photo-only review renders no player and opens the tapped photo', () => {
    render(<ReviewMediaBlock media={[photo('a', 0), photo('b', 1)]} kind="review" ownerId="r" isOwner={false} canEdit={false} />);
    expect(feedVideoCalls.length).toBe(0);
    fireEvent.click(screen.getAllByRole('img')[1]);
    expect(lightboxProps.initialIndex).toBe(1);
    expect(lightboxProps.media[1].url).toBe('https://x/b.jpg');
  });

  it('ready video uses the shared player as a review source', () => {
    render(<ReviewMediaBlock media={[photo('a', 0), ready('u1', 1)]} kind="review" ownerId="r" isOwner={false} canEdit={false} />);
    expect(feedVideoCalls[0].source).toBe('review');
    expect(feedVideoCalls[0].item.id).toBe('review:r:u1');
  });

  it('tapping the video hands time into the viewer, pauses the page, and resumes on the same item', () => {
    render(<ReviewMediaBlock media={[photo('a', 0), ready('u1', 1), photo('b', 2)]} kind="review" ownerId="r" isOwner={false} canEdit={false} />);
    fireEvent.click(screen.getByTestId('fv-review:r:u1'));
    expect(lightboxProps.initialIndex).toBe(1);
    expect(lightboxProps.initialVideoState).toEqual({ currentTime: 7, wasPlaying: true, muted: true });
    expect(lightboxProps.media.map((m: MediaItem) => m.type)).toEqual(['image', 'video', 'image']);
    expect(setManagerLightboxOpen).toHaveBeenCalledWith(true);

    const exit: VideoExitHandoff = { currentTime: 12, wasPlaying: true, muted: false, entryIndex: 1, currentIndex: 1 };
    act(() => { lightboxProps.onExitHandoff(exit); lightboxProps.onClose(); });
    expect(setManagerLightboxOpen).toHaveBeenLastCalledWith(false);
    const last = feedVideoCalls[feedVideoCalls.length - 1];
    expect(last.resumeState).toEqual(exit);
  });

  it('closing on a different item does not hand time to the video', () => {
    render(<ReviewMediaBlock media={[ready('u1', 0), photo('b', 1)]} kind="review" ownerId="r" isOwner={false} canEdit={false} />);
    fireEvent.click(screen.getByTestId('fv-review:r:u1'));
    act(() => { lightboxProps.onExitHandoff({ currentTime: 3, wasPlaying: true, muted: true, entryIndex: 0, currentIndex: 1 }); lightboxProps.onClose(); });
    expect(feedVideoCalls[feedVideoCalls.length - 1].resumeState).toBeUndefined();
  });

  it('hidden processing video does not shift the tapped photo', () => {
    render(<ReviewMediaBlock media={[{ ...mockMuxPreparingMediaItem, order: 0 }, photo('b', 1)]} kind="review" ownerId="r" isOwner={false} canEdit={false} />);
    fireEvent.click(screen.getByRole('img'));
    expect(lightboxProps.media[lightboxProps.initialIndex].url).toBe('https://x/b.jpg');
  });

  it('others see nothing and no failure text for a failed video', () => {
    const { container } = render(<ReviewMediaBlock media={[mockMuxErroredMediaItem]} kind="review" ownerId="r" isOwner={false} canEdit={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('author recovery note follows the entry window', () => {
    render(<ReviewMediaBlock media={[mockMuxErroredMediaItem]} kind="review" ownerId="r" isOwner canEdit />);
    expect(screen.getByTestId('review-video-owner-notice').textContent).toBe(REVIEW_MEDIA_OWNER_COPY.failedEditable);
    cleanup();
    render(<ReviewMediaBlock media={[mockMuxErroredMediaItem]} kind="review_update" ownerId="u" isOwner canEdit={false} />);
    expect(screen.getByTestId('review-video-owner-notice').textContent).toBe(REVIEW_MEDIA_OWNER_COPY.failedLockedUpdate);
  });

  it('author sees a processing placeholder, no player', () => {
    render(<ReviewMediaBlock media={[mockMuxPreparingMediaItem]} kind="review" ownerId="r" isOwner canEdit />);
    expect(screen.getByTestId('mux-preparing-poster')).toBeTruthy();
    expect(feedVideoCalls.length).toBe(0);
  });
});

describe('legacy callers unchanged', () => {
  it('YelpStyleMediaPreview without playVideos never mounts the shared player', () => {
    render(<YelpStyleMediaPreview media={[mockMuxReadyMediaItem, photo('p', 1)]} />);
    expect(feedVideoCalls.length).toBe(0);
  });
});
