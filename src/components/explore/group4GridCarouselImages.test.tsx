import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { EntityCollectionImage } from '@/components/entity/EntityCollectionImage';

/**
 * Group 4 — explore grids and entity collections (featured entities, all three
 * category-highlight branches, the sibling strip, the related-items grid).
 *
 * Those surfaces are data-heavy (explore hooks, Supabase, routing), so the
 * migrated decision is proven where it lives: the shared renderer they all mount
 * inside their own, unchanged wrapper elements. The per-surface contract is
 * expressed here through the exact props each surface passes.
 */

// Registered legacy stock placeholder (must be treated as missing).
const REGISTERED_PLACEHOLDER = 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&q=80&w=1000';
// A legitimate, unregistered Unsplash photo (must keep rendering as a real image).
const LEGITIMATE_UNSPLASH = 'https://images.unsplash.com/photo-9999999999999-abcdefabcdef?w=800';

const explorePhoto = 'https://cdn.example.com/stored-photo.jpg';
const rawPhoto = 'https://cdn.example.com/raw-image-url.jpg';

/** Explore surfaces pass the whole entity (optimal resolution, as today). */
const exploreSource = {
  id: 'e1',
  image_url: rawPhoto,
  metadata: { stored_photo_urls: [{ storedUrl: explorePhoto }] },
};

/** Sibling strip and related grid pass only their current raw source. */
const rawSource = { id: 'e1', image_url: rawPhoto };

describe('Group 4 — real-image precedence is preserved per surface', () => {
  it('keeps optimal resolution on explore surfaces (stored metadata photo wins)', () => {
    render(
      <EntityCollectionImage
        source={exploreSource}
        type="place"
        name="Blue Tokai"
        imageClassName="h-full w-full object-cover"
        iconClassName="h-10 w-10"
      />,
    );
    expect(screen.getByTestId('entity-collection-photo')).toHaveAttribute('src', explorePhoto);
  });

  it('keeps raw image_url precedence on the sibling strip and related grid', () => {
    render(
      <EntityCollectionImage
        source={rawSource}
        type="product"
        name="Attibele Roast"
        imageClassName="w-full h-full object-cover group-hover:scale-105 transition-transform"
        iconClassName="h-10 w-10"
      />,
    );
    const photo = screen.getByTestId('entity-collection-photo');
    expect(photo).toHaveAttribute('src', rawPhoto);
    // A stored metadata photo cannot replace it, because it is never passed in.
    expect(photo.getAttribute('src')).not.toBe(explorePhoto);
  });

  it('preserves the surface image classes, including hover zoom where it exists', () => {
    const { unmount } = render(
      <EntityCollectionImage
        source={rawSource}
        type="product"
        name="Attibele Roast"
        imageClassName="w-full h-full object-cover group-hover:scale-105 transition-transform"
        iconClassName="h-10 w-10"
      />,
    );
    const withHover = screen.getByTestId('entity-collection-photo');
    expect(withHover.className).toContain('object-cover');
    expect(withHover.className).toContain('group-hover:scale-105');
    unmount();

    // Explore has no hover zoom today and must not gain one.
    render(
      <EntityCollectionImage
        source={exploreSource}
        type="place"
        name="Blue Tokai"
        imageClassName="h-full w-full object-cover"
        iconClassName="h-12 w-12"
      />,
    );
    const withoutHover = screen.getByTestId('entity-collection-photo');
    expect(withoutHover.className).toContain('object-cover');
    expect(withoutHover.className).not.toContain('scale-105');
  });

  it('renders a legitimate, unregistered Unsplash photo as a real image', () => {
    render(
      <EntityCollectionImage
        source={{ id: 'e2', image_url: LEGITIMATE_UNSPLASH }}
        type="place"
        name="Nandi Hills"
        imageClassName="h-full w-full object-cover"
        iconClassName="h-10 w-10"
      />,
    );
    expect(screen.getByTestId('entity-collection-photo')).toHaveAttribute('src', LEGITIMATE_UNSPLASH);
    expect(screen.queryByTestId('entity-collection-fallback')).toBeNull();
  });
});

describe('Group 4 — missing, broken and registered placeholders converge', () => {
  it('renders the canonical type icon with an accessible label when there is no image', () => {
    render(
      <EntityCollectionImage
        source={{ id: 'e3', image_url: null }}
        type="book"
        name="Midnight's Children"
        imageClassName="h-full w-full object-cover"
        iconClassName="h-10 w-10"
      />,
    );
    expect(screen.queryByTestId('entity-collection-photo')).toBeNull();
    const fallback = screen.getByTestId('entity-collection-fallback');
    expect(fallback).toHaveAttribute('role', 'img');
    expect(fallback).toHaveAttribute('aria-label', "No image available for Midnight's Children");
    expect(fallback.querySelector('svg')).not.toBeNull();
  });

  it('renders the identical icon for a broken image, with no second request', () => {
    render(
      <EntityCollectionImage
        source={{ id: 'e4', image_url: 'https://cdn.example.com/gone.jpg' }}
        type="book"
        name="Midnight's Children"
        imageClassName="h-full w-full object-cover"
        iconClassName="h-10 w-10"
      />,
    );
    fireEvent.error(screen.getByTestId('entity-collection-photo'));
    expect(screen.queryByTestId('entity-collection-photo')).toBeNull();
    const fallback = screen.getByTestId('entity-collection-fallback');
    expect(fallback).toHaveAttribute('aria-label', "No image available for Midnight's Children");
    expect(document.querySelectorAll('img').length).toBe(0);
  });

  it('treats a registered legacy stock placeholder as missing', () => {
    render(
      <EntityCollectionImage
        source={{ id: 'e5', image_url: REGISTERED_PLACEHOLDER }}
        type="place"
        name="Blue Tokai"
        imageClassName="h-full w-full object-cover"
        iconClassName="h-10 w-10"
      />,
    );
    expect(screen.queryByTestId('entity-collection-photo')).toBeNull();
    expect(screen.getByTestId('entity-collection-fallback')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('photo-1501854140801-50d01698950b');
  });

  it('renders the neutral icon for an unrecognised type and introduces no stock source', () => {
    const { container } = render(
      <EntityCollectionImage
        source={{ id: 'e6', image_url: null }}
        type="totally-unknown-kind"
        name="Mystery Item"
        imageClassName="h-full w-full object-cover"
        iconClassName="h-10 w-10"
      />,
    );
    expect(screen.getByTestId('entity-collection-fallback')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('placeholder.svg');
    expect(container.innerHTML).not.toContain('images.unsplash.com');
  });

  it('applies the per-surface icon size without touching the caller frame', () => {
    const { unmount } = render(
      <EntityCollectionImage
        source={{ id: 'e7', image_url: null }}
        type="place"
        name="Featured Place"
        imageClassName="h-full w-full object-cover"
        iconClassName="h-12 w-12"
      />,
    );
    expect(screen.getByTestId('entity-collection-fallback').querySelector('svg')?.getAttribute('class')).toContain('h-12');
    unmount();

    render(
      <EntityCollectionImage
        source={{ id: 'e8', image_url: null }}
        type="place"
        name="Category Place"
        imageClassName="h-full w-full object-cover"
        iconClassName="h-10 w-10"
      />,
    );
    expect(screen.getByTestId('entity-collection-fallback').querySelector('svg')?.getAttribute('class')).toContain('h-10');
  });
});
