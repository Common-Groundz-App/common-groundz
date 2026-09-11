
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
        // Use the database function to get the circle rating
        const { data: circleRatingData, error: ratingError } = await supabase
          .rpc('get_circle_rating', {
            p_entity_id: entityId,
            p_user_id: user.id
          });

        if (ratingError) {
          console.error('Error fetching circle rating:', ratingError);
          setCircleRating(null);
          setCircleRatingCount(0);
          setCircleContributors([]);
          setIsLoading(false);
          return;
        }

        const circleRatingValue = circleRatingData || 0;
        
        // Get contributors for display (with latest ratings)
        const { data: followedUsers, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (followError) {
          console.error('Error fetching followed users:', followError);
          setCircleRating(circleRatingValue);
          setCircleRatingCount(circleRatingValue > 0 ? 1 : 0);
          setCircleContributors([]);
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

        // Contributors display: mirror the RPC's canonical rule — public reviews
        // only, one row per person (newest first), ratings kept regardless of
        // whether that person recommends.
        const { data: reviews, error: reviewError } = await supabase
          .from('reviews')
          .select('rating, latest_rating, user_id, created_at, id')
          .eq('entity_id', entityId)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .in('user_id', followedUserIds)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false });

        if (reviewError) {
          console.error('Error fetching circle reviews:', reviewError);
        }

        // Build contributors with latest ratings
        const contributors: CircleContributor[] = [];
        let ratingCount = 0;

        if (reviews) {
          const seenUserIds = new Set<string>();
          reviews.forEach(review => {
            if (seenUserIds.has(review.user_id)) return;
            seenUserIds.add(review.user_id);

            const effectiveRating = review.latest_rating || review.rating;
            if (effectiveRating && typeof effectiveRating === 'number') {
              ratingCount++;
              contributors.push({
                userId: review.user_id,
                rating: effectiveRating,
                type: 'review'
              });
            }
          });
        }


        // Sort contributors by rating (highest first) and limit to top contributors
        const sortedContributors = contributors
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 5);

        setCircleRating(circleRatingValue > 0 ? circleRatingValue : null);
        setCircleRatingCount(ratingCount);
        setCircleContributors(sortedContributors);
        
        console.log('🔵 Circle rating from DB function:', circleRatingValue);
        console.log('🔵 Circle contributors found:', contributors.length);
        console.log('🔵 Top contributors:', sortedContributors);
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
