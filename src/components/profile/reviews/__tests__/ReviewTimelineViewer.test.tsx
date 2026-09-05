import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { ReviewTimelineViewer } from '../ReviewTimelineViewer';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/services/reviewService', () => ({
  fetchReviewWithSummary: vi.fn().mockResolvedValue({
    id: 'review-1',
    user_id: 'owner-1',
    category: 'movie',
    rating: 5,
    latest_rating: 5,
    timeline_count: 0,
    has_timeline: false,
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    user: { id: 'owner-1', username: 'owner', displayName: 'Owner' },
  }),
}));

vi.mock('@/services/review/timeline', () => ({
  fetchReviewUpdates: vi.fn().mockResolvedValue([]),
  fetchLatestRecommendationIntent: vi.fn().mockResolvedValue({ status: 'none' }),
  addReviewUpdate: vi.fn().mockResolvedValue(true),
  deleteLatestReviewUpdate: vi.fn().mockResolvedValue('deleted'),
}));

vi.mock('@/components/ui/connected-rings', () => ({
  ConnectedRingsRating: ({ value }: { value: number }) => (
    <div data-testid="connected-rings">Rating: {value}</div>
  ),
}));

vi.mock('@/components/media/MediaUploader', () => ({
  MediaUploader: ({ onMediaUploaded }: { onMediaUploaded: (m: unknown) => void }) => (
    <button data-testid="media-uploader" onClick={() => onMediaUploaded({ id: 'm1' })}>
      Upload
    </button>
  ),
}));

vi.mock('../questionnaire/ChoiceChips', () => ({
  default: ({ label, options, value, onChange }: {
    label: string;
    options: readonly { value: string; label: string }[];
    value?: string;
    onChange: (v: string | null) => void;
  }) => (
    <fieldset>
      <legend>{label}</legend>
      {options.map((opt) => (
        <label key={opt.value}>
          <input
            type="radio"
            name="recommendation-intent"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            aria-label={opt.label}
          />
          {opt.label}
        </label>
      ))}
      <button onClick={() => onChange(null)}>Clear</button>
    </fieldset>
  ),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ReviewTimelineViewer recommendation UI', () => {
  it('renders the three explicit recommendation chips', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <ReviewTimelineViewer
        isOpen={true}
        onClose={vi.fn()}
        reviewId="review-1"
        reviewOwnerId="owner-1"
        reviewTitle="Test Review"
        initialRating={5}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Add Timeline Update' }));

    expect(await screen.findByText('Would you still recommend it?')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Maybe' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'No' })).toBeInTheDocument();
  });

  it('shows the "Base recommendation on rating" reset control', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <ReviewTimelineViewer
        isOpen={true}
        onClose={vi.fn()}
        reviewId="review-1"
        reviewOwnerId="owner-1"
        reviewTitle="Test Review"
        initialRating={5}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Add Timeline Update' }));

    expect(await screen.findByRole('button', { name: 'Base recommendation on rating' })).toBeInTheDocument();
  });

  it('selecting a chip clears the reset control', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <ReviewTimelineViewer
        isOpen={true}
        onClose={vi.fn()}
        reviewId="review-1"
        reviewOwnerId="owner-1"
        reviewTitle="Test Review"
        initialRating={5}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Add Timeline Update' }));

    const resetButton = await screen.findByRole('button', { name: 'Base recommendation on rating' });
    await user.click(resetButton);
    expect(resetButton.className).toContain('bg-primary');

    await user.click(screen.getByRole('radio', { name: 'No' }));
    expect(resetButton.className).not.toContain('bg-primary');
  });
});
