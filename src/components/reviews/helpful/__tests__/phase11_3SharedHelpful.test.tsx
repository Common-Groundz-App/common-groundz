import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpfulControl } from '../HelpfulControl';
import { ReviewHelpfulProvider } from '../ReviewHelpfulContext';
import ReviewCard from '@/components/profile/reviews/ReviewCard';
import { ReviewTimelineViewer } from '@/components/profile/reviews/ReviewTimelineViewer';
import { helpfulQueryKey } from '@/services/review/helpfulCache';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'reader', email: null } as { id: string; email: null } | null, isLoading: false },
  requireAuth: vi.fn(), toggle: vi.fn(), read: vi.fn(), summary: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/contexts/AuthPromptContext', () => ({ useAuthPrompt: () => ({ requireAuth: mocks.requireAuth }) }));
vi.mock('@/hooks/useEmailVerification', () => ({ useEmailVerification: () => ({ canPerformAction: () => true, showVerificationRequired: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useReviewComposerNavigate', () => ({ useReviewComposerNavigate: () => ({ open: vi.fn() }) }));
vi.mock('@/components/reviews/ReviewOwnerMenu', () => ({ ReviewOwnerMenu: () => null }));
vi.mock('@/components/feed/PostMediaDisplay', () => ({ PostMediaDisplay: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(async () => ({ data: false })) } }));
vi.mock('@/services/review/interactions', () => ({ toggleReviewLike: (...a: unknown[]) => mocks.toggle(...a), fetchReviewHelpfulState: (...a: unknown[]) => mocks.read(...a) }));
vi.mock('@/services/reviewService', () => ({ fetchReviewWithSummary: (...a: unknown[]) => mocks.summary(...a), updateReviewStatus: vi.fn() }));
vi.mock('@/services/review/timeline', () => ({ fetchReviewUpdates: vi.fn(async () => []), fetchLatestRecommendationIntent: vi.fn(async () => ({ status: 'none' })), toTimelineRecommendationValue: vi.fn() }));

const review = (extra = {}) => ({ id: 'root', user_id: 'author', title: 'Nandi Hills', category: 'place',
  visibility: 'public', status: 'published', rating: 4, created_at: '2026-01-01T00:00:00Z',
  description: 'Nice view.', has_timeline: false, timeline_count: 0, likes: 6, isLiked: false, ...extra }) as any;
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};
function setup(children: React.ReactNode, client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  const wrap = (node: React.ReactNode) => <MemoryRouter><QueryClientProvider client={client}><ReviewHelpfulProvider>{node}</ReviewHelpfulProvider></QueryClientProvider></MemoryRouter>;
  const result = render(wrap(children));
  return { client, ...result, redraw: (node: React.ReactNode) => result.rerender(wrap(node)) };
}
const modal = () => <ReviewTimelineViewer isOpen onClose={vi.fn()} reviewId="root" reviewOwnerId="author" reviewTitle="Nandi Hills" initialRating={4} />;

beforeEach(() => {
  mocks.auth.user = { id: 'reader', email: null }; mocks.auth.isLoading = false;
  mocks.requireAuth.mockReset().mockImplementation(() => !!mocks.auth.user);
  mocks.toggle.mockReset().mockResolvedValue({ success: true, isLiked: true });
  mocks.read.mockReset().mockResolvedValue(new Map([['root', { count: 7, isLiked: true }]]));
  const { likes, isLiked, ...saved } = review();
  mocks.summary.mockReset().mockResolvedValue(saved);
});

describe('Phase 11.3 shared Helpful', () => {
  it.each([false, true])('profile card remains votable in compact=%s mode', async compact => {
    setup(<ReviewCard review={review()} compact={compact} refreshReviews={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark as Helpful/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Remove Helpful vote \(7/ })).toBeEnabled());
    expect(mocks.toggle).toHaveBeenCalledExactlyOnceWith('root');
    expect(screen.getByRole('button', { name: /View Details/ })).toBeInTheDocument();
  });

  it.each([0, 12])('public authors get a passive count of %s', count => {
    mocks.auth.user = { id: 'author', email: null };
    setup(<ReviewCard review={review({ likes: count })} refreshReviews={vi.fn()} />);
    expect(screen.getByText(`${count} found this helpful`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Helpful/ })).toBeNull();
  });

  it('private reviews omit Helpful without removing View Details', () => {
    mocks.auth.user = { id: 'author', email: null };
    setup(<ReviewCard review={review({ visibility: 'private' })} refreshReviews={vi.fn()} />);
    expect(screen.queryByText(/found this helpful/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Helpful/ })).toBeNull();
    expect(screen.getByRole('button', { name: /View Details/ })).toBeInTheDocument();
  });

  it('guest counts remain visible and tapping uses existing auth gating', () => {
    mocks.auth.user = null;
    setup(<ReviewCard review={review()} refreshReviews={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark as Helpful \(6/ }));
    expect(mocks.requireAuth).toHaveBeenCalledWith({ action: 'helpful_review', surface: 'profile_review_card' });
    expect(mocks.toggle).not.toHaveBeenCalled();
  });

  it('card and modal share seed, one pending lock and one optimistic increment', async () => {
    const initialRead = deferred<Map<string, any>>();
    const toggle = deferred<any>();
    mocks.read.mockImplementationOnce(() => initialRead.promise);
    mocks.toggle.mockImplementationOnce(() => toggle.promise);
    const client = new QueryClient();
    client.setQueryData(['entity-detail', 'nandi', 'reader'], { reviews: [review()] });
    client.setQueryData(['reviews', 'author', 'reader'], [review()]);
    setup(<><HelpfulControl review={review()} />{modal()}</>, client);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Mark as Helpful \(6/, hidden: true })).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: /Mark as Helpful/ }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Remove Helpful vote \(7/, hidden: true })).toHaveLength(2));
    for (const button of screen.getAllByRole('button', { name: /Helpful vote/, hidden: true })) expect(button).toBeDisabled();
    expect(client.getQueryData<any>(['reviews', 'author', 'reader'])[0].likes).toBe(7);
    expect(client.getQueryData<any>(['entity-detail', 'nandi', 'reader']).reviews[0].likes).toBe(7);
    fireEvent.click(screen.getAllByRole('button', { name: /Helpful vote/, hidden: true })[0]);
    expect(mocks.toggle).toHaveBeenCalledTimes(1);
    await act(async () => { initialRead.resolve(new Map([['root', { count: 1, isLiked: false }]])); toggle.resolve({ success: true, isLiked: true }); });
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Remove Helpful vote \(7/, hidden: true })[0]).toBeEnabled());
    expect(client.getQueryData<any>(helpfulQueryKey('root', 'reader')).likes).toBe(7);
  });

  it('missing modal data is loading, not zero; closing discards the pending read', async () => {
    const read = deferred<Map<string, any>>(); mocks.read.mockImplementationOnce(() => read.promise);
    const result = setup(modal());
    expect(await screen.findByLabelText('Loading Helpful')).toBeInTheDocument();
    expect(screen.queryByText('0 found this helpful')).toBeNull();
    result.redraw(<div>Closed</div>);
    await act(async () => read.resolve(new Map([['root', { count: 99, isLiked: true }]])));
    expect(result.client.getQueryData(helpfulQueryKey('root', 'reader'))).toBeUndefined();
  });

  it('uncertain toggles reconcile once without retrying the mutation', async () => {
    mocks.toggle.mockResolvedValue({ success: false, error: 'Timeout', ambiguous: true });
    setup(<HelpfulControl review={review()} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark as Helpful/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Remove Helpful vote \(7/ })).toBeEnabled());
    expect(mocks.toggle).toHaveBeenCalledTimes(1);
  });

  it('switching reviews ignores both the old summary and old Helpful read', async () => {
    const oldSummary = deferred<any>();
    mocks.summary.mockImplementationOnce(() => oldSummary.promise);
    const result = setup(modal());
    const other = review({ id: 'other-root', title: 'Other review' });
    mocks.summary.mockResolvedValue(other);
    mocks.read.mockResolvedValue(new Map([['other-root', { count: 8, isLiked: false }]]));
    result.redraw(<ReviewTimelineViewer isOpen onClose={vi.fn()} reviewId="other-root" reviewOwnerId="author" reviewTitle="Other review" initialRating={4} />);
    await screen.findByRole('button', { name: /Mark as Helpful \(8/ });
    await act(async () => oldSummary.resolve(review({ likes: 99 })));
    expect(screen.getByRole('button', { name: /Mark as Helpful \(8/ })).toBeInTheDocument();
    expect(result.client.getQueryData(helpfulQueryKey('root', 'reader'))).toBeUndefined();
  });

  it('auth resolution shows loading without a vote action or viewer read', () => {
    mocks.auth.isLoading = true;
    setup(<HelpfulControl review={review()} reconcile />);
    expect(screen.getByLabelText('Loading Helpful')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Helpful/ })).toBeNull();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('Private details never fetch or expose Helpful', async () => {
    mocks.auth.user = { id: 'author', email: null };
    mocks.summary.mockResolvedValue(review({ visibility: 'private' }));
    setup(modal());
    await screen.findByText('Nice view.');
    expect(screen.queryByText(/found this helpful/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Helpful/ })).toBeNull();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('confirmed rejection restores both controls', async () => {
    mocks.toggle.mockResolvedValue({ success: false, error: 'Rejected', ambiguous: false });
    setup(<><HelpfulControl review={review()} /><HelpfulControl review={review()} /></>);
    fireEvent.click(screen.getAllByRole('button', { name: /Mark as Helpful/ })[0]);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Mark as Helpful \(6/ })[0]).toBeEnabled());
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('account switch during a vote clears old partitions and rejects late A → B → A responses', async () => {
    const toggle = deferred<any>(); mocks.toggle.mockImplementationOnce(() => toggle.promise);
    const result = setup(<HelpfulControl review={review()} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark as Helpful/ }));
    await waitFor(() => expect(mocks.toggle).toHaveBeenCalledTimes(1));
    mocks.auth.user = { id: 'other', email: null };
    result.redraw(<HelpfulControl review={review({ likes: 6 })} />);
    expect(result.client.getQueryData(helpfulQueryKey('root', 'reader'))).toBeUndefined();
    expect(screen.getByRole('button', { name: /Mark as Helpful/ })).toHaveAttribute('aria-pressed', 'false');
    mocks.auth.user = { id: 'reader', email: null };
    result.redraw(<HelpfulControl review={review({ likes: 6 })} />);
    await act(async () => toggle.resolve({ success: true, isLiked: true }));
    expect(screen.getByRole('button', { name: /Mark as Helpful \(6/ })).toBeEnabled();
    expect(mocks.read).not.toHaveBeenCalled();
    mocks.auth.user = null;
    result.redraw(<HelpfulControl review={review()} />);
    expect(result.client.getQueryData(helpfulQueryKey('root', 'reader'))).toBeUndefined();
  });
});