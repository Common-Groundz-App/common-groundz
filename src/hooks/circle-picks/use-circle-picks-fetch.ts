
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
      
      // Fetch recommendations with explicit type assertion
      const recQueryBuilder = supabase
        .from('recommendations')
        .select('*')
        .in('user_id', followedIds)
        .eq('is_deleted', false);

      // Apply category filter only if it's a valid database category
      if (dbCategory) {
        recQueryBuilder.eq('category', dbCategory);
      }

      // Apply sorting
      if (sortBy === 'recent') {
        recQueryBuilder.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        recQueryBuilder.order('rating', { ascending: false });
      }

      const { data: recommendations, error: recError } = await recQueryBuilder.limit(20);
      
      if (recError) throw recError;

      // Fetch reviews with explicit type assertion
      const reviewQueryBuilder = supabase
        .from('reviews')
        .select('*')
        .in('user_id', followedIds)
        .eq('is_deleted', false);

      // For reviews, we can filter by any category since reviews table might support more categories
      if (category && category !== 'all') {
        reviewQueryBuilder.eq('category', category);
      }

      // Apply sorting
      if (sortBy === 'recent') {
        reviewQueryBuilder.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        reviewQueryBuilder.order('rating', { ascending: false });
      }

      const { data: reviews, error: reviewError } = await reviewQueryBuilder.limit(20);
      
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
      
      // Fetch user's recommendations with explicit type assertion
      const myRecQueryBuilder = supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false);

      // Apply category filter only if it's a valid database category
      if (dbCategory) {
        myRecQueryBuilder.eq('category', dbCategory);
      }

      if (sortBy === 'recent') {
        myRecQueryBuilder.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        myRecQueryBuilder.order('rating', { ascending: false });
      }

      const { data: myRecommendations, error: myRecError } = await myRecQueryBuilder.limit(10);
      
      if (myRecError) throw myRecError;

      // Fetch user's reviews with explicit type assertion
      const myReviewQueryBuilder = supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false);

      if (category && category !== 'all') {
        myReviewQueryBuilder.eq('category', category);
      }

      if (sortBy === 'recent') {
        myReviewQueryBuilder.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        myReviewQueryBuilder.order('rating', { ascending: false });
      }

      const { data: myReviews, error: myReviewError } = await myReviewQueryBuilder.limit(10);
      
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
