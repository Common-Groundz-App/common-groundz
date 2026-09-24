import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Group 6B — the legacy entity pages v1/v2/v3 are retired.
 * (a) Route selection: the doorway always renders V4 and never rewrites the query.
 * (b) Metadata: the real V4 builds its canonical from the slug only.
 */

const seoProps = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));

describe('Group 6B (a) — the doorway always renders V4', () => {
  beforeEach(() => { vi.resetModules(); });

  const LocationProbe = () => {
    const loc = useLocation();
    return <div data-testid="loc">{loc.pathname + loc.search}</div>;
  };

  const mountDoorway = async (url: string) => {
    vi.doMock('@/components/entity-v4/EntityV4', () => ({ default: () => <div data-testid="entity-v4" /> }));
    vi.doMock('@/components/entity/EntityV4LoadingWrapper', () => ({ EntityV4LoadingWrapper: () => <div data-testid="loading" /> }));
    const { default: EntityDetail } = await import('@/pages/EntityDetail');
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/entity/:slug" element={<><EntityDetail /><LocationProbe /></>} />
          <Route path="/entity/:parentSlug/:childSlug" element={<><EntityDetail /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );
  };

  const variants = ['', '?v=1', '?v=2', '?v=3', '?v=4', '?preview=true', '?v=junk', '?compose=review'];
  for (const base of ['/entity/isha-foundation-chikkaballapura', '/entity/parent-brand/child-item']) {
    for (const q of variants) {
      it(`renders V4 for ${base}${q} and keeps the query`, async () => {
        await mountDoorway(base + q);
        expect(await screen.findByTestId('entity-v4')).toBeInTheDocument();
        expect(screen.getByTestId('loc').textContent).toBe(base + q);
      });
    }
  }

  it('the retired modules are gone and nothing imports them', () => {
    const root = path.resolve(__dirname, '..');
    for (const p of ['pages/EntityDetailV2.tsx', 'utils/entityVersionUtils.ts', 'components/entity-v3']) {
      expect(fs.existsSync(path.join(root, p))).toBe(false);
    }
    const doorway = fs.readFileSync(path.join(root, 'pages/EntityDetail.tsx'), 'utf8');
    expect(doorway).not.toMatch(/EntityDetailV2|entity-v3|entityVersionUtils|EntityDetailOriginal|setSearchParams|navigate\(/);
  });
});

// ---- (b) metadata on the real V4 ----
vi.mock('@/components/seo/SEOHead', () => ({
  default: (props: Record<string, unknown>) => { seoProps.calls.push(props); return null; },
}));
vi.mock('@/components/seo/EntityStructuredData', () => ({ default: () => null }));
vi.mock('@/components/NavBarComponent', () => ({ default: () => null, NavBarComponent: () => null }));
vi.mock('@/components/profile/GuestNavBar', () => ({ default: () => null }));
vi.mock('@/components/navigation/BottomNavigation', () => ({ BottomNavigation: () => null }));
vi.mock('@/components/entity-v4/EntityHeader', () => ({ EntityHeader: () => null }));
vi.mock('@/components/entity-v4/MediaPreviewSection', () => ({ MediaPreviewSection: () => null }));
vi.mock('@/components/entity-v4/TrustSummaryCard', () => ({ TrustSummaryCard: () => null }));
vi.mock('@/components/entity-v4/ReviewsSection', () => ({ ReviewsSection: () => null }));
vi.mock('@/components/entity-v4/EntitySidebar', () => ({ EntitySidebar: () => null }));
vi.mock('@/components/entity-v4/EntityTabsContent', () => ({ EntityTabsContent: () => null }));
vi.mock('@/components/entity/EntityModerationBanner', () => ({ EntityModerationBanner: () => null }));
vi.mock('@/components/entity/EntityFollowerModal', () => ({ EntityFollowerModal: () => null }));
vi.mock('@/components/entity/EntityRecommendationModal', () => ({ EntityRecommendationModal: () => null }));
vi.mock('@/components/profile/reviews/ReviewForm', () => ({ default: () => null }));
vi.mock('@/components/profile/reviews/ReviewTimelineViewer', () => ({ ReviewTimelineViewer: () => null }));
vi.mock('@/hooks/use-entity-detail-cached', () => ({
  useEntityDetailCached: () => ({
    entity: { id: 'e1', name: 'Isha Foundation Chikkaballapura', slug: 'isha-foundation-chikkaballapura', type: 'place', description: 'A place', image_url: null },
    reviews: [], stats: null, isLoading: false, isRefetching: false, redirectToSlug: null, error: null,
  }),
}));
vi.mock('@/hooks/use-entity-hierarchy', () => ({ useEntityHierarchy: () => ({ entityWithChildren: null, parentEntity: null, isLoading: false, error: null, hasChildren: false, hasParent: false }) }));
vi.mock('@/hooks/use-entity-siblings', () => ({ useEntitySiblings: () => ({ siblings: [], isLoading: false, error: null }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, isLoading: false }) }));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false }) }));
vi.mock('@/hooks/useAuthPrompt', () => ({ useAuthPrompt: () => ({ requireAuth: () => false }) }));
vi.mock('@/hooks/recommendations/use-entity-refresh', () => ({ useEntityImageRefresh: () => ({ refreshEntityImage: vi.fn(), isRefreshing: false }) }));
vi.mock('@/hooks/useUserFollowing', () => ({ useUserFollowing: () => ({ data: [], isLoading: false, error: null, isError: false }) }));
vi.mock('@/hooks/use-entity-timeline-summary', () => ({ useEntityTimelineSummary: () => ({ summary: null, isLoading: false, error: null }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@tanstack/react-query', async (orig) => ({ ...(await orig<object>()), useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }) }));

describe('Group 6B (b) — V4 canonical ignores obsolete query parameters', () => {
  for (const q of ['', '?v=1', '?v=2', '?v=3', '?v=4', '?preview=true', '?v=junk']) {
    it(`canonical is the plain entity address for ${q || 'no query'}`, async () => {
      vi.resetModules();
      seoProps.calls = [];
      const { default: EntityV4 } = await vi.importActual<{ default: React.ComponentType }>('@/components/entity-v4/EntityV4');
      render(
        <MemoryRouter initialEntries={[`/entity/isha-foundation-chikkaballapura${q}`]}>
          <Routes><Route path="/entity/:slug" element={<EntityV4 />} /></Routes>
        </MemoryRouter>,
      );
      await waitFor(() => expect(seoProps.calls.length).toBeGreaterThan(0));
      const last = seoProps.calls[seoProps.calls.length - 1];
      expect(last.canonical).toBe(`${window.location.origin}/entity/isha-foundation-chikkaballapura`);
      expect(last.title).toBe('Isha Foundation Chikkaballapura — Common Groundz');
      expect(String(last.canonical)).not.toContain('?');
    });
  }
});
