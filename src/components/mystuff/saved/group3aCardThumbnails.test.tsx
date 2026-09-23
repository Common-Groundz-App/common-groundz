import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import SavedEntityCard from '@/components/mystuff/saved/SavedEntityCard';
import { ChatEntityCard } from '@/components/chat/ChatEntityCard';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';

const REAL_IMAGE = 'https://cdn.example.com/real-product.jpg';
const REGISTERED_PLACEHOLDER =
  'https://images.unsplash.com/photo-1495195134817-aeb325a55b65?auto=format&fit=crop&w=1776&q=80';

type Row = Record<string, unknown>;

const baseEntity = (overrides: Row = {}): Row => ({
  id: 'entity-1',
  name: 'Centella Serum',
  slug: 'centella-serum',
  type: 'product',
  image_url: REAL_IMAGE,
  ...overrides,
});

const savedItem = (entity: Row) => ({
  id: 'saved-1',
  type: 'entity' as const,
  saved_at: '2026-09-01T00:00:00Z',
  content: entity,
});

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

afterEach(cleanup);

describe('SavedEntityCard thumbnail', () => {
  it('renders the real image unchanged inside the 64px frame', () => {
    const { container } = renderWithRouter(
      <SavedEntityCard item={savedItem(baseEntity())} onUnsave={() => {}} />,
    );
    const img = screen.getByRole('img', { name: 'Centella Serum' });
    expect(img.getAttribute('src')).toBe(REAL_IMAGE);
    expect(img.className).toContain('object-cover');
    const frame = container.querySelector('.w-16.h-16.rounded-lg');
    expect(frame).not.toBeNull();
  });

  it('renders the canonical product icon when the image is missing', () => {
    const { container } = renderWithRouter(
      <SavedEntityCard
        item={savedItem(baseEntity({ image_url: null }))}
        onUnsave={() => {}}
      />,
    );
    expect(container.querySelector('.lucide-package')).not.toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders the identical icon when the real image fails to load', () => {
    const { container } = renderWithRouter(
      <SavedEntityCard item={savedItem(baseEntity())} onUnsave={() => {}} />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Centella Serum' }));
    expect(container.querySelector('.lucide-package')).not.toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders the icon for a registered legacy placeholder URL', () => {
    const { container } = renderWithRouter(
      <SavedEntityCard
        item={savedItem(baseEntity({ image_url: REGISTERED_PLACEHOLDER }))}
        onUnsave={() => {}}
      />,
    );
    expect(container.querySelector('.lucide-package')).not.toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders the neutral icon for an unknown type', () => {
    const { container } = renderWithRouter(
      <SavedEntityCard
        item={savedItem(baseEntity({ image_url: null, type: 'hovercraft' }))}
        onUnsave={() => {}}
      />,
    );
    expect(container.querySelector('.lucide-tag')).not.toBeNull();
  });
});

describe('ChatEntityCard thumbnail', () => {
  const baseProps = {
    entityId: 'entity-1',
    entityName: 'Centella Serum',
    entityType: 'product',
    verified: false,
    score: 4.2,
  };

  it('renders the real image unchanged inside the 48px frame', () => {
    const { container } = renderWithRouter(
      <ChatEntityCard {...baseProps} entity={baseEntity() as never} />,
    );
    const img = screen.getByRole('img', { name: 'Centella Serum' });
    expect(img.getAttribute('src')).toBe(REAL_IMAGE);
    const frame = container.querySelector('.w-12.h-12.rounded-md');
    expect(frame).not.toBeNull();
  });

  it('renders the canonical product icon when the entity has no image', () => {
    const { container } = renderWithRouter(
      <ChatEntityCard
        {...baseProps}
        entity={baseEntity({ image_url: null }) as never}
      />,
    );
    expect(container.querySelector('.lucide-package')).not.toBeNull();
  });

  it('renders the identical icon when the real image fails to load', () => {
    const { container } = renderWithRouter(
      <ChatEntityCard {...baseProps} entity={baseEntity() as never} />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Centella Serum' }));
    expect(container.querySelector('.lucide-package')).not.toBeNull();
  });

  it('renders the neutral icon for an unknown type instead of a product photo', () => {
    const { container } = renderWithRouter(
      <ChatEntityCard
        {...baseProps}
        entityType="hovercraft"
        entity={baseEntity({ image_url: null, type: 'hovercraft' }) as never}
      />,
    );
    expect(container.querySelector('.lucide-tag')).not.toBeNull();
    expect(container.querySelector('.lucide-package')).toBeNull();
  });

  it('resets failure state when switching from a broken entity to a valid one', () => {
    const { container, rerender } = renderWithRouter(
      <ChatEntityCard
        {...baseProps}
        entityId="entity-a"
        entity={baseEntity({ id: 'entity-a' }) as never}
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Centella Serum' }));
    expect(container.querySelector('.lucide-package')).not.toBeNull();

    rerender(
      <MemoryRouter>
        <ChatEntityCard
          {...baseProps}
          entityId="entity-b"
          entity={baseEntity({ id: 'entity-b', image_url: REAL_IMAGE }) as never}
        />
      </MemoryRouter>,
    );
    const img = screen.getByRole('img', { name: 'Centella Serum' });
    expect(img.getAttribute('src')).toBe(REAL_IMAGE);
  });
});

describe('EntityPreviewCard thumbnail', () => {
  const previewEntity = (overrides: Row = {}): Row => ({
    name: 'Centella Serum',
    image_url: REAL_IMAGE,
    ...overrides,
  });

  it('renders the real image unchanged inside the responsive bordered frame', () => {
    render(
      <EntityPreviewCard
        entity={previewEntity() as never}
        type="product"
        onChange={() => {}}
      />,
    );
    const img = screen.getByRole('img', { name: 'Centella Serum' });
    expect(img.getAttribute('src')).toBe(REAL_IMAGE);
    expect(img.className).toContain('sm:w-24');
    expect(img.className).toContain('h-24');
    expect(img.className).toContain('rounded-lg');
  });

  it('replaces the visible "No image" text with an accessibly labelled canonical icon', () => {
    const { container } = render(
      <EntityPreviewCard
        entity={previewEntity({ image_url: undefined }) as never}
        type="product"
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText('No image')).toBeNull();
    const labelled = screen.getByRole('img', { name: 'Centella Serum' });
    expect(labelled.className).toContain('sm:w-24');
    expect(container.querySelector('.lucide-package')).not.toBeNull();
  });

  it('renders the identical labelled icon when the real image fails to load', () => {
    const { container } = render(
      <EntityPreviewCard
        entity={previewEntity() as never}
        type="product"
        onChange={() => {}}
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Centella Serum' }));
    expect(screen.queryByText('No image')).toBeNull();
    expect(screen.getByRole('img', { name: 'Centella Serum' })).not.toBeNull();
    expect(container.querySelector('.lucide-package')).not.toBeNull();
  });

  it('renders the neutral icon for an unknown type', () => {
    const { container } = render(
      <EntityPreviewCard
        entity={previewEntity({ image_url: undefined }) as never}
        type="hovercraft"
        onChange={() => {}}
      />,
    );
    expect(container.querySelector('.lucide-tag')).not.toBeNull();
  });
});
