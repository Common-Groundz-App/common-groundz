import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { EntityHeaderImage } from '@/components/entity-v4/EntityHeaderImage';

/**
 * Group 5 — the entity page header picture area on the live Entity V4 page.
 *
 * Fallback-only migration: the frame, radius, crop, responsive sizing and the
 * refresh overlay semantics are all preserved; only what fills the frame when
 * there is no usable picture changes.
 */

const DESKTOP_FRAME = 'flex-shrink-0 h-24 w-24 min-w-[96px] rounded-lg overflow-hidden';
const MOBILE_FRAME = 'w-full h-48 mb-4 rounded-lg overflow-hidden';
const REGISTERED_PLACEHOLDER =
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400';
const LEGITIMATE_UNSPLASH =
  'https://images.unsplash.com/photo-a-real-entity-photo?auto=format';

const renderHeaderImage = (props: Partial<React.ComponentProps<typeof EntityHeaderImage>> = {}) =>
  render(
    <EntityHeaderImage
      entityId="entity-1"
      entityType="product"
      entityImage="https://cdn.example.com/real.jpg"
      name="Nice Thing"
      isMobile={false}
      isSignedIn={false}
      {...props}
    />,
  );

const frameOf = (el: HTMLElement) => el.parentElement as HTMLElement;

describe('Group 5 — preserved frame and real images', () => {
  it('renders a real picture with the desktop frame and crop unchanged', () => {
    renderHeaderImage();
    const image = screen.getByTestId('entity-header-image');
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/real.jpg');
    expect(image.className).toBe('h-full w-full object-cover');
    expect(frameOf(image).className).toContain(DESKTOP_FRAME);
    expect(frameOf(image).className).toContain('relative group');
  });

  it('renders the mobile full-width band frame unchanged', () => {
    renderHeaderImage({ isMobile: true });
    const image = screen.getByTestId('entity-header-image');
    expect(frameOf(image).className).toContain(MOBILE_FRAME);
  });

  it('keeps brand entities on object-contain over a neutral wrapper', () => {
    renderHeaderImage({ entityType: 'brand' });
    const image = screen.getByTestId('entity-header-image');
    expect(image.className).toBe('h-full w-full object-contain');
    expect(frameOf(image).className).toContain('bg-muted');
  });

  it('keeps a legitimate unregistered Unsplash photo as the real image', () => {
    renderHeaderImage({ entityImage: LEGITIMATE_UNSPLASH });
    expect(screen.getByTestId('entity-header-image')).toHaveAttribute('src', LEGITIMATE_UNSPLASH);
    expect(screen.queryByTestId('entity-header-image-fallback')).not.toBeInTheDocument();
  });

  it('cannot swap the shown picture for a stored metadata photo', () => {
    // Only the entity's own image_url reaches the header, so raw precedence holds.
    renderHeaderImage({ entityImage: 'https://cdn.example.com/raw.jpg' });
    expect(screen.getByTestId('entity-header-image')).toHaveAttribute(
      'src',
      'https://cdn.example.com/raw.jpg',
    );
  });
});

