
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TrustMetrics {
  circleCertified: number | null;
  ratingBreakdown: {
    [key: number]: number;
  };
  ratingEvolution: number[];
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
        const { data: circleData, error: circleError } = await supabase
          .from('reviews')
          .select('rating')
          .eq('entity_id', entityId)
          .eq('status', 'published')
          .in('user_id', [
            // Get users that current user follows
            supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', userId)
          ]);

        if (!circleError && circleData) {
          const totalCircleReviews = circleData.length;
          const highRatedCircleReviews = circleData.filter(review => 
            (review.rating || 0) >= 4
          ).length;
          
          circleCertified = totalCircleReviews > 0 
            ? Math.round((highRatedCircleReviews / totalCircleReviews) * 100)
            : null;
        }
      }

      // Fetch Rating Breakdown
      const { data: ratingData, error: ratingError } = await supabase
        .from('reviews')
        .select('rating')
        .eq('entity_id', entityId)
        .eq('status', 'published');

      let ratingBreakdown: { [key: number]: number } = {};
      if (!ratingError && ratingData && ratingData.length > 0) {
        const totalReviews = ratingData.length;
        const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        ratingData.forEach(review => {
          const rating = review.rating || 0;
          if (rating >= 1 && rating <= 5) {
            breakdown[Math.floor(rating)] += 1;
          }
        });

        // Convert to percentages
        Object.keys(breakdown).forEach(rating => {
          const ratingNum = parseInt(rating);
          ratingBreakdown[ratingNum] = Math.round((breakdown[ratingNum] / totalReviews) * 100);
        });
      }

      // Fetch Rating Evolution (quarterly)
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

      console.log('📊 Trust metrics calculated:', {
        circleCertified,
        ratingBreakdown,
        ratingEvolution
      });

      return {
        circleCertified,
        ratingBreakdown,
        ratingEvolution
      };
    },
    enabled: !!entityId,
    staleTime: 1000 * 60 * 7, // 7 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
};
