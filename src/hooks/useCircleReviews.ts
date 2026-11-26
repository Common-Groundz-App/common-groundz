
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ReviewWithUser } from '@/types/entities';
import { transformToSafeProfile } from '@/types/profile';
import { REVIEWS_CHANGED_EVENT } from '@/services/review/reviewChangeEvents';

interface CircleReviewsData {
  circleReviews: ReviewWithUser[];
  circleUserIds: string[];
  isLoading: boolean;
  error: string | null;
}

export const useCircleReviews = (entityId: string): CircleReviewsData => {
  const { user } = useAuth();
  const [circleReviews, setCircleReviews] = useState<ReviewWithUser[]>([]);
  const [circleUserIds, setCircleUserIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Visibility changes (Public <-> Private) emit the shared review event.
  useEffect(() => {
    const bump = () => setRefreshTick(t => t + 1);
    window.addEventListener(REVIEWS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(REVIEWS_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const live = () => !cancelled;
    const fetchCircleReviews = async () => {
      if (!user || !entityId) {
        live() && setCircleReviews([]);
        live() && setCircleUserIds([]);
        live() && setIsLoading(false);
        return;
      }

      console.log('🔵 useCircleReviews - Fetching circle reviews for entity:', entityId);
      console.log('🔵 Current user:', user.id);
      live() && setIsLoading(true);
      live() && setError(null);

      try {
        // First, get the list of users that the current user follows
        // Using the same logic as useCircleRating
        const { data: followedUsers, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (followError) {
          console.error('🔵 Error fetching followed users:', followError);
          live() && setError('Failed to fetch following data');
          live() && setIsLoading(false);
          return;
        }

        if (!followedUsers || followedUsers.length === 0) {
          console.log('🔵 User follows no one, no circle reviews');
          live() && setCircleReviews([]);
          live() && setCircleUserIds([]);
          live() && setIsLoading(false);
          return;
        }

        const followedUserIds = followedUsers.map(f => f.following_id);
        console.log('🔵 Found followed users:', followedUserIds.length, followedUserIds);
        live() && setCircleUserIds(followedUserIds);

        // Get reviews from followed users for this entity - simplified approach
        const { data: reviews, error: reviewError } = await supabase
          .from('reviews')
          .select('*')
          .eq('entity_id', entityId)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .in('user_id', followedUserIds)
          .order('created_at', { ascending: false });

        if (reviewError) {
          console.error('🔵 Error fetching circle reviews:', reviewError);
          live() && setError('Failed to fetch circle reviews');
        } else if (reviews && reviews.length > 0) {
          // Get profile data separately to avoid foreign key issues
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, first_name, last_name')
            .in('id', reviews.map(r => r.user_id));

          if (profileError) {
            console.error('🔵 Error fetching profiles:', profileError);
            live() && setError('Failed to fetch user profiles');
          } else {
            const profileMap = new Map((profiles || []).map(p => [p.id, p]));
            
            const formattedReviews = reviews.map(review => {
              const profile = profileMap.get(review.user_id);
              return {
                ...review,
                user: transformToSafeProfile(profile ? {
                  id: review.user_id,
                  username: profile.username,
                  avatar_url: profile.avatar_url,
                  first_name: profile.first_name,
                  last_name: profile.last_name,
                  bio: null,
                  location: null,
                  created_at: null,
                  username_changed_at: null,
                  deleted_at: null
                } : null),
                // Add required InteractionData fields
                likes: 0,
                isLiked: false,
                // Handle media properly - ensure it matches MediaItem[] type
                media: Array.isArray(review.media) ? review.media as any[] : [],
                // Ensure correct types
                visibility: review.visibility as 'public' | 'private',
                status: review.status as 'published' | 'draft' | 'deleted'
              };
            }).filter(review => review.user.id);

            console.log('🔵 Circle reviews found:', formattedReviews.length);
            console.log('🔵 Circle reviews details:', formattedReviews.map(r => ({
              id: r.id,
              user: r.user.username,
              user_id: r.user_id,
              rating: r.rating,
              title: r.title
            })));

            live() && setCircleReviews(formattedReviews);
          }
        } else {
          live() && setCircleReviews([]);
        }
      } catch (error) {
        console.error('🔵 Error in useCircleReviews:', error);
        live() && setError('Unexpected error occurred');
        live() && setCircleReviews([]);
        live() && setCircleUserIds([]);
      } finally {
        live() && setIsLoading(false);
      }
    };

    fetchCircleReviews();
    return () => { cancelled = true; };
  }, [entityId, user?.id, refreshTick]);

  return {
    circleReviews,
    circleUserIds,
    isLoading,
    error
  };
};
