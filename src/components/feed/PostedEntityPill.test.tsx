import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EntityHeroPill } from '@/components/feed/composer/EntityHeroPill';
import { EntityType, type Entity } from '@/services/recommendation/types';
import { PostedEntityPill } from './PostedEntityPill';

const entity: Entity = {
  id: 'entity-1',
  name: 'A very long entity name for overflow testing',
  type: EntityType.Product,
  slug: 'long-entity',
};

const renderPill = (onParentClick = vi.fn(), onParentKeyDown = vi.fn()) => render(
  <MemoryRouter initialEntries={['/home']}>
    <Routes>
      <Route
        path="/home"
        element={(
          <div onClick={onParentClick} onKeyDown={onParentKeyDown}>
            <PostedEntityPill entity={entity} />
          </div>
        )}
      />
      <Route path="/entity/:slug" element={<div>Entity destination</div>} />
    </Routes>
  </MemoryRouter>,
);

const setLabelDimensions = (scrollWidth: number, clientWidth: number) => {
  const label = screen.getByText(entity.name);
  Object.defineProperties(label, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
  });
  fireEvent(window, new Event('resize'));
};

describe('PostedEntityPill', () => {
  it('navigates to the entity without firing the enclosing card click', async () => {
    const parentClick = vi.fn();
    renderPill(parentClick);

    await userEvent.click(screen.getByRole('button', { name: `View ${entity.name}` }));

    expect(screen.getByText('Entity destination')).toBeInTheDocument();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('isolates keyboard events from the enclosing card', () => {
    const parentKeyDown = vi.fn();
    renderPill(vi.fn(), parentKeyDown);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(parentKeyDown).not.toHaveBeenCalled();
  });

  it('shows the full-name tooltip only when the rendered label overflows', async () => {
    renderPill();
    setLabelDimensions(320, 180);

    const button = screen.getByRole('button', { name: `View ${entity.name}` });
    await userEvent.hover(button);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(entity.name);
  });

  it('does not add a tooltip when the rendered label fits', async () => {
    renderPill();
    setLabelDimensions(160, 180);

    await userEvent.hover(screen.getByRole('button', { name: `View ${entity.name}` }));
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('keeps the composer and posted pills on the shared image contract', () => {
    const { unmount } = renderPill();
    expect(screen.getByTestId('entity-image-fallback')).toBeInTheDocument();
    unmount();

    render(
      <EntityHeroPill
        entities={[entity]}
        onOpenSelector={vi.fn()}
        onRemoveEntity={vi.fn()}
      />,
    );
    expect(screen.getByTestId('entity-image-fallback')).toBeInTheDocument();
  });
});