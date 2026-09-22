import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { EntityResultItem } from '@/components/search/EntityResultItem';
import { EntityResultThumbnail } from '@/pages/ProductSearch';
import { SubjectThumbnail } from '@/components/profile/reviews/steps/SubjectSelectStep';
import { UnifiedEntitySelector, EntityRowThumbnail } from '@/components/feed/UnifiedEntitySelector';
import type { EntitySearchResult } from '@/hooks/use-unified-search';
import type { EntityAdapter } from '@/components/profile/circles/types';

vi.mock('@/components/editor/RichTextEditor', () => ({
  RichTextDisplay: ({ content }: { content: string }) => <span>{content}</span>,
}));
vi.mock('@/components/entity/EntityCategoryBadge', () => ({
  EntityCategoryBadge: () => null,
}));
vi.mock('@/components/ui/connected-rings', () => ({
  ConnectedRingsRating: () => null,
}));
vi.mock('@/components/admin/CreateEntityDialog', () => ({
  CreateEntityDialog: () => null,
}));
vi.mock('@/components/search/RecentSearchesPanel', () => ({
  RecentSearchesPanel: () => null,
}));
const selectorSearchResults = vi.hoisted(() => ({
  entities: [
    { id: 'entity-1', name: 'Madagascar Centella Travel Kit', type: 'product', image_url: null },
  ],
  users: [{ id: 'user-1', username: 'rishab.devp', avatar_url: null }],
  categorized: { books: [], movies: [], places: [] },
  hashtags: [],
}));

