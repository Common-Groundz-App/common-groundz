/**
 * Phase 1B — single-page review composer regressions.
 * Layout only: every section is rendered at once, details collapse without
 * losing state, media keeps its mounted lifecycle, and saved payloads are the
 * same values the step-based form produced.
 */
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ save: vi.fn(), payload: null as any, uploaderMounts: 0, uploaderUnmounts: 0 }));
vi.mock('@/hooks/useMuxStatus', () => ({ useMuxStatus: () => ({}) }));
vi.mock('@/hooks/useAppConfig', () => ({ useReviewVideoFlags: () => ({ settingOn: true, muxUploadsOn: true }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useSearchFunnel', () => ({ useSearchFunnel: () => ({ log: vi.fn() }) }));
vi.mock('@/contexts/LocationContext', () => ({ useLocation: () => ({ locationEnabled: true, permissionStatus: 'granted' }) }));
vi.mock('../screen/useHistoryGuard', () => ({ useHistoryGuard: () => ({ release: vi.fn(async () => true) }) }));
vi.mock('@/components/common/ConfirmationDialog', () => ({ ConfirmationDialog: () => null }));
vi.mock('@/services/mediaService', () => ({ deleteMedia: vi.fn() }));
vi.mock('@/services/muxAbandonment', () => ({ abandonMuxUploads: vi.fn(), flushMuxAbandonments: vi.fn(), sessionNewMuxIds: () => [] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }) } }));
vi.mock('@/components/profile/reviews/steps/StepOne', () => ({
  default: (p: any) => <div>{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => p.onChange(n)}>Rate {n}</button>)}</div>,
}));
vi.mock('@/components/profile/reviews/steps/SubjectSelectStep', () => ({ default: () => <p>Subject section</p> }));
// Faithful slice mock: a local (component-only) draft stands in for unfinished custom-tag text.
vi.mock('@/components/profile/reviews/steps/StepFour', () => ({
  default: (p: any) => {
    const [draft, setDraft] = useState('');
    return <>
      {p.part === 'text' && <textarea aria-label="Your thoughts" value={p.description} onChange={(e) => p.onDescriptionChange(e.target.value)} />}
      {p.part === 'details' && <>
        {!p.hideHeadline && <input aria-label="Review headline" value={p.title} onChange={(e) => p.onTitleChange(e.target.value)} />}
        <input aria-label="Custom tag draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </>}
      {p.part === 'visibility' && ['public', 'circle_only', 'private'].map((v) => <button key={v} onClick={() => p.onVisibilityChange(v)}>Visibility {v}</button>)}
    </>;
  },
}));
vi.mock('@/components/media/MediaUploader', () => ({
  MediaUploader: () => {
    React.useEffect(() => { mock.uploaderMounts++; return () => { mock.uploaderUnmounts++; }; }, []);
    return <video data-testid="media-el" src="blob:in-progress" />;
  },
}));
vi.mock('@/services/review/ownReview', async (original) => ({ ...(await original<any>()), findOwnReviewForEntity: async () => ({ status: 'none' }) }));
vi.mock('@/services/review/core', () => ({
  createReview: (p: any) => { mock.payload = p; return mock.save(); },
  updateReview: (_id: string, p: any) => { mock.payload = p; return mock.save(); },
}));
import { ReviewComposerScreen } from '../screen/ReviewComposerScreen';

const subject = { id: 'subject', name: 'Subject', type: 'product', metadata: null, providerName: null };
const record: any = {
  id: 'r1', user_id: 'owner', entity_id: 'subject', entity: subject, category: 'product', title: 'Subject', subtitle: 'Old headline',
  description: 'Old text', rating: 3, visibility: 'public', media: [], experience_date: null,
  metadata: { provenance: { source: 'x' }, questionnaire: { version: 1, type: 'product', answers: { future_key: 'keep' } } },
};
const loaded: any = { record, review: record, display: { ...subject }, contextLine: null, destination: '/entity/subject' };
const createProps: any = { mode: 'create-review', preselected: { subject, display: loaded.display }, userId: 'owner', cancelTo: '/' };
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}
beforeEach(() => { mock.save.mockReset(); mock.save.mockReturnValue(new Promise(() => {})); mock.payload = null; mock.uploaderMounts = 0; mock.uploaderUnmounts = 0; });
afterEach(cleanup);

