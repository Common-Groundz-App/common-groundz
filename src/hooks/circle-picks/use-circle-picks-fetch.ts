
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseCirclePicksFetchProps {
  userId?: string;
  category?: string;
  sortBy: 'recent' | 'most_liked' | 'highest_rated';
}

// Define valid categories that exist in the database
const DB_CATEGORIES = ['food', 'book', 'movie', 'place', 'product'] as const;
type DbCategory = typeof DB_CATEGORIES[number];

// Map frontend categories to database categories (only for supported ones)
function mapCategoryToDb(category: string): DbCategory | null {
  const categoryMap: Record<string, DbCategory> = {
    'Food': 'food',
    'Book': 'book',
    'Movie': 'movie',
    'Place': 'place',
    'Product': 'product'
  };
  
  return categoryMap[category] || null;
}

export const useCirclePicksFetch = ({ 
  userId, 
  category, 
  sortBy 
}: UseCirclePicksFetchProps) => {
  const { toast } = useToast();

  // Fetch followed users' content
  const { 
    data: followedContent, 
    isLoading: isLoadingFollowed, 
    error: followedError 
  } = useQuery({
    queryKey: ['circle-picks-followed', userId, category, sortBy],
    queryFn: async () => {
      if (!userId) return { recommendations: [], reviews: [] };

      // Get followed user IDs first
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (followsError) throw followsError;

      const followedIds = follows?.map(f => f.following_id) || [];
      
      if (followedIds.length === 0) {
        return { recommendations: [], reviews: [] };
      }

      const dbCategory = category && category !== 'all' ? mapCategoryToDb(category) : null;
      
      // Fetch recommendations with simple select
      let recQuery = supabase
        .from('recommendations')
        .select(`
          id,
          title,
          description,
          rating,
          category,
          image_url,
          created_at,
          user_id,
          entity_id,
          venue,
          visibility,
          is_certified,
          view_count,
          comment_count
        `)
        .in('user_id', followedIds)
        .eq('is_deleted', false);

      // Apply category filter only if it's a valid database category
      if (dbCategory) {
        recQuery = recQuery.eq('category', dbCategory);
      }

      // Apply sorting
      if (sortBy === 'recent') {
        recQuery = recQuery.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        recQuery = recQuery.order('rating', { ascending: false });
      }

      const { data: recommendations, error: recError } = await recQuery.limit(20);
      
      if (recError) throw recError;

      // Fetch reviews with simple select
      let reviewQuery = supabase
        .from('reviews')
        .select(`
          id,
          title,
          description,
          rating,
          category,
          image_url,
          created_at,
          user_id,
          entity_id,
          venue,
          visibility,
          status,
          subtitle,
          experience_date,
          media,
          metadata
        `)
        .in('user_id', followedIds)
        .eq('is_deleted', false);

      // For reviews, we can filter by any category since reviews table might support more categories
      if (category && category !== 'all') {
        reviewQuery = reviewQuery.eq('category', category);
      }

      // Apply sorting
      if (sortBy === 'recent') {
        reviewQuery = reviewQuery.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        reviewQuery = reviewQuery.order('rating', { ascending: false });
      }

      const { data: reviews, error: reviewError } = await reviewQuery.limit(20);
      
      if (reviewError) throw reviewError;

      // Get user profiles separately to avoid complex joins
      const allUserIds = [
        ...new Set([
          ...(recommendations || []).map(r => r.user_id),
          ...(reviews || []).map(r => r.user_id)
        ])
      ];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', allUserIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Format the data with profile information
      const formattedRecommendations = (recommendations || []).map(rec => ({
        ...rec,
        username: profilesMap.get(rec.user_id)?.username || 'Unknown',
        avatar_url: profilesMap.get(rec.user_id)?.avatar_url || null
      }));

      const formattedReviews = (reviews || []).map(review => ({
        ...review,
        username: profilesMap.get(review.user_id)?.username || 'Unknown',
        avatar_url: profilesMap.get(review.user_id)?.avatar_url || null
      }));

      return {
        recommendations: formattedRecommendations,
        reviews: formattedReviews
      };
    },
    enabled: !!userId,
  });

  // Fetch user's own content
  const { 
    data: myContent, 
    isLoading: isLoadingMy, 
    error: myError 
  } = useQuery({
    queryKey: ['circle-picks-my-content', userId, category, sortBy],
    queryFn: async () => {
      if (!userId) return { recommendations: [], reviews: [] };

      const dbCategory = category && category !== 'all' ? mapCategoryToDb(category) : null;
      
      // Fetch user's recommendations with simple select
      let myRecQuery = supabase
        .from('recommendations')
        .select(`
          id,
          title,
          description,
          rating,
          category,
          image_url,
          created_at,
          user_id,
          entity_id,
          venue,
          visibility,
          is_certified,
          view_count,
          comment_count
        `)
        .eq('user_id', userId)
        .eq('is_deleted', false);

      // Apply category filter only if it's a valid database category
      if (dbCategory) {
        myRecQuery = myRecQuery.eq('category', dbCategory);
      }

      if (sortBy === 'recent') {
        myRecQuery = myRecQuery.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        myRecQuery = myRecQuery.order('rating', { ascending: false });
      }

      const { data: myRecommendations, error: myRecError } = await myRecQuery.limit(10);
      
      if (myRecError) throw myRecError;

      // Fetch user's reviews with simple select
      let myReviewQuery = supabase
        .from('reviews')
        .select(`
          id,
          title,
          description,
          rating,
          category,
          image_url,
          created_at,
          user_id,
          entity_id,
          venue,
          visibility,
          status,
          subtitle,
          experience_date,
          media,
          metadata
        `)
        .eq('user_id', userId)
        .eq('is_deleted', false);

      if (category && category !== 'all') {
        myReviewQuery = myReviewQuery.eq('category', category);
      }

      if (sortBy === 'recent') {
        myReviewQuery = myReviewQuery.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        myReviewQuery = myReviewQuery.order('rating', { ascending: false });
      }

      const { data: myReviews, error: myReviewError } = await myReviewQuery.limit(10);
      
      if (myReviewError) throw myReviewError;

      // Get user profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single();

      // Format the data
      const formattedMyRecommendations = (myRecommendations || []).map(rec => ({
        ...rec,
        username: userProfile?.username || 'Unknown',
        avatar_url: userProfile?.avatar_url || null
      }));

      const formattedMyReviews = (myReviews || []).map(review => ({
        ...review,
        username: userProfile?.username || 'Unknown',
        avatar_url: userProfile?.avatar_url || null
      }));

      return {
        recommendations: formattedMyRecommendations,
        reviews: formattedMyReviews
      };
    },
    enabled: !!userId,
  });

  return {
    recommendations: followedContent?.recommendations || [],
    reviews: followedContent?.reviews || [],
    myRecommendations: myContent?.recommendations || [],
    myReviews: myContent?.reviews || [],
    isLoading: isLoadingFollowed || isLoadingMy,
    error: followedError || myError
  };
};
