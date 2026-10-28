import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn(), error: null as unknown, payload: null as any }));
const a = { id: 'video-A', type: 'video', provider: 'mux', mux_upload_id: 'A', url: 'poster-A', order: 0 };
const photo = { id: 'photo', type: 'image', url: 'kept-photo', order: 1 };
vi.mock('@/hooks/useMuxStatus', () => ({ useMuxStatus: () => ({ A: { ui_status: 'ready', asset_id: 'asset-A', playback_id: 'play-A', duration: 5 }, B: { ui_status: 'ready', asset_id: 'asset-B', playback_id: 'play-B', duration: 5 } }) }));
vi.mock('@/hooks/useAppConfig', () => ({ useReviewVideoFlags: () => ({ settingOn: true, muxUploadsOn: true }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mock.toast }) }));
vi.mock('@/hooks/useSearchFunnel', () => ({ useSearchFunnel: () => ({ log: vi.fn() }) }));
vi.mock('@/contexts/LocationContext', () => ({ useLocation: () => ({ locationEnabled: true, permissionStatus: 'granted' }) }));
vi.mock('../screen/useHistoryGuard', () => ({ useHistoryGuard: () => ({ release: vi.fn(async () => true) }) }));
vi.mock('@/components/common/ConfirmationDialog', () => ({ ConfirmationDialog: () => null }));
vi.mock('@/components/common/EntityPreviewCard', () => ({ EntityPreviewCard: () => null }));
vi.mock('@/services/mediaService', () => ({ deleteMedia: vi.fn() }));
vi.mock('@/services/muxAbandonment', () => ({ abandonMuxUploads: vi.fn(), flushMuxAbandonments: vi.fn(), sessionNewMuxIds: () => [] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }) } }));
vi.mock('@/components/ui/connected-rings', () => ({ ConnectedRingsRating: () => null }));
vi.mock('@/components/profile/reviews/questionnaire/ChoiceChips', () => ({ default: () => null }));
vi.mock('@/components/profile/reviews/steps/StepOne', () => ({ default: (p: any) => <button onClick={() => p.onChange(4)}>Rate four</button> }));
vi.mock('@/components/profile/reviews/steps/SubjectSelectStep', () => ({ default: () => null }));
vi.mock('@/components/profile/reviews/steps/StepFour', () => ({ default: (p: any) => <>{p.part === 'text' && <input aria-label="Review text" value={p.description} onChange={(e) => p.onDescriptionChange(e.target.value)} />}{p.part === 'details' && <input aria-label="Review title" value={p.title} onChange={(e) => p.onTitleChange(e.target.value)} />}</> }));
vi.mock('@/components/media/MediaUploader', () => ({ MediaUploader: (p: any) => <>
  {p.customButton ? <button disabled={p.disabled} onClick={() => { p.onUploadsChange([{ status: 'uploading' }]); p.onMediaUploaded({ ...a, id: 'video-B', mux_upload_id: 'B', url: 'poster-B' }); }}>Replace</button> : <><button onClick={() => p.onMediaUploaded(a)}>Attach A</button><button onClick={() => p.onMediaUploaded(photo)}>Attach photo</button></>}
</> }));
vi.mock('@/components/feed/composer/ComposerMediaPreview', () => ({ ComposerMediaPreview: (p: any) => <>{p.media.map((m: any) => <React.Fragment key={m.id}>{p.recoveryForItem?.(m) || <button onClick={() => p.onRemove(m)}>Remove {m.id}</button>}</React.Fragment>)}</> }));
vi.mock('@/components/media/CompactMediaGrid', () => ({ CompactMediaGrid: () => null }));
vi.mock('@/components/feed/composer/MuxUploadChip', () => ({ MuxUploadChip: () => null }));
vi.mock('@/services/review/ownReview', async (original) => ({ ...(await original<any>()), findOwnReviewForEntity: async () => ({ status: 'none' }) }));
vi.mock('@/services/review/core', () => ({ createReview: (p: any) => { mock.payload = p; return mock.save(); }, updateReview: (_id: string, p: any) => { mock.payload = p; return mock.save(); } }));
vi.mock('@/services/review/timeline', () => ({
  toTimelineRecommendationValue: (base: boolean, choice: string | null) => base ? 'auto' : choice,
  addReviewUpdate: async (...args: any[]) => { mock.payload = args; mock.save(); args[6]?.onError?.(mock.error); return false; },
  editLatestReviewUpdate: async (...args: any[]) => { mock.payload = args; mock.save(); args[6]?.(mock.error); return 'error'; },
}));
import { ReviewComposerScreen } from '../screen/ReviewComposerScreen';
import { TimelineComposerScreen } from '../screen/TimelineComposerScreen';
const subject = { id: 'subject', name: 'Subject', type: 'product', metadata: null, providerName: null };
const record: any = { id: 'r1', user_id: 'owner', entity_id: 'subject', entity: subject, category: 'product', title: 'Subject', subtitle: 'title', description: 'draft', rating: 4, visibility: 'public', media: [], metadata: null };
const loaded: any = { record, review: record, display: { ...subject }, contextLine: null, destination: '/entity/subject' };
function wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>; }
beforeEach(() => { mock.save.mockReset(); mock.toast.mockClear(); mock.error = { code: 'P0001', message: 'video_unavailable', details: 'mux asset has been removed' }; mock.save.mockRejectedValue(mock.error); });
afterEach(cleanup);