describe('Group 5 — fallback behaviour', () => {
  it('shows the canonical type icon with an accessible label when there is no picture', () => {
    renderHeaderImage({ entityImage: null });
    const fallback = screen.getByTestId('entity-header-image-fallback');
    expect(fallback).toHaveAttribute('aria-label', 'No image available for Nice Thing');
    expect(frameOf(fallback).className).toContain(DESKTOP_FRAME);
    expect(screen.queryByTestId('entity-header-image')).not.toBeInTheDocument();
  });

  it('treats a registered legacy placeholder as missing and never renders its address', () => {
    const { container } = renderHeaderImage({ entityImage: REGISTERED_PLACEHOLDER });
    expect(screen.getByTestId('entity-header-image-fallback')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('photo-1505740420928');
    expect(container.innerHTML).not.toContain('/placeholder.svg');
  });

  it('falls back identically for a broken picture, with no second request', () => {
    renderHeaderImage();
    fireEvent.error(screen.getByTestId('entity-header-image'));
    expect(screen.getByTestId('entity-header-image-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('entity-header-image')).not.toBeInTheDocument();
  });

  it('uses the neutral icon for an unknown type and introduces no stock address', () => {
    const { container } = renderHeaderImage({ entityType: 'wormhole', entityImage: null });
    expect(screen.getByTestId('entity-header-image-fallback')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('images.unsplash.com');
    expect(container.innerHTML).not.toContain('/placeholder.svg');
  });

  it('sizes the icon per frame without touching the frame itself', () => {
    const { unmount } = renderHeaderImage({ entityImage: null });
    expect(screen.getByTestId('entity-header-image-fallback').querySelector('svg')?.getAttribute('class'))
      .toContain('h-10 w-10');
    unmount();

    renderHeaderImage({ entityImage: null, isMobile: true });
    expect(screen.getByTestId('entity-header-image-fallback').querySelector('svg')?.getAttribute('class'))
      .toContain('h-12 w-12');
  });
});

describe('Group 5 — refresh overlay semantics', () => {
  const onRefreshHeroImage = () => Promise.resolve();

  it('appears for a signed-in person only after a genuine load failure', () => {
    renderHeaderImage({ isSignedIn: true, onRefreshHeroImage });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    fireEvent.error(screen.getByTestId('entity-header-image'));
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('never appears when there was no picture at all', () => {
    renderHeaderImage({ entityImage: null, isSignedIn: true, onRefreshHeroImage });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('never appears for a registered legacy placeholder', () => {
    renderHeaderImage({
      entityImage: REGISTERED_PLACEHOLDER,
      isSignedIn: true,
      onRefreshHeroImage,
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('never appears for a signed-out visitor', () => {
    renderHeaderImage({ isSignedIn: false, onRefreshHeroImage });
    fireEvent.error(screen.getByTestId('entity-header-image'));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('resets when the source changes from a failed picture to a valid one', () => {
    const { rerender } = render(
      <EntityHeaderImage
        entityId="entity-1"
        entityType="product"
        entityImage="https://cdn.example.com/expired.jpg"
        name="Nice Thing"
        isMobile={false}
        isSignedIn
        onRefreshHeroImage={onRefreshHeroImage}
      />,
    );
    fireEvent.error(screen.getByTestId('entity-header-image'));
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <EntityHeaderImage
        entityId="entity-1"
        entityType="product"
        entityImage="https://cdn.example.com/fresh.jpg"
        name="Nice Thing"
        isMobile={false}
        isSignedIn
        onRefreshHeroImage={onRefreshHeroImage}
      />,
    );
    expect(screen.getByTestId('entity-header-image')).toHaveAttribute(
      'src',
      'https://cdn.example.com/fresh.jpg',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('clears a failure when a different entity shares the same image value', () => {
    const shared = 'https://cdn.example.com/shared.jpg';
    const { rerender } = render(
      <EntityHeaderImage
        entityId="entity-1"
        entityType="product"
        entityImage={shared}
        name="First"
        isMobile={false}
        isSignedIn
        onRefreshHeroImage={onRefreshHeroImage}
      />,
    );
    fireEvent.error(screen.getByTestId('entity-header-image'));
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <EntityHeaderImage
        entityId="entity-2"
        entityType="product"
        entityImage={shared}
        name="Second"
        isMobile={false}
        isSignedIn
        onRefreshHeroImage={onRefreshHeroImage}
      />,
    );
    expect(screen.getByTestId('entity-header-image')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('clears a failure when switching to a different entity with no picture', () => {
    const { rerender } = render(
      <EntityHeaderImage
        entityId="entity-1"
        entityType="product"
        entityImage="https://cdn.example.com/expired.jpg"
        name="First"
        isMobile={false}
        isSignedIn
        onRefreshHeroImage={onRefreshHeroImage}
      />,
    );
    fireEvent.error(screen.getByTestId('entity-header-image'));
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(
      <EntityHeaderImage
        entityId="entity-2"
        entityType="product"
        entityImage={null}
        name="Second"
        isMobile={false}
        isSignedIn
        onRefreshHeroImage={onRefreshHeroImage}
      />,
    );
    expect(screen.getByTestId('entity-header-image-fallback')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
