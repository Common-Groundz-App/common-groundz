import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EntityImage, getEntityFallbackIcon } from './EntityImage';
import { CANONICAL_ENTITY_TYPES } from '@/services/entityType';
import { EntityType, type Entity } from '@/services/recommendation/types';

const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'entity-1',
  name: 'Test entity',
  type: EntityType.Product,
  ...overrides,
});

describe('EntityImage', () => {
  it('uses a stored photo before image_url', () => {
    render(
      <EntityImage
        entity={makeEntity({
          image_url: 'https://example.com/direct.jpg',
          metadata: {
            stored_photo_urls: [{
              storedUrl: 'https://example.com/stored.jpg',
              reference: 'stored-photo',
              width: 200,
              height: 200,
            }],
          },
        })}
      />,
    );

    expect(screen.getByRole('img', { name: 'Test entity' })).toHaveAttribute(
      'src',
      'https://example.com/stored.jpg',
    );
  });

  it('uses the same local fallback for missing and broken sources', () => {
    const { rerender } = render(<EntityImage entity={makeEntity()} />);
    expect(screen.getByTestId('entity-image-fallback')).toBeInTheDocument();

    rerender(
      <EntityImage entity={makeEntity({ image_url: 'https://example.com/broken.jpg' })} />,
    );
    fireEvent.error(screen.getByTestId('entity-image'));
    expect(screen.getByTestId('entity-image-fallback')).toBeInTheDocument();
  });

  it('resets a failed source when the entity image changes', () => {
    const { rerender } = render(
      <EntityImage entity={makeEntity({ image_url: 'https://example.com/old.jpg' })} />,
    );
    fireEvent.error(screen.getByTestId('entity-image'));

    rerender(
      <EntityImage
        entity={makeEntity({ id: 'entity-2', image_url: 'https://example.com/new.jpg' })}
      />,
    );
    expect(screen.getByTestId('entity-image')).toHaveAttribute(
      'src',
      'https://example.com/new.jpg',
    );
  });

  it('defines a fallback for every canonical type and unknown input', () => {
    for (const type of CANONICAL_ENTITY_TYPES) {
      expect(getEntityFallbackIcon(type)).toBeTypeOf('object');
    }
    expect(getEntityFallbackIcon('not-a-real-type')).toBe(getEntityFallbackIcon(undefined));
  });

  it('supports decorative and informative accessibility modes', () => {
    const { rerender } = render(<EntityImage entity={makeEntity()} decorative />);
    expect(screen.getByTestId('entity-image-fallback')).toHaveAttribute('aria-hidden', 'true');

    rerender(<EntityImage entity={makeEntity()} />);
    expect(screen.getByRole('img', { name: 'Test entity' })).toBeInTheDocument();
  });
});