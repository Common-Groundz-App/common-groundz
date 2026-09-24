import React from 'react';
import * as ReactNS from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/** Group 6C — retired legacy routes fall through to NotFound; live routes still resolve. */
const { page, pass } = vi.hoisted(() => ({
  page: (id: string) => ({ default: () => require('react').createElement('div', { 'data-testid': id }) }),
  pass: { default: ({ children }: { children: React.ReactNode }) => children as React.ReactElement },
}));

vi.mock('@/pages/NotFound', () => page('not-found'));
vi.mock('@/pages/Search', () => page('search'));
vi.mock('@/pages/Explore', () => page('explore'));
vi.mock('@/pages/MyStuffPage', () => page('my-stuff'));
vi.mock('@/pages/Index', () => page('Index'));
vi.mock('@/pages/Feed', () => page('Feed'));
vi.mock('@/pages/Auth', () => page('Auth'));
vi.mock('@/pages/Profile', () => page('Profile'));
vi.mock('@/pages/Settings', () => page('Settings'));
vi.mock('@/pages/SavedInsights', () => page('SavedInsights'));
vi.mock('@/pages/EntityDetail', () => page('EntityDetail'));
vi.mock('@/pages/PostView', () => page('PostView'));
vi.mock('@/pages/TagPage', () => page('TagPage'));
vi.mock('@/pages/AdminPortal', () => page('AdminPortal'));
vi.mock('@/pages/admin/AdminEntityEdit', () => page('AdminEntityEdit'));
vi.mock('@/pages/YourData', () => page('YourData'));
vi.mock('@/pages/UserProfile', () => page('UserProfile'));
vi.mock('@/pages/ResetPassword', () => page('ResetPassword'));
vi.mock('@/pages/CompleteProfile', () => page('CompleteProfile'));
vi.mock('@/pages/AccountDeleted', () => page('AccountDeleted'));
vi.mock('@/pages/CreatePost', () => page('CreatePost'));
vi.mock('@/pages/PrivacyPolicy', () => page('PrivacyPolicy'));
vi.mock('@/pages/TermsOfService', () => page('TermsOfService'));
vi.mock('@/pages/CookiePolicy', () => page('CookiePolicy'));
vi.mock('@/components/ProfileRedirect', () => page('ProfileRedirect'));
vi.mock('@/components/AuthErrorBoundary', () => pass);
vi.mock('@/components/AuthInitializer', () => pass);
vi.mock('@/components/ProtectedRoute', () => pass);
vi.mock('@/components/AppProtectedRoute', () => pass);
vi.mock('@/components/AdminRoute', () => pass);
vi.mock('@/components/auth/RequireCompleteProfile', () => pass);
vi.mock('@/components/OfflineBanner', () => ({ default: () => null }));
vi.mock('@/components/ScrollToTop', () => ({ default: () => null }));
vi.mock('@/components/system/PrewarmFlagBridge', () => ({ default: () => null }));
vi.mock('@/components/notifications/NotificationDrawer', () => ({ NotificationDrawer: () => null }));
vi.mock('@/components/ui/toaster', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/contexts/ThemeContext', () => ({ ThemeProvider: pass.default }));
vi.mock('@/contexts/AuthPromptContext', () => ({ AuthPromptProvider: pass.default }));
vi.mock('@/contexts/NotificationsContext', () => ({ NotificationsProvider: pass.default }));
vi.mock('@/contexts/ComposerFocusContext', () => ({ ComposerFocusProvider: pass.default }));
vi.mock('@/services/feedbackService', () => ({ preloadSounds: () => {} }));
vi.mock('howler', () => ({ Howl: class { play() {} } }));
vi.mock('@/services/networkStatusService', () => ({
  networkStatusService: { subscribe: () => () => {}, getSnapshot: () => ({ isOnline: true }) },
}));

import App from '@/App';

const at = (path: string) => { window.history.pushState({}, '', path); render(<App />); };

describe('Group 6C — retired legacy routes', () => {
  for (const p of ['/product-search/books', '/product-search/skin%20care', '/books', '/movies', '/places', '/food', '/products']) {
    it(`${p} shows the normal not-found page`, () => {
      at(p);
      expect(screen.getByTestId('not-found')).toBeInTheDocument();
      expect(window.location.pathname + window.location.search).toBe(p);
    });
  }
  for (const [p, id] of [['/search', 'search'], ['/search?q=books&mode=quick', 'search'], ['/explore', 'explore'], ['/my-stuff', 'my-stuff']]) {
    it(`${p} still opens its page`, () => {
      at(p);
      expect(screen.getByTestId(id)).toBeInTheDocument();
    });
  }
});
