
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { PostFeedItem } from '@/hooks/feed/api/posts/types';
import { fetchEntityPosts } from '@/services/entityPostsService';

export function useEntityPosts(entityId?: string) {
  const { user } = useAuth();
  const [items, setItems] = useState<PostFeedItem[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;

  const reset = useCallback(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
  }, []);

  const fetchNext = useCallback(async () => {
    if (!entityId || isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const batch = await fetchEntityPosts(entityId, user?.id || null, page, pageSize);
      setItems(prev => [...prev, ...batch]);
      setPage(prev => prev + 1);
      if (batch.length < pageSize) setHasMore(false);
    } catch (e) {
      console.error('useEntityPosts fetchNext error:', e);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [entityId, user?.id, page, pageSize, isLoading, hasMore]);

  const fetchFirst = useCallback(async () => {
    if (!entityId || isLoading) return;
    setIsLoading(true);
    try {
      const batch = await fetchEntityPosts(entityId, user?.id || null, 0, pageSize);
      setItems(batch);
      setPage(1);
      setHasMore(batch.length >= pageSize);
    } catch (e) {
      console.error('useEntityPosts fetchFirst error:', e);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [entityId, user?.id, pageSize, isLoading]);

  return { items, isLoading, hasMore, fetchNext, fetchFirst, reset };
}
