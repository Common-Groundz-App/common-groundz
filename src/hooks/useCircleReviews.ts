
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ReviewWithUser } from '@/types/entities';

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

  useEffect(() => {
    const fetchCircleReviews = async () => {
      if (!user || !entityId) {
        setIsLoading(false);
        return;
      }

      console.log('🔵 useCircleReviews - Fetching circle reviews for entity:', entityId);
      console.log('🔵 Current user:', user.id);
      setIsLoading(true);
      setError(null);

      try {
        // First, get the list of users that the current user follows
        // Using the same logic as useCircleRating
        const { data: followedUsers, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (followError) {
          console.error('🔵 Error fetching followed users:', followError);
          setError('Failed to fetch following data');
          setIsLoading(false);
          return;
        }

        if (!followedUsers || followedUsers.length === 0) {
          console.log('🔵 User follows no one, no circle reviews');
          setCircleReviews([]);
          setCircleUserIds([]);
          setIsLoading(false);
          return;
        }

        const followedUserIds = followedUsers.map(f => f.following_id);
        console.log('🔵 Found followed users:', followedUserIds.length, followedUserIds);
        setCircleUserIds(followedUserIds);

        // Get reviews from followed users for this entity
        const { data: reviews, error: reviewError } = await supabase
          .from('reviews')
          .select(`
            *,
            user:profiles!reviews_user_id_fkey (
              id,
              username,
              avatar_url,
              first_name,
              last_name
            )
          `)
          .eq('entity_id', entityId)
          .eq('status', 'published')
          .in('user_id', followedUserIds)
          .order('created_at', { ascending: false });

        if (reviewError) {
          console.error('🔵 Error fetching circle reviews:', reviewError);
          setError('Failed to fetch circle reviews');
        } else {
          const formattedReviews = (reviews || []).map(review => ({
            ...review,
            user: {
              id: review.user.id,
              username: review.user.username || `${review.user.first_name || ''} ${review.user.last_name || ''}`.trim() || 'Anonymous',
              avatar_url: review.user.avatar_url
            }
          }));

          console.log('🔵 Circle reviews found:', formattedReviews.length);
          console.log('🔵 Circle reviews details:', formattedReviews.map(r => ({
            id: r.id,
            user: r.user.username,
            user_id: r.user_id,
            rating: r.rating,
            title: r.title
          })));

          setCircleReviews(formattedReviews);
        }
      } catch (error) {
        console.error('🔵 Error in useCircleReviews:', error);
        setError('Unexpected error occurred');
        setCircleReviews([]);
        setCircleUserIds([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCircleReviews();
  }, [entityId, user?.id]);

  return {
    circleReviews,
    circleUserIds,
    isLoading,
    error
  };
};
