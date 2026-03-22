import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SavedItemType = 'all' | 'post' | 'entity';

export interface SavedItem {
  id: string;
  type: 'post' | 'entity';
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

    // Fetch saved posts
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
            const { data: profile } = await supabase
              .from('profiles')
              .select(PROFILE_COLUMNS)
              .eq('id', post.user_id)
              .single();

            const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username;

            results.push({
              id: save.id,
              type: 'post',
              saved_at: save.created_at,
              content: {
                ...post,
                username: profile?.username,
                avatar_url: profile?.avatar_url,
                displayName,
              },
            });
          }
        }
      }
    }

    // Fetch saved entities
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
      case 'entity':
        return unsaveEntity.mutateAsync(item.id);
    }
  }, [unsavePost, unsaveEntity]);

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    loadMore,
    hasMore,
    unsaveItem,
    isUnsaving: unsavePost.isPending || unsaveEntity.isPending,
  };
};
