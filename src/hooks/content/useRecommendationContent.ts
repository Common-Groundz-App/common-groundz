
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchComments } from '@/services/commentsService';

export const useRecommendationContent = (recommendationId: string, userId: string | undefined) => {
  const { toast } = useToast();
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topComment, setTopComment] = useState<any>(null);

  useEffect(() => {
    const fetchRecommendation = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('recommendations')
          .select('*')
          .eq('id', recommendationId)
          .single();
          
        if (error) throw error;
        if (!data) {
          setError('Recommendation not found or has been deleted');
          return;
        }
        
        // Fetch user profile for this recommendation
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', data.user_id)
          .single();
          
        if (profileError) throw profileError;
        
        // Get like count
        const { count: likeCount } = await supabase
          .from('recommendation_likes')
          .select('*', { count: 'exact', head: true })
          .eq('recommendation_id', recommendationId);
          
        // Check if user liked this recommendation
        let isLiked = false;
        let isSaved = false;
        
        if (userId) {
          const { data: likeData } = await supabase
            .from('recommendation_likes')
            .select('*')
            .eq('recommendation_id', recommendationId)
            .eq('user_id', userId)
            .maybeSingle();
            
          isLiked = !!likeData;
          
          const { data: saveData } = await supabase
            .from('recommendation_saves')
            .select('*')
            .eq('recommendation_id', recommendationId)
            .eq('user_id', userId)
            .maybeSingle();
            
          isSaved = !!saveData;
        }
        
        // Get comment count
        const { count: commentCount } = await supabase
          .from('recommendation_comments')
          .select('*', { count: 'exact', head: true })
          .eq('recommendation_id', recommendationId)
          .eq('is_deleted', false);
        
        // Process entity if available
        let entity = null;
        if (data.entity_id) {
          try {
            const { data: entityData } = await supabase
              .from('entities')
              .select('*')
              .eq('id', data.entity_id)
              .single();
              
            entity = entityData;
          } catch (err) {
            console.error('Error loading entity:', err);
          }
        }
        
        // Combine all data
        const processedRecommendation = {
          ...data,
          username: profileData?.username || 'User',
          avatar_url: profileData?.avatar_url || null,
          likes: likeCount || 0,
          comment_count: commentCount || 0,
          isLiked: isLiked,
          isSaved: isSaved,
          entity: entity
        };
        
        setRecommendation(processedRecommendation);
      } catch (err) {
        console.error('Error fetching recommendation:', err);
        setError('Error loading recommendation');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load recommendation content'
        });
      } finally {
        setLoading(false);
      }
    };
    
    if (recommendationId) {
      fetchRecommendation();
    }
  }, [recommendationId, userId, toast]);

  useEffect(() => {
    const fetchTopComment = async () => {
      try {
        const comments = await fetchComments(recommendationId, 'recommendation');
        if (comments && comments.length > 0) {
          const firstComment = comments[0];
          setTopComment({
            username: firstComment.username || 'User',
            content: firstComment.content,
          });
        } else {
          setTopComment(null);
        }
      } catch (err) {
        console.error('Error fetching top comment:', err);
        setTopComment(null);
      }
    };

    if (recommendationId) {
      fetchTopComment();
    }
  }, [recommendationId]);

  return { recommendation, loading, error, topComment };
};
