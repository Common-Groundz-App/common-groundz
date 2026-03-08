import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SavedItemType = 'all' | 'post' | 'review' | 'recommendation' | 'entity';

export interface SavedItem {
  id: string;
  type: 'post' | 'review' | 'recommendation' | 'entity';
  saved_at: string;
  content: any;
}

const ITEMS_PER_PAGE = 20;

// Safe profile columns to avoid RLS issues
const PROFILE_COLUMNS = 'id, username, avatar_url, first_name, last_name';

export const useSavedItems = (typeFilter: SavedItemType = 'all') => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const fetchSavedItems = async (): Promise<SavedItem[]> => {
    if (!user?.id) return [];

    const results: SavedItem[] = [];
    const limit = ITEMS_PER_PAGE * (page + 1);

    // Fetch based on filter
    if (typeFilter === 'all' || typeFilter === 'post') {
      const { data: postSaves, error: postError } = await supabase
        .from('post_saves')
        .select(`
          id,
          created_at,
          post_id,
          posts!inner (
            id,
            title,
            content,
            post_type,
            visibility,
            created_at,
            updated_at,
            user_id,
            is_deleted,
            tags,
            media
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!postError && postSaves) {
        for (const save of postSaves) {
          const post = save.posts as any;
          if (post && !post.is_deleted) {
            // Fetch profile separately to respect column restrictions
            const { data: profile } = await supabase
              .from('profiles')
              .select(PROFILE_COLUMNS)
              .eq('id', post.user_id)
              .single();

            results.push({
              id: save.id,
              type: 'post',
              saved_at: save.created_at,
              content: {
                ...post,
                username: profile?.username,
                avatar_url: profile?.avatar_url,
              },
            });
          }
        }
      }
    }

    if (typeFilter === 'all' || typeFilter === 'review') {
      const { data: reviewSaves, error: reviewError } = await supabase
        .from('review_saves')
        .select(`
          id,
          created_at,
          review_id,
          reviews!inner (
            id,
            rating,
            review_text,
            created_at,
            updated_at,
            user_id,
            entity_id,
            is_deleted,
            media
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!reviewError && reviewSaves) {
        for (const save of reviewSaves) {
          const review = save.reviews as any;
          if (review && !review.is_deleted) {
            // Fetch profile and entity
            const [{ data: profile }, { data: entity }] = await Promise.all([
              supabase
                .from('profiles')
                .select(PROFILE_COLUMNS)
                .eq('id', review.user_id)
                .single(),
              supabase
                .from('entities')
                .select('id, name, type, image_url, slug')
                .eq('id', review.entity_id)
                .single(),
            ]);

            results.push({
              id: save.id,
              type: 'review',
              saved_at: save.created_at,
              content: {
                ...review,
                username: profile?.username,
                avatar_url: profile?.avatar_url,
                entity,
              },
            });
          }
        }
      }
    }

    if (typeFilter === 'all' || typeFilter === 'recommendation') {
      const { data: recSaves, error: recError } = await supabase
        .from('recommendation_saves')
        .select(`
          id,
          created_at,
          recommendation_id,
          recommendations!inner (
            id,
            title,
            description,
            created_at,
            updated_at,
            user_id,
            entity_id,
            is_deleted,
            media
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!recError && recSaves) {
        for (const save of recSaves) {
          const rec = save.recommendations as any;
          if (rec && !rec.is_deleted) {
            // Fetch profile and entity
            const [{ data: profile }, { data: entity }] = await Promise.all([
              supabase
                .from('profiles')
                .select(PROFILE_COLUMNS)
                .eq('id', rec.user_id)
                .single(),
              supabase
                .from('entities')
                .select('id, name, type, image_url, slug')
                .eq('id', rec.entity_id)
                .single(),
            ]);

            results.push({
              id: save.id,
              type: 'recommendation',
              saved_at: save.created_at,
              content: {
                ...rec,
                username: profile?.username,
                avatar_url: profile?.avatar_url,
                entity,
              },
            });
          }
        }
      }
    }

    if (typeFilter === 'all' || typeFilter === 'entity') {
      const { data: entitySaves, error: entityError } = await supabase
        .from('entity_saves')
        .select(`
          id,
          created_at,
          entity_id,
          entities!inner (
            id,
            name,
            type,
            description,
            image_url,
            slug,
            is_deleted
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!entityError && entitySaves) {
        for (const save of entitySaves) {
          const entity = save.entities as any;
          if (entity && !entity.is_deleted) {
            results.push({
              id: save.id,
              type: 'entity',
              saved_at: save.created_at,
              content: entity,
            });
          }
        }
      }
    }

    // Global sort by saved_at DESC when fetching all types
    if (typeFilter === 'all') {
      results.sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());
    }

    return results.slice(0, ITEMS_PER_PAGE * (page + 1));
  };

  const query = useQuery({
    queryKey: ['saved-items', user?.id, typeFilter, page],
    queryFn: fetchSavedItems,
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const loadMore = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const hasMore = (query.data?.length ?? 0) >= ITEMS_PER_PAGE * (page + 1);

  // Unsave mutations
  const unsavePost = useMutation({
    mutationFn: async (saveId: string) => {
      const { error } = await supabase
        .from('post_saves')
        .delete()
        .eq('id', saveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });

  const unsaveReview = useMutation({
    mutationFn: async (saveId: string) => {
      const { error } = await supabase
        .from('review_saves')
        .delete()
        .eq('id', saveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });

  const unsaveRecommendation = useMutation({
    mutationFn: async (saveId: string) => {
      const { error } = await supabase
        .from('recommendation_saves')
        .delete()
        .eq('id', saveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });

  const unsaveEntity = useMutation({
    mutationFn: async (saveId: string) => {
      const { error } = await supabase
        .from('entity_saves')
        .delete()
        .eq('id', saveId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-items'] });
    },
  });

  const unsaveItem = useCallback(async (item: SavedItem) => {
    switch (item.type) {
      case 'post':
        return unsavePost.mutateAsync(item.id);
      case 'review':
        return unsaveReview.mutateAsync(item.id);
      case 'recommendation':
        return unsaveRecommendation.mutateAsync(item.id);
      case 'entity':
        return unsaveEntity.mutateAsync(item.id);
    }
  }, [unsavePost, unsaveReview, unsaveRecommendation, unsaveEntity]);

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    loadMore,
    hasMore,
    unsaveItem,
    isUnsaving: unsavePost.isPending || unsaveReview.isPending || unsaveRecommendation.isPending || unsaveEntity.isPending,
  };
};
