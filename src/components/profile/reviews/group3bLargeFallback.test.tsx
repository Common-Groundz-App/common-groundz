import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { EntityCardFallbackImage } from '@/components/cards/EntityCardFallbackImage';
import {
  getAuthorMediaItems,
  shouldShowAuthorMedia,
  shouldRenderEntityFallbackArea,
} from '@/components/cards/entityCardMediaSources';

/**
 * Group 3B — the large subject-image area on the profile review and
 * recommendation cards.
 *
 * The cards themselves are large, context-dependent surfaces (auth, toasts,
 * Supabase, dropdown portals), so the migrated behaviour is proven where it
 * lives: the shared source-classification helpers both cards now call, and the
 * shared large-image renderer they both mount.
 */

const authorMedia = [{ id: 'm1', url: 'https://cdn.example.com/author.jpg', type: 'image' as const, order: 0 }];

describe('Group 3B — author media vs subject image precedence', () => {
  it('keeps author media as the winning source', () => {
    const items = getAuthorMediaItems({ id: 'r1', media: authorMedia, image_url: 'https://cdn.example.com/legacy.jpg' });
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://cdn.example.com/author.jpg');
    expect(shouldShowAuthorMedia({ hasMediaArray: true, authorMediaCount: 1, hideEntityFallbacks: false })).toBe(true);
    expect(shouldRenderEntityFallbackArea({ authorMediaCount: 1, hideEntityFallbacks: false, compact: false })).toBe(false);
  });

  it('treats a legacy image_url as author media, never as the subject image', () => {
    const items = getAuthorMediaItems({ id: 'r1', image_url: 'https://cdn.example.com/legacy.jpg' });
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://cdn.example.com/legacy.jpg');
    expect(items[0].id).toBe('r1');
  });

  it('never includes a subject image in the author media array', () => {
    const items = getAuthorMediaItems({ id: 'r1', media: [], image_url: null });
    expect(items).toEqual([]);
  });

  it('renders the large subject area only when there is no author media at all', () => {
    expect(shouldRenderEntityFallbackArea({ authorMediaCount: 0, hideEntityFallbacks: false, compact: false })).toBe(true);
    expect(shouldRenderEntityFallbackArea({ authorMediaCount: 1, hideEntityFallbacks: false, compact: false })).toBe(false);
  });
});

describe('Group 3B — preserved suppression semantics', () => {
  it('shows only an explicit media array when entity fallbacks are hidden', () => {
    expect(shouldShowAuthorMedia({ hasMediaArray: true, authorMediaCount: 1, hideEntityFallbacks: true })).toBe(true);
    // legacy image_url only: no explicit array, so it stays suppressed as today
    expect(shouldShowAuthorMedia({ hasMediaArray: false, authorMediaCount: 1, hideEntityFallbacks: true })).toBe(false);
  });

  it('renders no subject image and no icon block when entity fallbacks are hidden', () => {
    expect(shouldRenderEntityFallbackArea({ authorMediaCount: 0, hideEntityFallbacks: true, compact: false })).toBe(false);
    expect(shouldRenderEntityFallbackArea({ authorMediaCount: 1, hideEntityFallbacks: true, compact: false })).toBe(false);
  });

  it('never adds the large subject block to compact cards', () => {
    expect(shouldRenderEntityFallbackArea({ authorMediaCount: 0, hideEntityFallbacks: false, compact: true })).toBe(false);
    expect(shouldRenderEntityFallbackArea({ authorMediaCount: 0, hideEntityFallbacks: true, compact: true })).toBe(false);
  });
});

describe('Group 3B — large subject image renderer', () => {
  const entity = { id: 'e1', image_url: 'https://cdn.example.com/subject.jpg' };

  it('renders a valid subject image in the preserved frame', () => {
    render(
      <EntityCardFallbackImage entity={entity} type="movie" imageAlt="Subject photo" fallbackLabel="No image available for Subject" />,
    );
    const photo = screen.getByTestId('entity-card-large-photo');
    expect(photo).toHaveAttribute('src', 'https://cdn.example.com/subject.jpg');
    expect(photo.className).toContain('object-cover');
    const frame = screen.getByTestId('entity-card-large-image');
    expect(frame.className).toContain('h-48');
    expect(frame.className).toContain('rounded-md');
  });

  it('renders the canonical type icon when the subject has no image', () => {
    render(
      <EntityCardFallbackImage entity={{ id: 'e2', image_url: null }} type="book" imageAlt="alt" fallbackLabel="No image available for A Book" />,
    );
    expect(screen.queryByTestId('entity-card-large-photo')).toBeNull();
    const fallback = screen.getByTestId('entity-card-large-fallback');
    expect(fallback).toHaveAttribute('role', 'img');
    expect(fallback).toHaveAttribute('aria-label', 'No image available for A Book');
    expect(screen.getByTestId('entity-card-large-image').className).toContain('h-48');
  });

  it('converges a broken subject image on the same icon without a second request', () => {
    render(
      <EntityCardFallbackImage entity={entity} type="movie" imageAlt="alt" fallbackLabel="No image available for Subject" />,
    );
    fireEvent.error(screen.getByTestId('entity-card-large-photo'));
    expect(screen.queryByTestId('entity-card-large-photo')).toBeNull();
    expect(screen.getByTestId('entity-card-large-fallback')).toBeInTheDocument();
  });

  it('treats a registered legacy stock placeholder as a missing image', () => {
    render(
      <EntityCardFallbackImage
        entity={{ id: 'e3', image_url: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format' }}
        type="food"
        imageAlt="alt"
        fallbackLabel="No image available for Dish"
      />,
    );
    expect(screen.queryByTestId('entity-card-large-photo')).toBeNull();
    expect(screen.getByTestId('entity-card-large-fallback')).toBeInTheDocument();
  });

  it('uses a neutral icon for an unknown or missing type and emits no stock URL', () => {
    const { container } = render(
      <EntityCardFallbackImage entity={{ id: 'e4' }} type="something-unmapped" imageAlt="alt" fallbackLabel="No image available for Thing" />,
    );
    expect(screen.getByTestId('entity-card-large-fallback')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('images.unsplash.com');
    expect(container.innerHTML).not.toContain('placeholder.svg');
  });
});
