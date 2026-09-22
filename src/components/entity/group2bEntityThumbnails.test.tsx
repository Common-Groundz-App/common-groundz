import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { EntityChildrenCard, EntityChildThumbnail } from '@/components/entity/EntityChildrenCard';
import {
  EntitySidebar,
  ParentEntityThumbnail,
  RelatedEntityThumbnail,
} from '@/components/entity-v4/EntitySidebar';
import {
  RecommendationEntityCard,
  RecommendationEntityThumbnail,
} from '@/components/entity/RecommendationEntityCard';
import type { Entity } from '@/services/recommendation/types';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockTrackRecommendationClick = vi.hoisted(() => vi.fn());
const sidebarRelatedEntities = vi.hoisted(() => ({
  value: [] as Entity[],
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/utils/entityUrlUtils', () => ({
  getEntityUrlWithParent: (entity: { id: string }) => `/entity/${entity.id}`,
}));

vi.mock('@/services/analytics', () => ({
  analytics: {
    trackRecommendationClick: mockTrackRecommendationClick,
  },
}));

vi.mock('@/hooks/use-related-entities', () => ({
  useRelatedEntities: () => ({
    relatedEntities: sidebarRelatedEntities.value,
    isLoading: false,
  }),
}));

vi.mock('@/components/editor/RichTextEditor', () => ({
  RichTextDisplay: ({ content }: { content: string }) => <span>{content}</span>,
}));
vi.mock('@/components/entity/EntityMetadataCard', () => ({
  EntityMetadataCard: () => null,
  hasMetadataContent: () => false,
}));
vi.mock('@/components/entity/EntitySpecsCard', () => ({
  EntitySpecsCard: () => null,
}));
vi.mock('@/components/entity/EntityRelatedCard', () => ({
  EntityRelatedCard: () => null,
}));
vi.mock('@/components/entity/EntityCategoryBadge', () => ({
  EntityCategoryBadge: () => null,
}));
vi.mock('@/components/entity-v4/EntitySuggestionButton', () => ({
  EntitySuggestionButton: () => null,
}));
vi.mock('@/components/entity-v4/ClaimBusinessButton', () => ({
  ClaimBusinessButton: () => null,
}));
vi.mock('@/components/common/ProfileAvatar', () => ({
  ProfileAvatar: ({ userId }: { userId?: string }) => (
    <span data-testid="profile-avatar">{userId}</span>
  ),
}));

const REAL_IMAGE = 'https://cdn.example.com/photos/real.jpg';
const RESET_IMAGE = 'https://cdn.example.com/photos/reset.jpg';
const REGISTERED_PLACEHOLDER =
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400';

const asEntity = (value: Record<string, unknown>) => value as unknown as Entity;

const product = asEntity({
  id: 'product-1',
  name: 'Centella Ampoule',
  type: 'product',
  image_url: null,
  description: null,
  average_rating: 0,
  review_count: 0,
});

const parent = asEntity({
  id: 'parent-1',
  name: 'Centella Brand',
  slug: 'centella-brand',
  type: 'brand',
  image_url: REAL_IMAGE,
});

const recommendation = {
  id: 'recommendation-1',
  name: 'Centella Cream',
  type: 'product',
  image_url: null,
  averageRating: 4.5,
  recommendedBy: ['Rishab'],
  recommendedByUserId: ['user-1'],
  recommendedByAvatars: [],
  recommendationCount: 1,
};

beforeEach(() => {
  mockNavigate.mockReset();
  mockTrackRecommendationClick.mockReset();
  sidebarRelatedEntities.value = [];
});

