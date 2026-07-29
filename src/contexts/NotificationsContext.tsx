import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNotifications, type UseNotificationsResult } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';

/**
 * The app-wide notifications state owner.
 *
 * Exactly ONE `useNotifications()` instance exists in the app, and it lives
 * here. Every consumer reads through `useNotificationsContext()` so there is a
 * single poller, a single notification array, and a badge that updates the
 * instant any surface marks a row read.
 *
 * This module deliberately does NOT import `NotificationDrawer` — App renders
 * the single drawer inside the provider, which keeps the module graph acyclic:
 *   NotificationsContext -> useNotifications
 *   NotificationDrawer   -> useNotificationsContext
 *   App                  -> both
 */

// Explicit public contract. `Pick` keeps these fields type-accurate against the
// hook, but it does not force future hook fields to be exposed — widening this
// surface is always a deliberate edit here.
type NotificationsData = Pick<
  UseNotificationsResult,
  | 'notifications'
  | 'unreadNotifications'
  | 'unreadCount'
  | 'countStatus'
  | 'loadedUnreadCount'
  | 'loading'
  | 'isRefreshing'
  | 'markingAsRead'
  | 'fetchError'
  | 'isOnline'
  | 'lastRefresh'
  | 'markAsRead'
  | 'markAllAsRead'
  | 'markAllPending'
  | 'hasMore'
  | 'isLoadingMore'
  | 'pageError'
  | 'loadMore'
  | 'recoverPagination'
  | 'isRecovering'
  | 'fetchAll'
>;

interface NotificationsContextValue extends NotificationsData {
  isNotificationsOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  setNotificationsOpen: (open: boolean) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const {
    notifications,
    unreadNotifications,
    unreadCount,
    countStatus,
    loadedUnreadCount,
    loading,
    isRefreshing,
    markingAsRead,
    fetchError,
    isOnline,
    lastRefresh,
    markAsRead,
    markAllAsRead,
    markAllPending,
    hasMore,
    isLoadingMore,
    pageError,
    loadMore,
    recoverPagination,
    isRecovering,
    fetchAll,
  } = useNotifications();

  const [isNotificationsOpen, setNotificationsOpen] = useState(false);

  const openNotifications = useCallback(() => setNotificationsOpen(true), []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);

  // Sign-out / account switch must never leave a drawer of the previous
  // session hanging over a public or freshly-signed-in page.
  useEffect(() => {
    setNotificationsOpen(false);
  }, [user?.id]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadNotifications,
      unreadCount,
      countStatus,
      loadedUnreadCount,
      loading,
      isRefreshing,
      markingAsRead,
      fetchError,
      isOnline,
      lastRefresh,
      markAsRead,
      markAllAsRead,
      markAllPending,
      hasMore,
      isLoadingMore,
      pageError,
      loadMore,
      recoverPagination,
      isRecovering,
      fetchAll,
      isNotificationsOpen,
      openNotifications,
      closeNotifications,
      setNotificationsOpen,
    }),
    [
      notifications,
      unreadNotifications,
      unreadCount,
      countStatus,
      loadedUnreadCount,
      loading,
      isRefreshing,
      markingAsRead,
      fetchError,
      isOnline,
      lastRefresh,
      markAsRead,
      markAllAsRead,
      markAllPending,
      hasMore,
      isLoadingMore,
      pageError,
      loadMore,
      fetchAll,
      isNotificationsOpen,
      openNotifications,
      closeNotifications,
    ]
  );

  // Always renders children — signed in or out. Gating here would unmount every
  // page inside the provider on public routes.
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return ctx;
}
