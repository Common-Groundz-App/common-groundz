
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useCircleRating = (entityId: string) => {
  const { user } = useAuth();
  const [circleRating, setCircleRating] = useState<number | null>(null);
  const [circleRatingCount, setCircleRatingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCircleRating = async () => {
      if (!user || !entityId) {
        setIsLoading(false);
        return;
      }

      console.log('🔵 Fetching circle rating for entity:', entityId);
      setIsLoading(true);

      try {
        // First, get the list of users that the current user follows
        const { data: followedUsers, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (followError) {
          console.error('Error fetching followed users:', followError);
          setIsLoading(false);
          return;
        }

        if (!followedUsers || followedUsers.length === 0) {
          console.log('🔵 User follows no one, circle rating is 0');
          setCircleRating(null);
          setCircleRatingCount(0);
          setIsLoading(false);
          return;
        }

        const followedUserIds = followedUsers.map(f => f.following_id);
        console.log('🔵 Found followed users:', followedUserIds.length);

        // Get recommendations from followed users for this entity
        const { data: recommendations, error: recError } = await supabase
          .from('recommendations')
          .select('rating, user_id')
          .eq('entity_id', entityId)
          .in('user_id', followedUserIds);

        if (recError) {
          console.error('Error fetching circle recommendations:', recError);
        }

        // Get reviews from followed users for this entity
        const { data: reviews, error: reviewError } = await supabase
          .from('reviews')
          .select('rating, user_id')
          .eq('entity_id', entityId)
          .in('user_id', followedUserIds);

        if (reviewError) {
          console.error('Error fetching circle reviews:', reviewError);
        }

        // Combine all ratings from followed users
        const allRatings: number[] = [];
        
        if (recommendations) {
          recommendations.forEach(rec => {
            if (rec.rating && typeof rec.rating === 'number') {
              allRatings.push(Number(rec.rating));
            }
          });
        }

        if (reviews) {
          reviews.forEach(review => {
            if (review.rating && typeof review.rating === 'number') {
              allRatings.push(review.rating);
            }
          });
        }

        console.log('🔵 Circle ratings found:', allRatings);

        if (allRatings.length === 0) {
          setCircleRating(null);
          setCircleRatingCount(0);
        } else {
          const averageRating = allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length;
          setCircleRating(averageRating);
          setCircleRatingCount(allRatings.length);
          console.log('🔵 Circle rating calculated:', averageRating, 'from', allRatings.length, 'ratings');
        }
      } catch (error) {
        console.error('Error calculating circle rating:', error);
        setCircleRating(null);
        setCircleRatingCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCircleRating();
  }, [entityId, user?.id]);

  return {
    circleRating,
    circleRatingCount,
    isLoading
  };
};