describe('EntityChildrenCard child rows', () => {
  it('keeps the 48px rounded-md frame and preserves a valid child image', () => {
    const { container } = render(
      <EntityChildThumbnail child={asEntity({ ...product, image_url: REAL_IMAGE })} />,
    );
    const frame = container.firstElementChild as HTMLElement;
    const image = screen.getByRole('img', { name: 'Centella Ampoule' });
    expect(frame).toHaveClass('w-12', 'h-12', 'rounded-md', 'overflow-hidden');
    expect(image).toHaveAttribute('src', REAL_IMAGE);
    expect(image).toHaveClass('w-full', 'h-full', 'object-cover');
  });

  it('does not substitute the parent image when the child has no image', () => {
    const viewChild = vi.fn();
    const { container } = render(
      <EntityChildrenCard
        children={[product]}
        parentName="Centella Brand"
        parentEntity={parent}
        onViewChild={viewChild}
      />,
    );

    expect(screen.queryByRole('img', { name: 'Centella Ampoule' })).toBeNull();
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
    expect(container.querySelector(`img[src="${REAL_IMAGE}"]`)).toBeNull();

    const row = screen.getByText('Centella Ampoule').closest('div[class*="cursor-pointer"]');
    fireEvent.click(row as HTMLElement);
    expect(viewChild).toHaveBeenCalledWith(product);
  });

  it('uses the same child-type icon when a valid child image fails', () => {
    const { container } = render(
      <EntityChildThumbnail child={asEntity({ ...product, image_url: REAL_IMAGE })} />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Centella Ampoule' }));
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });

  it('keeps the parent-description fallback unchanged while removing image substitution', () => {
    render(
      <EntityChildrenCard
        children={[product]}
        parentName="Centella Brand"
        parentEntity={asEntity({ ...parent, description: 'Calming skincare' })}
        onViewChild={() => {}}
      />,
    );
    expect(screen.getByText('Calming skincare - Centella Ampoule')).toBeTruthy();
  });
});

describe('EntitySidebar parent and related thumbnails', () => {
  it('keeps the parent 48px rounded-lg object-contain frame for valid images', () => {
    const { container } = render(<ParentEntityThumbnail parentEntity={parent} />);
    const frame = container.firstElementChild as HTMLElement;
    const image = screen.getByRole('img', { name: 'Centella Brand' });
    expect(frame).toHaveClass('w-12', 'h-12', 'rounded-lg', 'p-1');
    expect(image).toHaveAttribute('src', REAL_IMAGE);
    expect(image).toHaveClass('w-full', 'h-full', 'object-contain');
  });

  it('uses the parent type icon for missing, placeholder, and broken parent images', () => {
    const missing = render(<ParentEntityThumbnail parentEntity={asEntity({ ...parent, image_url: null })} />);
    expect(missing.container.querySelector('svg.lucide-building2')).not.toBeNull();
    missing.unmount();

    const placeholder = render(
      <ParentEntityThumbnail parentEntity={asEntity({ ...parent, image_url: REGISTERED_PLACEHOLDER })} />,
    );
    expect(placeholder.container.querySelector('svg.lucide-building2')).not.toBeNull();
    placeholder.unmount();

    const broken = render(<ParentEntityThumbnail parentEntity={parent} />);
    fireEvent.error(screen.getByRole('img', { name: 'Centella Brand' }));
    expect(broken.container.querySelector('svg.lucide-building2')).not.toBeNull();
  });

  it('keeps the related 32px rounded frame and preserves a valid image', () => {
    const { container } = render(
      <RelatedEntityThumbnail relatedEntity={asEntity({ ...product, image_url: REAL_IMAGE })} />,
    );
    const frame = container.firstElementChild as HTMLElement;
    const image = screen.getByRole('img', { name: 'Centella Ampoule' });
    expect(frame).toHaveClass('w-8', 'h-8', 'rounded', 'overflow-hidden');
    expect(image).toHaveAttribute('src', REAL_IMAGE);
    expect(image).toHaveClass('w-full', 'h-full', 'object-cover');
  });

  it('uses the same related-type icon when a related image fails', () => {
    const { container } = render(
      <RelatedEntityThumbnail relatedEntity={asEntity({ ...product, image_url: REAL_IMAGE })} />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Centella Ampoule' }));
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });

  it('uses the neutral icon for an unknown related type', () => {
    const { container } = render(
      <RelatedEntityThumbnail relatedEntity={asEntity({ ...product, type: 'hovercraft' })} />,
    );
    expect(container.querySelector('svg.lucide-tag')).not.toBeNull();
    expect(container.querySelector('svg.lucide-package')).toBeNull();
  });

  it('preserves parent and related row navigation', () => {
    const related = asEntity({ ...product, id: 'related-1', name: 'Related Ampoule' });
    sidebarRelatedEntities.value = [related];
    render(
      <MemoryRouter>
        <EntitySidebar
          entity={asEntity({ ...product, id: 'current-1', name: 'Current Product' })}
          parentEntity={parent}
        />
      </MemoryRouter>,
    );

    const parentRow = screen.getByText('Centella Brand').closest('div[class*="cursor-pointer"]');
    fireEvent.click(parentRow as HTMLElement);
    expect(mockNavigate).toHaveBeenCalledWith('/entity/parent-1');

    const relatedRow = screen.getByText('Related Ampoule').closest('div[class*="cursor-pointer"]');
    fireEvent.click(relatedRow as HTMLElement);
    expect(mockNavigate).toHaveBeenCalledWith('/entity/related-1');
  });
});

describe('RecommendationEntityCard thumbnail', () => {
  it('keeps the 64px rounded-md frame and preserves a valid image', () => {
    const { container } = render(
      <RecommendationEntityThumbnail recommendation={{ ...recommendation, image_url: REAL_IMAGE }} />,
    );
    const frame = container.firstElementChild as HTMLElement;
    const image = screen.getByRole('img', { name: 'Centella Cream' });
    expect(frame).toHaveClass('w-16', 'h-16', 'rounded-md', 'overflow-hidden');
    expect(image).toHaveAttribute('src', REAL_IMAGE);
    expect(image).toHaveClass('w-full', 'h-full', 'object-cover');
  });

  it('replaces only the entity initial with the canonical type icon', () => {
    const { container } = render(
      <MemoryRouter>
        <RecommendationEntityCard recommendation={recommendation} isNetworkRecommendation />
      </MemoryRouter>,
    );

    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
    expect(screen.queryByText('C')).toBeNull();
    expect(screen.getByTestId('profile-avatar')).toHaveTextContent('user-1');

    const card = screen.getByText('Centella Cream').closest('div[class*="cursor-pointer"]');
    fireEvent.click(card as HTMLElement);
    expect(mockTrackRecommendationClick).toHaveBeenCalledWith(
      'recommendation-1',
      'Centella Cream',
      true,
      'main',
    );
    expect(mockNavigate).toHaveBeenCalledWith('/entity/recommendation-1');
  });

  it('uses the same icon when the recommendation image fails', () => {
    const { container } = render(
      <RecommendationEntityThumbnail recommendation={{ ...recommendation, image_url: REAL_IMAGE }} />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Centella Cream' }));
    expect(container.querySelector('svg.lucide-package')).not.toBeNull();
  });

  it('resets failure state when switching from a broken entity to a valid entity', () => {
    const { rerender } = render(
      <RecommendationEntityThumbnail recommendation={{ ...recommendation, image_url: REAL_IMAGE }} />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Centella Cream' }));

    rerender(
      <RecommendationEntityThumbnail
        recommendation={{
          ...recommendation,
          id: 'recommendation-2',
          name: 'Ginseng Essence',
          image_url: RESET_IMAGE,
        }}
      />,
    );

    const image = screen.getByRole('img', { name: 'Ginseng Essence' });
    expect(image).toHaveAttribute('src', RESET_IMAGE);
  });
});
