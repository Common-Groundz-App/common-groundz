
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrustMetrics {
  circleCertified: number | null;
  ratingBreakdown: {
    [key: number]: number;
  };
  ratingEvolution: number[];
  lastUpdated: string | null;
}

export const useTrustMetrics = (entityId: string | null, userId: string | null) => {
  return useQuery({
    queryKey: ['trust-metrics', entityId, userId],
    queryFn: async (): Promise<TrustMetrics> => {
      if (!entityId) {
        throw new Error('Entity ID is required');
      }

      console.log('🔍 Fetching trust metrics for entity:', entityId, 'user:', userId);

      // Fetch Circle Certified percentage
      let circleCertified: number | null = null;
      if (userId) {
        // First get users that current user follows
        const { data: followedUsers, error: followError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);

        if (!followError && followedUsers && followedUsers.length > 0) {
          const followedUserIds = followedUsers.map(f => f.following_id);
          
          const { data: circleData, error: circleError } = await supabase
            .from('reviews')
            .select('rating, latest_rating')
            .eq('entity_id', entityId)
            .eq('status', 'published')
            .in('user_id', followedUserIds);

          if (!circleError && circleData) {
            console.log('🔍 Circle data found:', circleData);
            const totalCircleReviews = circleData.length;
            const highRatedCircleReviews = circleData.filter(review => {
              const effectiveRating = review.latest_rating ?? review.rating;
              console.log('🔍 Review rating:', review.rating, 'latest:', review.latest_rating, 'effective:', effectiveRating);
              return (effectiveRating || 0) >= 4;
            }).length;
            
            circleCertified = totalCircleReviews > 0 
              ? Math.round((highRatedCircleReviews / totalCircleReviews) * 100)
              : null;
            
            console.log('🔍 Circle Certified calculation:', {
              totalCircleReviews,
              highRatedCircleReviews,
              circleCertified
            });
          }
        }
      }

      // Fetch Rating Breakdown using latest ratings
      const { data: ratingData, error: ratingError } = await supabase
        .from('reviews')
        .select('rating, latest_rating')
        .eq('entity_id', entityId)
        .eq('status', 'published');

      let ratingBreakdown: { [key: number]: number } = {};
      if (!ratingError && ratingData && ratingData.length > 0) {
        const totalReviews = ratingData.length;
        const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        ratingData.forEach(review => {
          const effectiveRating = review.latest_rating ?? review.rating;
          console.log('🔍 Breakdown - rating:', review.rating, 'latest:', review.latest_rating, 'effective:', effectiveRating);
          if (effectiveRating && effectiveRating >= 1 && effectiveRating <= 5) {
            breakdown[Math.floor(effectiveRating)] += 1;
          }
        });

        // Convert to percentages
        Object.keys(breakdown).forEach(rating => {
          const ratingNum = parseInt(rating);
          ratingBreakdown[ratingNum] = Math.round((breakdown[ratingNum] / totalReviews) * 100);
        });
      }

      // Fetch Rating Evolution (quarterly) - using original ratings for historical progression
      const { data: evolutionData, error: evolutionError } = await supabase
        .from('reviews')
        .select('rating, created_at')
        .eq('entity_id', entityId)
        .eq('status', 'published')
        .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      let ratingEvolution: number[] = [];
      if (!evolutionError && evolutionData && evolutionData.length > 0) {
        // Group by quarters
        const quarterlyData: { [key: string]: number[] } = {};
        
        evolutionData.forEach(review => {
          const date = new Date(review.created_at);
          const year = date.getFullYear();
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          const quarterKey = `${year}-Q${quarter}`;
          
          if (!quarterlyData[quarterKey]) {
            quarterlyData[quarterKey] = [];
          }
          quarterlyData[quarterKey].push(review.rating || 0);
        });

        // Calculate averages for last 4 quarters
        const sortedQuarters = Object.keys(quarterlyData).sort().reverse();
        ratingEvolution = sortedQuarters.slice(0, 4).map(quarter => {
          const ratings = quarterlyData[quarter];
          const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
          return Math.round(average * 10) / 10; // Round to 1 decimal
        }).reverse(); // Show chronologically (oldest to newest)
      }

      // Fetch Last Updated timestamp - get the most recent activity
      let lastUpdated: string | null = null;
      
      const { data: lastActivityData, error: lastActivityError } = await supabase
        .from('reviews')
        .select('updated_at')
        .eq('entity_id', entityId)
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(1);

      const { data: lastTimelineData, error: lastTimelineError } = await supabase
        .from('review_updates')
        .select('created_at, review_id')
        .eq('review_id', supabase.from('reviews').select('id').eq('entity_id', entityId))
        .order('created_at', { ascending: false })
        .limit(1);

      // Get the most recent between review updates and timeline updates
      const reviewLastUpdated = lastActivityData?.[0]?.updated_at;
      const timelineLastUpdated = lastTimelineData?.[0]?.created_at;

      if (reviewLastUpdated && timelineLastUpdated) {
        lastUpdated = new Date(reviewLastUpdated) > new Date(timelineLastUpdated) 
          ? reviewLastUpdated 
          : timelineLastUpdated;
      } else if (reviewLastUpdated) {
        lastUpdated = reviewLastUpdated;
      } else if (timelineLastUpdated) {
        lastUpdated = timelineLastUpdated;
      }

      console.log('📊 Trust metrics calculated:', {
        circleCertified,
        ratingBreakdown,
        ratingEvolution,
        lastUpdated
      });

      return {
        circleCertified,
        ratingBreakdown,
        ratingEvolution,
        lastUpdated
      };
    },
    enabled: !!entityId,
    staleTime: 1000 * 60 * 7, // 7 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
};