vi.mock('@/hooks/use-enhanced-realtime-search', () => ({
  // Stable `results` reference: effects in the selector depend on it, so a
  // fresh object per render would loop forever.
  useEnhancedRealtimeSearch: () => ({
    results: selectorSearchResults,
    isLoading: false,
    loadingStates: {},
  }),
}));
vi.mock('@/contexts/LocationContext', () => ({
  useLocation: () => ({
    position: null,
    locationEnabled: false,
    isLoading: false,
    permissionStatus: 'denied',
    formatDistance: () => '',
    getPosition: vi.fn(),
    isGeolocationSupported: false,
  }),
}));
vi.mock('@/hooks/useRecentSearches', () => ({
  useRecentSearches: () => ({
    recents: [],
    addRecent: vi.fn(),
    removeRecent: vi.fn(),
    clearRecents: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
  },
}));
vi.mock('@/services/recommendation/entityOperations', () => ({
  findEntityByApiRef: vi.fn(async () => null),
}));
vi.mock('@/services/enhancedEntityService', () => ({
  createEntityQuick: vi.fn(async () => null),
}));

const REAL_IMAGE = 'https://cdn.example.com/photos/real.jpg';
const REGISTERED_PLACEHOLDER =
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400';

const imagelessProduct = {
  id: 'entity-1',
  name: 'Madagascar Centella Travel Kit',
  type: 'product',
  image_url: null,
};

const asSearchResult = (value: Record<string, unknown>) =>
  value as unknown as EntitySearchResult;
const asAdapter = (value: Record<string, unknown>) =>
  value as unknown as EntityAdapter;

describe('EntityResultItem (search result row)', () => {
  const renderRow = (entity: Record<string, unknown>) =>
    render(
      <MemoryRouter>
        <EntityResultItem entity={asSearchResult(entity)} onClick={() => {}} />
      </MemoryRouter>,
    );

  it('renders the real image unchanged when one exists', () => {
    renderRow({ ...imagelessProduct, image_url: REAL_IMAGE });
    const img = screen.getByRole('img', { name: 'Madagascar Centella Travel Kit' });
    expect(img).toHaveAttribute('src', REAL_IMAGE);
    expect(img).toHaveClass('w-full', 'h-full', 'object-cover');
  });

  it('replaces the entity initial with the canonical type icon when no image exists', () => {
    const { container } = renderRow(imagelessProduct);
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
    expect(screen.queryByText('M')).toBeNull();
  });

  it('shows the same icon when the real image fails to load', () => {
    const { container } = renderRow({ ...imagelessProduct, image_url: REAL_IMAGE });
    fireEvent.error(screen.getByRole('img', { name: 'Madagascar Centella Travel Kit' }));
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });

  it('treats a registered legacy placeholder as missing', () => {
    const { container } = renderRow({ ...imagelessProduct, image_url: REGISTERED_PLACEHOLDER });
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });

  it('uses the neutral icon for an unknown type instead of guessing product', () => {
    const { container } = renderRow({ ...imagelessProduct, type: 'hovercraft' });
    expect(container.querySelector('svg.lucide-tag')).not.toBeNull();
    expect(container.querySelector('svg.lucide-package')).toBeNull();
  });

  it('resets the failed state when the row switches to a different entity', () => {
    const { rerender } = render(
      <MemoryRouter>
        <EntityResultItem
          entity={asSearchResult({ ...imagelessProduct, image_url: REAL_IMAGE })}
          onClick={() => {}}
        />
      </MemoryRouter>,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Madagascar Centella Travel Kit' }));
    rerender(
      <MemoryRouter>
        <EntityResultItem
          entity={asSearchResult({
            id: 'entity-2',
            name: 'Beauty of Joseon Ginseng Essence Water 150ml',
            type: 'product',
            image_url: 'https://cdn.example.com/photos/ginseng.jpg',
          })}
          onClick={() => {}}
        />
      </MemoryRouter>,
    );
    const img = screen.getByRole('img', { name: 'Beauty of Joseon Ginseng Essence Water 150ml' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/photos/ginseng.jpg');
  });
});

describe('EntityResultThumbnail (ProductSearch row)', () => {
  it('keeps the 48px rounded frame and shows the icon when no image exists', () => {
    const { container } = render(<EntityResultThumbnail entity={imagelessProduct} />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame).toHaveClass('w-12', 'h-12', 'rounded-lg');
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });

  it('shows the same icon when the image fails to load', () => {
    const { container } = render(
      <EntityResultThumbnail entity={{ ...imagelessProduct, image_url: REAL_IMAGE }} />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });
});

describe('SubjectThumbnail (review subject card)', () => {
  it('keeps lazy loading and the 48px frame for real images', () => {
    const { container } = render(
      <SubjectThumbnail subject={asAdapter({ ...imagelessProduct, image_url: REAL_IMAGE })} />,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img).toHaveClass('h-full', 'w-full', 'object-cover');
    expect(container.firstElementChild).toHaveClass('h-12', 'w-12', 'rounded-lg');
  });

  it('shows the canonical icon inside the same frame when no image exists', () => {
    const { container } = render(<SubjectThumbnail subject={asAdapter(imagelessProduct)} />);
    expect(container.firstElementChild).toHaveClass('h-12', 'w-12', 'rounded-lg');
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });

  it('shows the same icon when the image fails to load', () => {
    const { container } = render(
      <SubjectThumbnail subject={asAdapter({ ...imagelessProduct, image_url: REAL_IMAGE })} />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });
});

describe('EntityRowThumbnail (entity picker dropdown rows)', () => {
  it('preserves the modal 44px frame for real images', () => {
    const { container } = render(
      <EntityRowThumbnail
        entity={{ ...imagelessProduct, image_url: REAL_IMAGE }}
        className="w-11 h-11 rounded-lg"
      />,
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toHaveClass('w-11', 'h-11', 'rounded-lg', 'object-cover');
  });

  it('preserves the inline 32px frame and shows the icon when no image exists', () => {
    const { container } = render(
      <EntityRowThumbnail entity={imagelessProduct} className="w-8 h-8 rounded" />,
    );
    const frame = container.firstElementChild as HTMLElement;
    expect(frame).toHaveClass('w-8', 'h-8', 'rounded');
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });

  it('shows the same icon when the image fails to load', () => {
    const { container } = render(
      <EntityRowThumbnail
        entity={{ ...imagelessProduct, image_url: REAL_IMAGE }}
        className="w-11 h-11 rounded-lg"
      />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });

  it('uses the neutral icon for an unknown type', () => {
    const { container } = render(
      <EntityRowThumbnail entity={{ ...imagelessProduct, type: 'hovercraft' }} className="w-8 h-8 rounded" />,
    );
    expect(container.querySelector('svg.lucide-tag')).not.toBeNull();
  });
});

describe('mixed search results — initials boundary', () => {
  it('image-less entities use the type icon while image-less people keep their initials', async () => {
    // Stable reference: the selector syncs `initialEntities` in an effect, so a
    // fresh `[]` literal each render would loop forever.
    const stableInitialEntities: EntityAdapter[] = [];
    const { container } = render(
      <MemoryRouter>
        <UnifiedEntitySelector
          onEntitiesChange={() => {}}
          initialQuery="centella"
          initialEntities={stableInitialEntities}
        />
      </MemoryRouter>,
    );

    // Entity row: canonical Product icon, and the old "M" initial is gone.
    // HighlightMatch splits the name around the query term, so match the
    // highlighted fragment instead of the full string.
    const entityName = await screen.findByText('Centella');
    const entityRow = entityName.closest('div[class*="cursor-pointer"]') as HTMLElement;
    expect(entityRow.querySelector('svg.lucide-package')).not.toBeNull();
    expect(entityRow.textContent).not.toContain('M ');

    // People row: the username initial fallback is unchanged.
    const peopleName = await screen.findByText('rishab.devp');
    const peopleRow = peopleName.closest('div[class*="cursor-pointer"]') as HTMLElement;
    expect(peopleRow.textContent).toContain('R');
    expect(peopleRow.querySelector('svg.lucide-tag')).toBeNull();
    expect(container).toBeTruthy();
  });
});
