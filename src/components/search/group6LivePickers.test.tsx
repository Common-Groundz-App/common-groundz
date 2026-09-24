import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { EntitySearch } from '@/components/recommendations/EntitySearch';

/**
 * Group 6A — outside-result search rows (SearchResultHandler) and the
 * "Add to My Stuff" picker rows (EntitySearch). Frames preserved; only the
 * empty / broken picture changes. Plus the picker's selected-item image value.
 */

const REGISTERED_PLACEHOLDER = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=80';
const LEGITIMATE_UNSPLASH = 'https://images.unsplash.com/photo-a-real-entity-photo?auto=format';

vi.mock('@/hooks/use-optimistic-entity-creation', () => ({
  useOptimisticEntityCreation: () => ({ createEntityOptimistically: vi.fn(), isCreating: false }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const pickerState = vi.hoisted(() => ({
  localResults: [] as Record<string, unknown>[],
  externalResults: [] as Record<string, unknown>[],
}));
vi.mock('@/hooks/use-entity-search', () => ({
  useEntitySearch: () => ({
    localResults: pickerState.localResults,
    externalResults: pickerState.externalResults,
    isLoading: false,
    handleSearch: vi.fn(),
    createEntityFromUrl: vi.fn(),
    createEntityFromExternal: vi.fn().mockResolvedValue(null),
  }),
}));
vi.mock('@/contexts/LocationContext', () => ({
  useLocation: () => ({
    position: null,
    isLoading: false,
    getPosition: vi.fn(),
    isGeolocationSupported: false,
    formatDistance: () => '',
    locationEnabled: false,
    enableLocation: vi.fn(),
    disableLocation: vi.fn(),
    permissionStatus: 'denied',
  }),
}));

const renderRow = (result: Record<string, unknown>) =>
  render(
    <MemoryRouter>
      <SearchResultHandler result={{ name: 'Dune', api_source: 'openlibrary', api_ref: 'OL1', venue: 'Frank Herbert', ...result } as unknown as React.ComponentProps<typeof SearchResultHandler>['result']} query="dune" />
    </MemoryRouter>,
  );

describe('Group 6A — outside-result search rows', () => {
  it('renders a real picture in the unchanged 48x48 frame', () => {
    renderRow({ image_url: 'https://covers.example.com/dune.jpg' });
    const img = screen.getByTestId('entity-collection-photo');
    expect(img).toHaveAttribute('src', 'https://covers.example.com/dune.jpg');
    expect(img.className).toBe('w-full h-full object-cover');
    expect((img.parentElement as HTMLElement).className).toContain('w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative group');
  });

  it('replaces "No Image" with the canonical icon and an accessible label', () => {
    renderRow({ image_url: null });
    expect(screen.queryByText('No Image')).not.toBeInTheDocument();
    expect(screen.getByTestId('entity-collection-fallback')).toHaveAttribute('aria-label', 'No image available for Dune');
  });

  it('falls back identically for a broken picture with no second request', () => {
    renderRow({ image_url: 'https://covers.example.com/broken.jpg' });
    fireEvent.error(screen.getByTestId('entity-collection-photo'));
    expect(screen.getByTestId('entity-collection-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('entity-collection-photo')).not.toBeInTheDocument();
  });

  it('treats a registered placeholder as missing and keeps a legitimate Unsplash photo', () => {
    const { container, unmount } = renderRow({ image_url: REGISTERED_PLACEHOLDER });
    expect(screen.getByTestId('entity-collection-fallback')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('photo-1543002588');
    unmount();
    renderRow({ image_url: LEGITIMATE_UNSPLASH });
    expect(screen.getByTestId('entity-collection-photo')).toHaveAttribute('src', LEGITIMATE_UNSPLASH);
  });

  it('introduces no stock address or placeholder.svg as a fallback', () => {
    const { container } = renderRow({ image_url: null });
    expect(container.innerHTML).not.toContain('images.unsplash.com');
    expect(container.innerHTML).not.toContain('/placeholder.svg');
  });
});

const openPicker = (onSelect = vi.fn()) => {
  const utils = render(<EntitySearch type="book" onSelect={onSelect} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'dune' } });
  return { ...utils, onSelect };
};

describe('Group 6A — Add to My Stuff picker rows', () => {
  beforeEach(() => {
    pickerState.localResults = [];
    pickerState.externalResults = [];
  });

  it('shows the canonical icon, not a stock photo, for rows with no picture', () => {
    pickerState.localResults = [{ id: 'e1', name: 'Local Book', type: 'book', image_url: null }];
    pickerState.externalResults = [{ name: 'Outside Book', api_source: 'openlibrary', api_ref: 'OL2', image_url: null }];
    const { container } = openPicker();
    expect(screen.getAllByTestId('entity-collection-fallback')).toHaveLength(2);
    expect(container.innerHTML).not.toContain('images.unsplash.com');
  });

  it('keeps real pictures in the unchanged 40x40 frame', () => {
    pickerState.externalResults = [{ name: 'Outside Book', api_source: 'openlibrary', api_ref: 'OL2', image_url: 'https://covers.example.com/b.jpg' }];
    openPicker();
    const img = screen.getByTestId('entity-collection-photo');
    expect(img).toHaveAttribute('src', 'https://covers.example.com/b.jpg');
    expect(img.className).toBe('w-10 h-10 object-cover rounded-md');
  });

  it('never hands a stock address to the selected item', () => {
    pickerState.externalResults = [{ name: 'Outside Book', api_source: 'openlibrary', api_ref: 'OL2', image_url: null }];
    const { onSelect } = openPicker();
    fireEvent.click(screen.getByText('Outside Book'));
    expect(onSelect.mock.calls[0][0].image_url).toBeNull();
  });

  it('keeps a real picture and drops a registered placeholder on the selected item', () => {
    pickerState.externalResults = [
      { name: 'Real Cover', api_source: 'openlibrary', api_ref: 'OL3', image_url: 'https://covers.example.com/r.jpg' },
      { name: 'Stock Cover', api_source: 'openlibrary', api_ref: 'OL4', image_url: REGISTERED_PLACEHOLDER },
    ];
    const { onSelect } = openPicker();
    fireEvent.click(screen.getByText('Real Cover'));
    expect(onSelect.mock.calls[0][0].image_url).toBe('https://covers.example.com/r.jpg');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'dune' } });
    fireEvent.click(screen.getByText('Stock Cover'));
    expect(onSelect.mock.calls[1][0].image_url).toBeNull();
  });
});
