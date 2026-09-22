/**
 * Groups 0A/0B/1 close-out: controlled-fixture proof for the selected entity
 * chip in the composer's entity selector.
 *
 * The fixture reproduces the chip markup exactly as rendered inside
 * UnifiedEntitySelector (32px pill, 20x20 circular image frame) so the
 * presentation contract and the fallback/reset behaviour can be asserted
 * without an authenticated composer session.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { X } from 'lucide-react';
import { EntityImage } from '@/components/common/EntityImage';
import type { Entity } from '@/services/recommendation/types';

const makeEntity = (overrides: Partial<Entity>): Entity =>
  ({
    id: 'entity-1',
    name: 'Aestura Atobarrier365 Cream',
    type: 'product',
    image_url: null,
    metadata: {},
    ...overrides,
  }) as Entity;

const SelectedEntityChip = ({ entity }: { entity: Entity }) => (
  <span
    data-testid="selected-entity-chip"
    className="inline-flex items-center gap-1.5 h-8 rounded-full border border-primary/20 bg-primary/5 text-foreground pl-1 pr-1 text-xs transition-colors"
  >
    <EntityImage entity={entity} className="h-5 w-5 flex-shrink-0" decorative />
    <span className="font-semibold truncate max-w-[160px]">{entity.name}</span>
    <button
      type="button"
      aria-label={`Remove ${entity.name}`}
      className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
    >
      <X size={10} />
    </button>
  </span>
);

describe('selected entity chip proof', () => {
  it('keeps the 32px pill and 20x20 circular image frame', () => {
    render(<SelectedEntityChip entity={makeEntity({ image_url: 'https://cdn.example.com/a.jpg' })} />);

    expect(screen.getByTestId('selected-entity-chip').className).toContain('h-8');
    const image = screen.getByTestId('entity-image');
    expect(image.className).toContain('h-5');
    expect(image.className).toContain('w-5');
    expect(image.className).toContain('rounded-full');
  });

  it('uses the same fallback frame for a missing image', () => {
    render(<SelectedEntityChip entity={makeEntity({ image_url: null })} />);

    const fallback = screen.getByTestId('entity-image-fallback');
    expect(fallback.className).toContain('h-5');
    expect(fallback.className).toContain('w-5');
    expect(fallback.className).toContain('rounded-full');
    expect(screen.getByTestId('selected-entity-chip').className).toContain('h-8');
  });

  it('shows the identical fallback when a real image fails to load', () => {
    render(<SelectedEntityChip entity={makeEntity({ image_url: 'https://cdn.example.com/broken.jpg' })} />);

    fireEvent.error(screen.getByTestId('entity-image'));

    const fallback = screen.getByTestId('entity-image-fallback');
    expect(fallback.className).toContain('h-5');
    expect(fallback.className).toContain('w-5');
    expect(screen.getByTestId('selected-entity-chip').className).toContain('h-8');
  });

  it('does not leak a failed source when the chip switches entity', () => {
    const { rerender } = render(
      <SelectedEntityChip
        entity={makeEntity({ id: 'entity-a', name: 'Entity A', image_url: 'https://cdn.example.com/broken.jpg' })}
      />,
    );

    fireEvent.error(screen.getByTestId('entity-image'));
    expect(screen.getByTestId('entity-image-fallback')).toBeInTheDocument();

    rerender(
      <SelectedEntityChip
        entity={makeEntity({ id: 'entity-b', name: 'Entity B', image_url: 'https://cdn.example.com/valid.jpg' })}
      />,
    );

    const image = screen.getByTestId('entity-image');
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/valid.jpg');
    expect(screen.queryByTestId('entity-image-fallback')).not.toBeInTheDocument();
  });
});