describe('single-page review composer', () => {
  it('renders every section together with no step navigation', () => {
    render(<ReviewComposerScreen {...createProps} />, { wrapper });
    expect(screen.getByText('Rate 5')).toBeInTheDocument();
    expect(screen.getByText('Subject section')).toBeInTheDocument();
    expect(screen.getByLabelText('Your thoughts')).toBeInTheDocument();
    expect(screen.getByTestId('media-el')).toBeInTheDocument();
    expect(screen.getByText('Visibility circle_only')).toBeInTheDocument();
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.queryByText('Back')).toBeNull();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('collapsed details stay mounted but hidden; values and local drafts survive collapse/reopen', () => {
    render(<ReviewComposerScreen {...createProps} />, { wrapper });
    const toggle = screen.getByRole('button', { name: /Add more details/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById('composer-details-panel')!;
    expect(panel.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(panel.hidden).toBe(false);
    expect(screen.queryByLabelText('Review headline')).toBeNull();
    fireEvent.change(screen.getByLabelText('Custom tag draft'), { target: { value: 'unfinished tag' } });
    fireEvent.click(toggle);
    expect(panel.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(screen.getByLabelText('Custom tag draft')).toHaveValue('unfinished tag');
  });

  it('the media element keeps its mounted lifecycle through rating, text, details and visibility changes', () => {
    render(<ReviewComposerScreen {...createProps} />, { wrapper });
    const el = screen.getByTestId('media-el');
    for (const n of [1, 2, 3, 4, 5]) fireEvent.click(screen.getByText(`Rate ${n}`));
    fireEvent.change(screen.getByLabelText('Your thoughts'), { target: { value: 'typing' } });
    const toggle = screen.getByRole('button', { name: /Add more details/ });
    fireEvent.click(toggle); fireEvent.click(toggle);
    fireEvent.click(screen.getByText('Visibility private'));
    fireEvent.click(screen.getByText('Visibility public'));
    expect(screen.getByTestId('media-el')).toBe(el);
    expect(el.getAttribute('src')).toBe('blob:in-progress');
    expect(mock.uploaderMounts).toBe(1);
    expect(mock.uploaderUnmounts).toBe(0);
  });

  it('submit without a rating validates the whole form, saves nothing and focuses the rating', async () => {
    render(<ReviewComposerScreen {...createProps} />, { wrapper });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('composer-section-rating'));
    expect(mock.save).not.toHaveBeenCalled();
  });

  it('create payload carries exactly the entered values', async () => {
    render(<ReviewComposerScreen {...createProps} />, { wrapper });
    fireEvent.click(screen.getByText('Rate 4'));
    fireEvent.change(screen.getByLabelText('Your thoughts'), { target: { value: 'Great product' } });
    fireEvent.click(screen.getByText('Visibility circle_only'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mock.save).toHaveBeenCalledOnce());
    expect(mock.payload).toMatchObject({
      entity_id: 'subject', rating: 4, description: 'Great product', subtitle: '', visibility: 'circle_only', media: [],
    });
  });

  it('edit keeps historical metadata and sends only changed values', async () => {
    render(<ReviewComposerScreen mode="edit-review" loaded={loaded} userId="owner" cancelTo="/" />, { wrapper });
    fireEvent.change(screen.getByLabelText('Your thoughts'), { target: { value: 'Updated text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mock.save).toHaveBeenCalledOnce());
    expect(mock.payload.description).toBe('Updated text');
    expect(mock.payload.rating).toBe(3);
    expect(mock.payload.subtitle).toBe('Old headline');
    if (mock.payload.metadata) expect(mock.payload.metadata.questionnaire.answers.future_key).toBe('keep');
  });
});