describe('real review/timeline submit-handler recovery', () => {
  for (const kind of ['review', 'timeline']) for (const edit of [false, true]) {
    it(`${kind} ${edit ? 'edit' : 'create'}: preserves draft/photos and blocks A until replacement`, async () => {
      const p: any = kind === 'review' ? edit ? { mode: 'edit-review', loaded, userId: 'owner', cancelTo: '/' } : { mode: 'create-review', preselected: { subject, display: loaded.display }, userId: 'owner', cancelTo: '/' } : { mode: edit ? 'edit-timeline-update' : 'create-timeline-update', loaded, userId: 'owner', cancelTo: '/', update: { id: 't1', comment: 'draft', media: [] }, mayBeExpired: false };
      if (kind === 'timeline') mock.save.mockReturnValue(undefined);
      render(kind === 'review' ? <ReviewComposerScreen {...p} /> : <TimelineComposerScreen {...p} />, { wrapper });
      if (kind === 'review') {
        fireEvent.click(screen.getByText('Rate four'));
      }
      fireEvent.click(screen.getByText('Attach A')); fireEvent.click(screen.getByText('Attach photo'));
      const field = kind === 'review' ? 'Review text' : 'Update Comment *';
      fireEvent.change(screen.getByLabelText(field), { target: { value: 'all my written work' } });
      const submit = kind === 'review' ? edit ? 'Save changes' : 'Publish' : edit ? 'Save update' : 'Add update';
      fireEvent.click(screen.getByRole('button', { name: submit }));
      await waitFor(() => expect(mock.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: 'Video no longer available' })));
      expect(mock.save).toHaveBeenCalledOnce();
      expect(screen.getByText('Remove photo')).toBeInTheDocument();
      expect(screen.getByLabelText(field)).toHaveValue('all my written work');
      fireEvent.change(screen.getByLabelText(field), { target: { value: 'edited but still blocked' } });
      expect(screen.getByRole('button', { name: submit })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: submit })); expect(mock.save).toHaveBeenCalledOnce();
      fireEvent.click(screen.getByText('Replace'));
      expect(screen.queryByText('Video no longer available')).toBeNull();
      expect(screen.getByLabelText(field)).toHaveValue('edited but still blocked');
      expect(screen.getByRole('button', { name: submit })).toBeEnabled();
      mock.error = { code: 'P0001', message: 'unrelated_save_failure' };
      if (kind === 'review') mock.save.mockRejectedValue(mock.error);
      fireEvent.click(screen.getByRole('button', { name: submit }));
      await waitFor(() => expect(mock.save).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByRole('button', { name: submit })).toBeEnabled());
      expect(screen.getByLabelText(field)).toHaveValue('edited but still blocked');
      expect(screen.queryByText('Video no longer available')).toBeNull();
      const sentMedia = kind === 'review' ? mock.payload.media : mock.payload[edit ? 4 : 4];
      expect(sentMedia.map((m: any) => m.mux_upload_id || m.url)).toEqual(['kept-photo', 'B']);
    });
  }
});