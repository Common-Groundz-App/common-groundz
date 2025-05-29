
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseCirclePicksFetchProps {
  userId?: string;
  category?: string;
  sortBy: 'recent' | 'most_liked' | 'highest_rated';
}

// Define valid categories to match the database enum
const VALID_CATEGORIES = ['Food', 'Drink', 'Movie', 'Book', 'Product', 'Place', 'Activity', 'Music', 'Art', 'TV', 'Travel'] as const;
type ValidCategory = typeof VALID_CATEGORIES[number];

function isValidCategory(category: string): category is ValidCategory {
  return VALID_CATEGORIES.includes(category as ValidCategory);
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

      // Build recommendations query
      let recQuery = supabase
        .from('recommendations')
        .select('*')
        .in('user_id', followedIds)
        .eq('is_deleted', false);

      // Apply category filter only if it's valid
      if (category && category !== 'all' && isValidCategory(category)) {
        recQuery = recQuery.eq('category', category);
      }

      // Apply sorting
      if (sortBy === 'recent') {
        recQuery = recQuery.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        recQuery = recQuery.order('rating', { ascending: false });
      }

      const { data: recommendations, error: recError } = await recQuery.limit(20);
      
      if (recError) throw recError;

      // Build reviews query
      let reviewQuery = supabase
        .from('reviews')
        .select('*')
        .in('user_id', followedIds)
        .eq('is_deleted', false);

      // Apply category filter for reviews
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

      // Build user's recommendations query
      let myRecQuery = supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false);

      // Apply category filter only if it's valid
      if (category && category !== 'all' && isValidCategory(category)) {
        myRecQuery = myRecQuery.eq('category', category);
      }

      if (sortBy === 'recent') {
        myRecQuery = myRecQuery.order('created_at', { ascending: false });
      } else if (sortBy === 'highest_rated') {
        myRecQuery = myRecQuery.order('rating', { ascending: false });
      }

      const { data: myRecommendations, error: myRecError } = await myRecQuery.limit(10);
      
      if (myRecError) throw myRecError;

      // Build user's reviews query
      let myReviewQuery = supabase
        .from('reviews')
        .select('*')
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
