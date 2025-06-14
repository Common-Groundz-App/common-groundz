
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdminReview {
  id: string;
  title: string;
  user_id: string;
  entity_id: string | null;
  timeline_count: number;
  ai_summary: string | null;
  ai_summary_last_generated_at: string | null;
  created_at: string;
  description: string | null;
  rating: number;
  // Relations
  user?: {
    username: string;
    avatar_url: string | null;
  };
  entity?: {
    name: string;
    type: string;
  };
}

export interface ReviewUpdate {
  id: string;
  rating: number | null;
  comment: string;
  created_at: string;
  user?: {
    username: string;
    avatar_url: string | null;
  };
}

const ITEMS_PER_PAGE = 10;

export const useAdminReviews = () => {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const { toast } = useToast();

  const fetchReviews = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      
      // Get total count
      const { count } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('has_timeline', true)
        .eq('status', 'published');

      // Get paginated reviews with related data
      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select(`
          id,
          title,
          user_id,
          entity_id,
          timeline_count,
          ai_summary,
          ai_summary_last_generated_at,
          created_at,
          description,
          rating
        `)
        .eq('has_timeline', true)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      if (error) throw error;

      // Get user and entity data separately to avoid foreign key issues
      const userIds = [...new Set(reviewsData?.map(r => r.user_id) || [])];
      const entityIds = [...new Set(reviewsData?.filter(r => r.entity_id).map(r => r.entity_id) || [])];

      const [usersData, entitiesData] = await Promise.all([
        userIds.length > 0 ? supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds) : { data: [] },
        entityIds.length > 0 ? supabase
          .from('entities')
          .select('id, name, type')
          .in('id', entityIds) : { data: [] }
      ]);

      // Map the data together
      const enrichedReviews = reviewsData?.map(review => ({
        ...review,
        user: usersData.data?.find(u => u.id === review.user_id),
        entity: entitiesData.data?.find(e => e.id === review.entity_id)
      })) || [];

      setReviews(enrichedReviews);
      setTotalCount(count || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching admin reviews:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reviews",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAISummary = async (reviewId: string) => {
    setGeneratingIds(prev => new Set(prev).add(reviewId));
    
    try {
      const { error } = await supabase.functions.invoke('generate-ai-summary', {
        body: { reviewId }
      });

      if (error) throw error;

      toast({
        title: "Summary Generated",
        description: "AI summary has been generated successfully",
      });

      // Refresh the current page
      await fetchReviews(currentPage);
    } catch (error) {
      console.error('Error generating AI summary:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI summary",
        variant: "destructive"
      });
    } finally {
      setGeneratingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(reviewId);
        return newSet;
      });
    }
  };

  const generateBulkSummaries = async () => {
    setIsBulkGenerating(true);
    
    try {
      console.log('🚀 Starting bulk AI summary generation for reviews...');
      
      // Get all reviews that need summaries (timeline_count >= 2 and no ai_summary)
      const { data: eligibleReviews, error } = await supabase
        .from('reviews')
        .select('id, title')
        .eq('has_timeline', true)
        .eq('status', 'published')
        .gte('timeline_count', 2)
        .is('ai_summary', null);

      if (error) throw error;

      if (!eligibleReviews?.length) {
        toast({
          title: "No Reviews to Process",
          description: "All eligible reviews already have AI summaries",
        });
        return;
      }

      console.log(`📋 Found ${eligibleReviews.length} reviews eligible for bulk generation`);

      let successCount = 0;
      let failureCount = 0;
      const failedIds: string[] = [];

      // Process reviews with delay to avoid rate limits
      for (const review of eligibleReviews) {
        try {
          const { error: summaryError } = await supabase.functions.invoke('generate-ai-summary', {
            body: { reviewId: review.id }
          });

          if (summaryError) {
            throw summaryError;
          }

          successCount++;
          console.log(`✅ Generated summary for review: ${review.title}`);
        } catch (error) {
          console.error(`❌ Failed to generate summary for review ${review.id}:`, error);
          failureCount++;
          failedIds.push(review.id);
        }

        // Add delay between requests to avoid rate limits
        if (eligibleReviews.indexOf(review) < eligibleReviews.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Show completion toast
      if (failureCount === 0) {
        toast({
          title: "Bulk Generation Complete",
          description: `${successCount} review summaries generated successfully`,
        });
      } else {
        toast({
          title: "Bulk Generation Complete",
          description: `${successCount} summaries generated, ${failureCount} failed`,
          variant: "destructive"
        });
        
        // Log failed IDs for debugging
        if (failedIds.length > 0) {
          console.log('❌ Failed review IDs:', failedIds);
        }
      }

      // Refresh data
      await fetchReviews(currentPage);

    } catch (error) {
      console.error('❌ Error in bulk summary generation:', error);
      toast({
        title: "Error",
        description: "Failed to start bulk generation",
        variant: "destructive"
      });
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const fetchReviewUpdates = async (reviewId: string): Promise<ReviewUpdate[]> => {
    try {
      const { data: updates, error } = await supabase
        .from('review_updates')
        .select('*')
        .eq('review_id', reviewId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get user data for updates
      const userIds = [...new Set(updates?.map(u => u.user_id) || [])];
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      return updates?.map(update => ({
        ...update,
        user: usersData?.find(u => u.id === update.user_id)
      })) || [];
    } catch (error) {
      console.error('Error fetching review updates:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchReviews(1);
  }, []);

  return {
    reviews,
    totalCount,
    currentPage,
    isLoading,
    generatingIds,
    isBulkGenerating,
    fetchReviews,
    generateAISummary,
    generateBulkSummaries,
    fetchReviewUpdates,
    totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE)
  };
};
