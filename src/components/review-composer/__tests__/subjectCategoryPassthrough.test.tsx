/**
 * Phase 5C regression: the real UnifiedEntitySelector must carry the
 * persisted `category_id` into the composer subject (via toSubject) for local
 * mouse picks, keyboard picks and external-result resolution.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { UnifiedEntitySelector } from '@/components/feed/UnifiedEntitySelector';
import type { EntityAdapter } from '@/components/profile/circles/types';
import { toSubject } from '@/components/review-composer/screen/loaders';

vi.mock('@/components/editor/RichTextEditor', () => ({
  RichTextDisplay: ({ content }: { content: string }) => <span>{content}</span>,
}));
vi.mock('@/components/entity/EntityCategoryBadge', () => ({ EntityCategoryBadge: () => null }));
vi.mock('@/components/ui/connected-rings', () => ({ ConnectedRingsRating: () => null }));
vi.mock('@/components/admin/CreateEntityDialog', () => ({ CreateEntityDialog: () => null }));
vi.mock('@/components/search/RecentSearchesPanel', () => ({ RecentSearchesPanel: () => null }));

const searchState = vi.hoisted(() => ({
  results: {
    entities: [] as any[],
    users: [] as any[],
    categorized: { books: [] as any[], movies: [] as any[], places: [] as any[] },
    hashtags: [] as any[],
  },
}));
vi.mock('@/hooks/use-enhanced-realtime-search', () => ({
  useEnhancedRealtimeSearch: () => ({ results: searchState.results, isLoading: false, loadingStates: {} }),
}));
vi.mock('@/contexts/LocationContext', () => ({
  useLocation: () => ({
    position: null, locationEnabled: false, isLoading: false, permissionStatus: 'denied',
    formatDistance: () => '', getPosition: vi.fn(), isGeolocationSupported: false,
  }),
}));
vi.mock('@/hooks/useRecentSearches', () => ({
  useRecentSearches: () => ({ recents: [], addRecent: vi.fn(), removeRecent: vi.fn(), clearRecents: vi.fn() }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn(async () => ({ data: null, error: null })) } },
}));
vi.mock('@/services/recommendation/entityOperations', () => ({ findEntityByApiRef: vi.fn(async () => null) }));
vi.mock('@/services/enhancedEntityService', () => ({ createEntityQuick: vi.fn(async () => null) }));
const importMock = vi.hoisted(() => ({ findOrCreateExternalEntity: vi.fn() }));
vi.mock('@/services/externalEntityImport', () => importMock);

const stableInitial: EntityAdapter[] = [];

function renderSelector(onChange: (e: EntityAdapter[]) => void) {
  return render(
    <MemoryRouter>
      <UnifiedEntitySelector mode="subject" onEntitiesChange={onChange} initialQuery="dune" initialEntities={stableInitial} />
    </MemoryRouter>,
  );
}

const lastSubject = (fn: ReturnType<typeof vi.fn>) => {
  const calls = fn.mock.calls;
  return toSubject(calls[calls.length - 1][0][0], null);
};

beforeEach(() => {
  importMock.findOrCreateExternalEntity.mockReset();
  searchState.results = { entities: [], users: [], categorized: { books: [], movies: [], places: [] }, hashtags: [] };
});

describe('subject category pass-through (Phase 5C)', () => {
  it('mouse pick of a local entity keeps its category_id', async () => {
    searchState.results.entities = [{ id: 'e1', name: 'Dune Part Two', type: 'movie', image_url: null, category_id: 'cat-scifi' }];
    const onChange = vi.fn();
    renderSelector(onChange);
    fireEvent.click(await screen.findByText('Dune'));
    expect(lastSubject(onChange).categoryId).toBe('cat-scifi');
  });

  it('keyboard pick of a local entity keeps its category_id', async () => {
    searchState.results.entities = [{ id: 'e1', name: 'Dune Part Two', type: 'movie', image_url: null, category_id: 'cat-scifi' }];
    const onChange = vi.fn();
    renderSelector(onChange);
    await screen.findByText('Dune');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(lastSubject(onChange).categoryId).toBe('cat-scifi');
  });

  it('uncategorized local entity yields null, never an inferred category', async () => {
    searchState.results.entities = [{ id: 'e2', name: 'Dune Book', type: 'book', image_url: null }];
    const onChange = vi.fn();
    renderSelector(onChange);
    fireEvent.click(await screen.findByText('Dune'));
    expect(lastSubject(onChange).categoryId).toBeNull();
  });

  it('external result resolving to an already-categorized entity keeps the persisted category', async () => {
    searchState.results.categorized.movies = [{ name: 'Dune Messiah', api_source: 'tmdb', api_ref: '42', type: 'movie' }];
    importMock.findOrCreateExternalEntity.mockResolvedValue({ id: 'e3', name: 'Dune Messiah', type: 'movie', category_id: 'cat-persisted' });
    const onChange = vi.fn();
    renderSelector(onChange);
    fireEvent.click(await screen.findByText('Dune'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(lastSubject(onChange).categoryId).toBe('cat-persisted');
  });

  it('external result resolving to an uncategorized entity yields null', async () => {
    searchState.results.categorized.movies = [{ name: 'Dune Messiah', api_source: 'tmdb', api_ref: '42', type: 'movie' }];
    importMock.findOrCreateExternalEntity.mockResolvedValue({ id: 'e4', name: 'Dune Messiah', type: 'movie', category_id: null });
    const onChange = vi.fn();
    renderSelector(onChange);
    fireEvent.click(await screen.findByText('Dune'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(lastSubject(onChange).categoryId).toBeNull();
  });
});
