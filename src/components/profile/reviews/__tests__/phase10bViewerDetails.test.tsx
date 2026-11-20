import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ReviewTimelineViewer } from '../ReviewTimelineViewer';
import { fetchReviewWithSummary } from '@/services/reviewService';
import { fetchReviewUpdates } from '@/services/review/timeline';

vi.mock('@/hooks/useReviewComposerNavigate', () => ({
  useReviewComposerNavigate: () => ({ open: (_a: unknown, legacy: () => void) => legacy(), isPending: false, isResolved: true, implementation: 'legacy' }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'reader-1' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/reviewService', () => ({ fetchReviewWithSummary: vi.fn() }));
vi.mock('@/services/review/timeline', () => ({
  fetchReviewUpdates: vi.fn(),
  fetchLatestRecommendationIntent: vi.fn().mockResolvedValue({ status: 'none' }),
  addReviewUpdate: vi.fn(), deleteLatestReviewUpdate: vi.fn(), editLatestReviewUpdate: vi.fn(),
}));
vi.mock('@/components/ui/connected-rings', () => ({
  ConnectedRingsRating: ({ value }: { value: number }) => <div data-testid="connected-rings">Rating: {value}</div>,
}));

const questionnaire = { questionnaire: { version: 1, type: 'movie', answers: { would_recommend: 'no', repeat_intent: 'maybe', attribute_ratings: { story: 4 } } } };
const review = (metadata: unknown, extra: Record<string, unknown> = {}) => ({
  id: 'review-1', user_id: 'owner-1', category: 'movie', rating: 4, latest_rating: 4,
  timeline_count: 0, has_timeline: false, metadata, created_at: '2026-01-01T00:00:00Z',
  subtitle: 'Secret headline', description: 'Secret narrative',
  user: { id: 'owner-1', username: 'owner', displayName: 'Owner' }, ...extra,
});
const update = {
  id: 'u1', review_id: 'review-1', user_id: 'owner-1', rating: 5, comment: 'Later thoughts',
  would_recommend: 'auto', created_at: '2026-02-01T00:00:00Z', media: [],
  user: { displayName: 'Owner' }, profiles: { username: 'owner' },
};

const open = () => render(
  <MemoryRouter>
    <ReviewTimelineViewer isOpen onClose={vi.fn()} reviewId="review-1" reviewOwnerId="owner-1" reviewTitle="Heat" initialRating={4} />
  </MemoryRouter>,
);

beforeEach(() => vi.mocked(fetchReviewUpdates).mockResolvedValue([] as never));

describe('Phase 10B viewer integration', () => {
  it('standalone: Review title/badge, full details, no timeline-only sections', async () => {
    vi.mocked(fetchReviewWithSummary).mockResolvedValue(review(questionnaire) as never);
    open();
    expect(await screen.findByText('Secret narrative')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review for "Heat"' })).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.queryByText('Initial Review')).toBeNull();
    expect(screen.getByText('Secret headline')).toBeInTheDocument();
    expect(screen.getByTestId('recommendation-badge')).toHaveTextContent("Doesn't recommend");
    expect(screen.getByRole('img', { name: 'Story: 4 of 5' })).toBeInTheDocument();
    expect(screen.queryByText(/AI summary is being generated/)).toBeNull();
    expect(screen.queryByText('No timeline updates yet.')).toBeNull();
    // rating-derived materialized card is not shown as an author selection
    expect(screen.queryByText('Recommended')).toBeNull();
  });

  it('omits the details block when nothing is saved', async () => {
    vi.mocked(fetchReviewWithSummary).mockResolvedValue(review(null) as never);
    open();
    await screen.findByText('Secret narrative');
    expect(screen.queryByTestId('review-questionnaire-details')).toBeNull();
  });

  it('spoiler: headline, narrative and details unmounted until reveal, then shown together', async () => {
    vi.mocked(fetchReviewWithSummary).mockResolvedValue(review({ ...questionnaire, contains_spoilers: true }) as never);
    open();
    const reveal = await screen.findByRole('button', { name: /show review/i });
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByTestId('connected-rings')).toBeInTheDocument();
    expect(screen.queryByText('Secret headline')).toBeNull();
    expect(screen.queryByText('Secret narrative')).toBeNull();
    expect(screen.queryByTestId('review-questionnaire-details')).toBeNull();
    await userEvent.setup().click(reveal);
    expect(screen.getByText('Secret headline')).toBeInTheDocument();
    expect(screen.getByText('Secret narrative')).toBeInTheDocument();
    expect(screen.getByTestId('review-questionnaire-details')).toBeInTheDocument();
  });

  it('timeline: keeps Timeline title, details only on initial review, update keeps its own recommendation', async () => {
    vi.mocked(fetchReviewWithSummary).mockResolvedValue(review(questionnaire, { timeline_count: 1, has_timeline: true }) as never);
    vi.mocked(fetchReviewUpdates).mockResolvedValue([update] as never);
    open();
    expect(await screen.findByText('Later thoughts')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Timeline for "Heat"' })).toBeInTheDocument();
    expect(screen.getByText('Initial Review')).toBeInTheDocument();
    expect(screen.getAllByTestId('review-questionnaire-details')).toHaveLength(1);
    expect(screen.getAllByTestId('recommendation-badge')).toHaveLength(1);
  });
});
