
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CircleContributor, CircleRatingData } from './use-circle-rating-types';

export const useCircleRating = (entityId: string): CircleRatingData => {
  const { user } = useAuth();
  const [circleRating, setCircleRating] = useState<number | null>(null);
  const [circleRatingCount, setCircleRatingCount] = useState<number>(0);
  const [circleContributors, setCircleContributors] = useState<CircleContributor[]>([]);
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
          setCircleContributors([]);
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

        // Combine all ratings and contributors from followed users
        const allRatings: number[] = [];
        const contributors: CircleContributor[] = [];
        
        if (recommendations) {
          recommendations.forEach(rec => {
            if (rec.rating && typeof rec.rating === 'number') {
              const rating = Number(rec.rating);
              allRatings.push(rating);
              contributors.push({
                userId: rec.user_id,
                rating: rating,
                type: 'recommendation'
              });
            }
          });
        }

        if (reviews) {
          reviews.forEach(review => {
            if (review.rating && typeof review.rating === 'number') {
              allRatings.push(review.rating);
              contributors.push({
                userId: review.user_id,
                rating: review.rating,
                type: 'review'
              });
            }
          });
        }

        console.log('🔵 Circle ratings found:', allRatings);
        console.log('🔵 Circle contributors found:', contributors.length);

        // Sort contributors by rating (highest first) and limit to top contributors
        const sortedContributors = contributors
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 5); // Limit to top 5 contributors for performance

        if (allRatings.length === 0) {
          setCircleRating(null);
          setCircleRatingCount(0);
          setCircleContributors([]);
        } else {
          const averageRating = allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length;
          setCircleRating(averageRating);
          setCircleRatingCount(allRatings.length);
          setCircleContributors(sortedContributors);
          console.log('🔵 Circle rating calculated:', averageRating, 'from', allRatings.length, 'ratings');
          console.log('🔵 Top contributors:', sortedContributors);
        }
      } catch (error) {
        console.error('Error calculating circle rating:', error);
        setCircleRating(null);
        setCircleRatingCount(0);
        setCircleContributors([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCircleRating();
  }, [entityId, user?.id]);

  return {
    circleRating,
    circleRatingCount,
    circleContributors,
    isLoading
  };
};
