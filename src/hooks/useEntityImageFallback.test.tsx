import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEntityImageFallback } from './useEntityImageFallback';

function Harness({ id, imageUrl }: { id: string; imageUrl: string | null }) {
  const image = useEntityImageFallback({ id, image_url: imageUrl });
  return image.showFallback ? (
    <span data-testid="fallback" />
  ) : (
    <img data-testid="image" src={image.imageUrl ?? undefined} onError={image.markImageFailed} />
  );
}

describe('useEntityImageFallback', () => {
  it('uses the same fallback for missing and broken sources', () => {
    const { rerender } = render(<Harness id="one" imageUrl={null} />);
    expect(screen.getByTestId('fallback')).toBeInTheDocument();

    rerender(<Harness id="one" imageUrl="https://example.com/broken.jpg" />);
    fireEvent.error(screen.getByTestId('image'));
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('resets failure state when the entity or source changes', () => {
    const { rerender } = render(
      <Harness id="one" imageUrl="https://example.com/old.jpg" />,
    );
    fireEvent.error(screen.getByTestId('image'));

    rerender(<Harness id="two" imageUrl="https://example.com/new.jpg" />);
    expect(screen.getByTestId('image')).toHaveAttribute(
      'src',
      'https://example.com/new.jpg',
    );
  });
});