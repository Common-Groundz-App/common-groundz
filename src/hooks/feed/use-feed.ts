import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FeedItem, FeedVisibility, FeedState } from './types';
import { toggleLike, toggleSave } from '@/services/recommendationService';

const ITEMS_PER_PAGE = 10;

export const useFeed = (feedType: FeedVisibility) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<FeedState>({
    items: [],
    isLoading: true,
    error: null,
    hasMore: false,
    page: 0,
    isLoadingMore: false
  });

  const fetchFeed = useCallback(async (page: number = 0, reset: boolean = false) => {
    if (!user) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: new Error('User not authenticated'),
        items: []
      }));
      return;
    }

    try {
      const offset = page * ITEMS_PER_PAGE;
      let query;
      
      // Instead of using RPC functions that don't exist yet, we'll use direct database queries
      if (feedType === 'for_you') {
        // For "For You" feed, we'll get all public recommendations ordered by created_at
        query = supabase
          .from('recommendations')
          .select(`
            id, 
            title, 
            venue, 
            description, 
            rating, 
            image_url, 
            category, 
            visibility, 
            is_certified, 
            view_count, 
            user_id, 
            created_at, 
            updated_at,
            entities!entity_id (id, name, type, venue, description, image_url)
          `)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);
      } else {
        // For "Following" feed, get recommendations from users the current user follows
        const { data: followingIds } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        const followingUserIds = followingIds?.map(follow => follow.following_id) || [];
        
        // If user isn't following anyone, return empty array
        if (followingUserIds.length === 0) {
          setState(prev => ({
            ...prev,
            items: [],
            hasMore: false,
            page,
            isLoading: false,
            isLoadingMore: false,
            error: null
          }));
          return;
        }
        
        query = supabase
          .from('recommendations')
          .select(`
            id, 
            title, 
            venue, 
            description, 
            rating, 
            image_url, 
            category, 
            visibility, 
            is_certified, 
            view_count, 
            user_id, 
            created_at, 
            updated_at,
            entities!entity_id (id, name, type, venue, description, image_url)
          `)
          .in('user_id', followingUserIds)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .range(offset, offset + ITEMS_PER_PAGE - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Get likes and saves for each recommendation
      if (data && data.length > 0) {
        // Get recommendation IDs
        const recommendationIds = data.map(item => item.id);
        
        // Get likes for the current user
        const { data: userLikes } = await supabase
          .from('recommendation_likes')
          .select('recommendation_id')
          .eq('user_id', user.id)
          .in('recommendation_id', recommendationIds);
          
        // Get saves for the current user
        const { data: userSaves } = await supabase
          .from('recommendation_saves')
          .select('recommendation_id')
          .eq('user_id', user.id)
          .in('recommendation_id', recommendationIds);
          
        // Fetch all likes and count them in JS
        const { data: allLikes } = await supabase
          .from('recommendation_likes')
          .select('recommendation_id')
          .in('recommendation_id', recommendationIds);
          
        // Count likes for each recommendation
        const likesCount: Record<string, number> = {};
        allLikes?.forEach(like => {
          if (like.recommendation_id) {
            likesCount[like.recommendation_id] = (likesCount[like.recommendation_id] || 0) + 1;
          }
        });
        
        // Fetch user profiles in a separate query
        const userIds = Array.from(new Set(data.map(item => item.user_id)));
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        
        // Create a lookup map for profiles
        const profilesMap: Record<string, { username: string | null, avatar_url: string | null }> = {};
        profiles?.forEach(profile => {
          profilesMap[profile.id] = {
            username: profile.username,
            avatar_url: profile.avatar_url
          };
        });
        
        // Map the data to FeedItem format
        const items = data.map(item => {
          const likes = likesCount[item.id] || 0;
          const is_liked = userLikes?.some(like => like.recommendation_id === item.id) || false;
          const is_saved = userSaves?.some(save => save.recommendation_id === item.id) || false;
          const profile = profilesMap[item.user_id] || { username: null, avatar_url: null };
          
          return {
            ...item,
            likes,
            is_liked,
            is_saved,
            username: profile.username,
            avatar_url: profile.avatar_url,
            entity: item.entities
          } as FeedItem;
        });
        
        setState(prev => ({
          ...prev,
          items: reset ? items : [...prev.items, ...items],
          hasMore: items.length === ITEMS_PER_PAGE,
          page,
          isLoading: false,
          isLoadingMore: false,
          error: null
        }));
      } else {
        // No data returned
        setState(prev => ({
          ...prev,
          items: reset ? [] : prev.items,
          hasMore: false,
          page,
          isLoading: false,
          isLoadingMore: false,
          error: null
        }));
      }
    } catch (error) {
      console.error(`Error fetching ${feedType} feed:`, error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoadingMore: false,
        error: error instanceof Error ? error : new Error('Failed to fetch feed')
      }));
    }
  }, [user, feedType]);

  useEffect(() => {
    setState(prev => ({ ...prev, isLoading: true }));
    fetchFeed(0, true);
  }, [fetchFeed]);

  const loadMore = useCallback(() => {
    if (state.isLoadingMore || !state.hasMore) return;
    
    setState(prev => ({ ...prev, isLoadingMore: true }));
    fetchFeed(state.page + 1);
  }, [state.isLoadingMore, state.hasMore, state.page, fetchFeed]);

  const refreshFeed = useCallback(() => {
    setState(prev => ({ ...prev, isLoading: true }));
    fetchFeed(0, true);
  }, [fetchFeed]);

  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like recommendations',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = state.items.find(r => r.id === id);
      if (!item) return;

      setState(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (item.id === id) {
            const isLiked = !item.is_liked;
            return {
              ...item,
              is_liked: isLiked,
              likes: (item.likes || 0) + (isLiked ? 1 : -1)
            };
          }
          return item;
        })
      }));

      await toggleLike(id, user.id, !!item.is_liked);
    } catch (err) {
      console.error('Error toggling like:', err);
      refreshFeed();
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleSave = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save recommendations',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = state.items.find(r => r.id === id);
      if (!item) return;

      setState(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (item.id === id) {
            return {
              ...item,
              is_saved: !item.is_saved
            };
          }
          return item;
        })
      }));

      await toggleSave(id, user.id, !!item.is_saved);
    } catch (err) {
      console.error('Error toggling save:', err);
      refreshFeed();
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return {
    ...state,
    loadMore,
    refreshFeed,
    handleLike,
    handleSave
  };
};
