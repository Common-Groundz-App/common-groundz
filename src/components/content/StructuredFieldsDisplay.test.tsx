import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StructuredFieldsDisplay from './StructuredFieldsDisplay';

vi.mock('@/components/recommendations/ConnectedRingsRating', () => ({
  default: ({ value, variant }: { value: number; variant?: string }) => (
    <div data-testid="connected-rings-rating" data-variant={variant}>{value}</div>
  ),
}));

describe('StructuredFieldsDisplay rating reconciliation', () => {
  it('uses the compact rating for a valid Review when enabled', () => {
    render(<StructuredFieldsDisplay data={{ rating: 4.5 }} postType="review" />);

    expect(screen.getByTestId('connected-rings-rating')).toHaveTextContent('4.5');
    expect(screen.getByTestId('connected-rings-rating')).toHaveAttribute('data-variant', 'badge');
  });

  it('renders nothing when rating suppression leaves no visible fields', () => {
    const { container } = render(
      <StructuredFieldsDisplay data={{ rating: 4 }} postType="review" showRating={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps non-rating Review fields when rating is suppressed', () => {
    render(
      <StructuredFieldsDisplay
        data={{ rating: 4, what_worked: 'Comfortable all day' }}
        postType="review"
        showRating={false}
      />,
    );

    expect(screen.queryByTestId('connected-rings-rating')).not.toBeInTheDocument();
    expect(screen.getByText('Comfortable all day')).toBeInTheDocument();
  });

  it('ignores a stray rating on non-Review types', () => {
    const { container } = render(
      <StructuredFieldsDisplay data={{ rating: 4 }} postType="recommendation" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});