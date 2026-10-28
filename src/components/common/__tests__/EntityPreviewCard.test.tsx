import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntityPreviewCard } from '../EntityPreviewCard';

const pin = (c: HTMLElement) => c.querySelector('svg.lucide-map-pin');

describe('EntityPreviewCard location icon', () => {
  it('shows MapPin only for a verified formatted_address', () => {
    const { container } = render(<EntityPreviewCard entity={{ name: 'Toit', metadata: { formatted_address: '100ft Rd, Bengaluru' } }} type="place" onChange={() => {}} />);
    expect(pin(container)).not.toBeNull();
  });
  it('renders an ambiguous venue neutrally without MapPin', () => {
    const { container } = render(<EntityPreviewCard entity={{ name: 'Inception', venue: 'Christopher Nolan' }} type="movie" onChange={() => {}} />);
    expect(screen.getByText('Christopher Nolan')).toBeTruthy();
    expect(pin(container)).toBeNull();
  });
  it('renders context only when passed (no duplicate for Timeline)', () => {
    const { rerender } = render(<EntityPreviewCard entity={{ name: 'Biryani' }} type="food" onChange={() => {}} contextLine="Dish at Toit" />);
    expect(screen.getAllByText('Dish at Toit')).toHaveLength(1);
    rerender(<EntityPreviewCard entity={{ name: 'Biryani' }} type="food" onChange={() => {}} />);
    expect(screen.queryByText('Dish at Toit')).toBeNull();
  });
});
