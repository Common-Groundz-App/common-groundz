import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ statuses: {} as Record<string, any>, add: vi.fn(), edit: vi.fn(), read: vi.fn(), toast: vi.fn(), preview: vi.fn() }));
vi.mock('@/hooks/useMuxStatus', () => ({ useMuxStatus: () => mock.statuses }));
vi.mock('@/hooks/useAppConfig', () => ({ useReviewVideoFlags: () => ({ settingOn: false, muxUploadsOn: true }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mock.toast }) }));
vi.mock('@/components/ui/connected-rings', () => ({ ConnectedRingsRating: () => null }));
vi.mock('@/components/profile/reviews/questionnaire/ChoiceChips', () => ({ default: () => null }));
vi.mock('@/components/common/EntityPreviewCard', () => ({ EntityPreviewCard: () => null }));
vi.mock('@/components/common/ConfirmationDialog', () => ({ ConfirmationDialog: () => null }));
vi.mock('@/services/mediaService', () => ({ deleteMedia: vi.fn() }));
vi.mock('@/components/media/CompactMediaGrid', () => ({ CompactMediaGrid: () => null }));
vi.mock('@/components/feed/composer/MuxUploadChip', () => ({ MuxUploadChip: () => null }));
vi.mock('@/components/feed/composer/ComposerMediaPreview', () => ({ ComposerMediaPreview: (p: any) => {
  mock.preview(p); return <button onClick={() => p.onRemove(p.media[0])}>Remove test video</button>;
} }));
const video = { id: 'v1', type: 'video', provider: 'mux', mux_upload_id: 'u1', mux_status: 'preparing', url: 'poster', order: 0 };
vi.mock('@/components/media/MediaUploader', () => ({ MediaUploader: (p: any) => <>
  <button onClick={() => p.onMediaUploaded(video)}>Add test video</button>
  <button onClick={() => p.onUploadsChange([{ status: 'uploading' }])}>Start transfer</button>
  <button onClick={() => p.onUploadsChange([])}>Finish transfer</button>
</> }));
vi.mock('@/services/review/timeline', async (original) => ({ ...(await original<typeof import('@/services/review/timeline')>()), addReviewUpdate: (...a: any[]) => mock.add(...a), editLatestReviewUpdate: (...a: any[]) => mock.edit(...a) }));
vi.mock('../screen/timelineLoaders', () => ({ loadUpdateById: (...a: any[]) => mock.read(...a), loadLatestUpdate: vi.fn() }));
vi.mock('../screen/useHistoryGuard', () => ({ useHistoryGuard: () => ({ release: vi.fn(async () => true) }) }));
import { TimelineComposerScreen } from '../screen/TimelineComposerScreen';

const ready = { ui_status: 'ready', asset_id: 'asset', playback_id: 'playback', duration: 8 };
const loaded: any = { review: { id: 'r1', user_id: 'owner', title: 'Subject', visibility: 'public', media: [] }, display: null, destination: '/entity/subject' };
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}
function props(edit: boolean): any { return edit ? { mode: 'edit-timeline-update', userId: 'owner', loaded, update: { id: 't1', review_id: 'r1', comment: 'draft', media: [], created_at: new Date().toISOString() }, mayBeExpired: false, cancelTo: '/' } : { mode: 'create-timeline-update', userId: 'owner', loaded, cancelTo: '/' }; }
beforeEach(() => {
  mock.statuses = {}; mock.add.mockReset(); mock.edit.mockReset(); mock.read.mockReset(); mock.toast.mockClear(); mock.preview.mockClear();
  mock.add.mockImplementation(async (...args: any[]) => { args[6]?.onSaved?.('t-saved'); return true; });
  mock.edit.mockResolvedValue('ok'); mock.read.mockResolvedValue({ id: 't-saved', media: [] });
});
afterEach(cleanup);

describe('timeline page publish gate', () => {
  for (const edit of [false, true]) {
    it(`${edit ? 'edit' : 'create'}: blocks transfer/processing, Ready previews Mux and saves once`, async () => {
      const p = props(edit);
      const view = render(<TimelineComposerScreen {...p} />, { wrapper });
      fireEvent.change(screen.getByLabelText('Update Comment *'), { target: { value: 'kept draft' } });
      fireEvent.click(screen.getByText('Start transfer'));
      const save = screen.getByRole('button', { name: edit ? 'Save update' : 'Add update' });
      expect(save).toBeDisabled();
      fireEvent.click(screen.getByText('Finish transfer'));
      fireEvent.click(screen.getByText('Add test video'));
      expect(save).toBeDisabled();
      mock.statuses = { u1: ready }; view.rerender(<TimelineComposerScreen {...p} />);
      expect(save).toBeEnabled();
      expect(mock.preview.mock.calls.at(-1)?.[0].media[0].mux_playback_id).toBe('playback');
      fireEvent.click(save); fireEvent.click(save);
      await waitFor(() => expect(edit ? mock.edit : mock.add).toHaveBeenCalledOnce());
      await waitFor(() => expect(mock.read).toHaveBeenCalledWith('r1', edit ? 't1' : 't-saved'));
    });
  }
  it('failed removal frees save and keeps text; flag OFF does not discard the admitted video', () => {
    const p = props(false); const view = render(<TimelineComposerScreen {...p} />, { wrapper });
    fireEvent.change(screen.getByLabelText('Update Comment *'), { target: { value: 'keep me' } });
    fireEvent.click(screen.getByText('Add test video'));
    mock.statuses = { u1: { ui_status: 'failed' } }; view.rerender(<TimelineComposerScreen {...p} />);
    expect(screen.getByRole('button', { name: 'Add update' })).toBeDisabled();
    fireEvent.click(screen.getByText('Remove test video'));
    expect(screen.getByLabelText('Update Comment *')).toHaveValue('keep me');
    expect(screen.getByRole('button', { name: 'Add update' })).toBeEnabled();
  });
  it('readback failure after insert reports saved, never inserts twice', async () => {
    const p = props(false); mock.statuses = { u1: ready }; mock.read.mockRejectedValue(new Error('offline'));
    render(<TimelineComposerScreen {...p} />, { wrapper });
    fireEvent.change(screen.getByLabelText('Update Comment *'), { target: { value: 'saved once' } });
    fireEvent.click(screen.getByText('Add test video'));
    fireEvent.click(screen.getByRole('button', { name: 'Add update' }));
    await waitFor(() => expect(mock.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Update saved' })));
    fireEvent.click(screen.getByRole('button', { name: 'Add update' }));
    expect(mock.add).toHaveBeenCalledOnce();
  });
  it('Ready after expiry does not bypass server rejection and retains the draft', async () => {
    const p = props(true); const view = render(<TimelineComposerScreen {...p} />, { wrapper });
    mock.edit.mockResolvedValue('expired');
    fireEvent.change(screen.getByLabelText('Update Comment *'), { target: { value: 'expired draft' } });
    fireEvent.click(screen.getByText('Add test video'));
    mock.statuses = { u1: ready }; view.rerender(<TimelineComposerScreen {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save update' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save update' })).toBeDisabled());
    expect(screen.getByLabelText('Update Comment *')).toHaveValue('expired draft');
    expect(mock.edit).toHaveBeenCalledOnce();
  });
});