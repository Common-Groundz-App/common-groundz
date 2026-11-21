import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ReviewCard from '@/components/ReviewCard';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'reader-1' } }) }));
vi.mock('@/components/reviews/ReviewOwnerMenu', () => ({ ReviewOwnerMenu: () => null }));
vi.mock('@/components/media/ReviewMediaBlock', () => ({ ReviewMediaBlock: () => <div data-testid="media" /> }));
vi.mock('@/components/ui/connected-rings', () => ({ ConnectedRingsRating: () => <div data-testid="rings" /> }));

const make = (answers: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({
  id: 'r1', user_id: 'owner-1', category: 'movie', rating: 5, created_at: '2026-01-01T00:00:00Z',
  subtitle: null, description: 'Narrative', likes: 0, is_verified: false,
  metadata: answers ? { questionnaire: { version: 1, type: 'movie', answers }, ...extra } : extra,
  user: { id: 'owner-1', username: 'owner', displayName: 'Owner', avatar_url: null },
}) as never;

const renderCard = (review: never, onTimelineClick = vi.fn()) => {
  render(<MemoryRouter><ReviewCard review={review} onTimelineClick={onTimelineClick} /></MemoryRouter>);
  return onTimelineClick;
};

describe('Phase 10B Step 3 — entity review card signals', () => {
  it('shows the explicit No recommendation on a 5.0 review, not a rating-derived one', () => {
    renderCard(make({ would_recommend: 'no' }));
    expect(screen.getByTestId('recommendation-badge')).toHaveTextContent("Doesn't recommend");
  });

  it('shows the saved Maybe repeat-intent answer', () => {
    renderCard(make({ repeat_intent: 'maybe' }));
    expect(screen.getByTestId('repeat-intent-badge')).toHaveTextContent('Might watch again');
    expect(screen.queryByTestId('recommendation-badge')).toBeNull();
  });

  it('shows Might recommend for a saved Maybe recommendation', () => {
    renderCard(make({ would_recommend: 'maybe' }));
    expect(screen.getByTestId('recommendation-badge')).toHaveTextContent('Might recommend');
  });

  it('shows no badges when nothing was answered, but View Details still opens the viewer', async () => {
    const onClick = renderCard(make(null));
    expect(screen.queryByTestId('compact-review-signals')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('keeps badges unmounted behind an unrevealed spoiler while View Details stays available', async () => {
    renderCard(make({ would_recommend: 'yes' }, { contains_spoilers: true }));
    expect(screen.queryByTestId('compact-review-signals')).toBeNull();
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /show review/i }));
    expect(screen.getByTestId('recommendation-badge')).toHaveTextContent('Recommends');
  });
});
