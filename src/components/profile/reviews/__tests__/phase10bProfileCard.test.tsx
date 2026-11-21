import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ReviewCard from '@/components/profile/reviews/ReviewCard';

const auth = vi.hoisted(() => ({ user: { id: 'visitor-1', email: null as string | null } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(() => Promise.resolve({ data: false })) } }));
vi.mock('@/components/reviews/ReviewOwnerMenu', () => ({ ReviewOwnerMenu: () => null }));
vi.mock('@/components/feed/PostMediaDisplay', () => ({ PostMediaDisplay: () => null }));
vi.mock('@/components/profile/reviews/ReviewTimelineViewer', () => ({ ReviewTimelineViewer:
  ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="viewer" /> : null),
}));

const make = (answers: Record<string, unknown> | null, extra: Record<string, unknown> = {}, row: Record<string, unknown> = {}) => ({
  id: 'r1', user_id: 'owner-1', title: 'Dune', category: 'movie', rating: 5, created_at: '2026-01-01T00:00:00Z',
  description: 'Narrative', likes: 0, metadata: answers ? { questionnaire: { version: 1, type: 'movie', answers }, ...extra } : extra,
  ...row,
}) as never;

const renderCard = (review: never, showTimelineFeatures = false) =>
  render(<MemoryRouter><ReviewCard review={review} onLike={vi.fn()} refreshReviews={vi.fn(async () => {})} showTimelineFeatures={showTimelineFeatures} /></MemoryRouter>);

describe('Phase 10B Step 4 — profile review card', () => {
  it('visitor can open View Details on a standalone review but sees no Start Timeline', async () => {
    auth.user = { id: 'visitor-1', email: null };
    renderCard(make(null));
    expect(screen.queryByRole('button', { name: /start timeline/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(screen.getByTestId('viewer')).toBeInTheDocument();
  });

  it('owner sees View Details and Start Timeline', () => {
    auth.user = { id: 'owner-1', email: null };
    renderCard(make(null), true);
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start timeline/i })).toBeInTheDocument();
  });

  it('visitor can open View Timeline on a review with updates', async () => {
    auth.user = { id: 'visitor-1', email: null };
    renderCard(make(null, {}, { has_timeline: true, timeline_count: 2 }));
    expect(screen.queryByRole('button', { name: /view details/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /view timeline/i }));
    expect(screen.getByTestId('viewer')).toBeInTheDocument();
  });

  it('shows the explicit No recommendation on a 5.0 review', () => {
    renderCard(make({ would_recommend: 'no' }));
    expect(screen.getByTestId('recommendation-badge')).toHaveTextContent("Doesn't recommend");
  });

  it('hides the recommendation behind an unrevealed spoiler', () => {
    renderCard(make({ would_recommend: 'yes' }, { contains_spoilers: true }));
    expect(screen.queryByTestId('recommendation-badge')).toBeNull();
  });
});
