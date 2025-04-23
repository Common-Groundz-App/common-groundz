
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import CommentsPreview from '@/components/comments/CommentsPreview';
import CommentDialog from '@/components/comments/CommentDialog';
import { Shell } from 'lucide-react';

interface RecommendationContentViewerProps {
  recommendationId: string;
  highlightCommentId: string | null;
}

const RecommendationContentViewer = ({ 
  recommendationId, 
  highlightCommentId 
}: RecommendationContentViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
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
        
        if (user) {
          const { data: likeData } = await supabase
            .from('recommendation_likes')
            .select('*')
            .eq('recommendation_id', recommendationId)
            .eq('user_id', user.id)
            .maybeSingle();
            
          isLiked = !!likeData;
          
          const { data: saveData } = await supabase
            .from('recommendation_saves')
            .select('*')
            .eq('recommendation_id', recommendationId)
            .eq('user_id', user.id)
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
  }, [recommendationId, user?.id]);

  const fetchTopComment = async () => {
    try {
      // Join recommendation_comments with profiles to get the username
      const { data, error } = await supabase
        .from('recommendation_comments')
        .select(`
          content, 
          created_at, 
          profiles:user_id (username)
        `)
        .eq('recommendation_id', recommendationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setTopComment({
          username: data.profiles?.username || 'User',
          content: data.content,
        });
      } else {
        setTopComment(null);
      }
    } catch (err) {
      console.error('Error fetching top comment:', err);
      setTopComment(null);
    }
  };

  useEffect(() => {
    if (recommendationId) {
      fetchTopComment();
    }
  }, [recommendationId]);

  const handleRecommendationLike = async () => {
    if (!user || !recommendation) return;
    
    try {
      if (recommendation.isLiked) {
        // Unlike
        await supabase
          .from('recommendation_likes')
          .delete()
          .eq('recommendation_id', recommendation.id)
          .eq('user_id', user.id);
        
        setRecommendation({
          ...recommendation,
          isLiked: false,
          likes: recommendation.likes - 1
        });
      } else {
        // Like
        await supabase
          .from('recommendation_likes')
          .insert({ recommendation_id: recommendation.id, user_id: user.id });
        
        setRecommendation({
          ...recommendation,
          isLiked: true,
          likes: recommendation.likes + 1
        });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };
  
  const handleRecommendationSave = async () => {
    if (!user || !recommendation) return;
    
    try {
      if (recommendation.isSaved) {
        // Unsave
        await supabase
          .from('recommendation_saves')
          .delete()
          .eq('recommendation_id', recommendation.id)
          .eq('user_id', user.id);
        
        setRecommendation({
          ...recommendation,
          isSaved: false
        });
      } else {
        // Save
        await supabase
          .from('recommendation_saves')
          .insert({ recommendation_id: recommendation.id, user_id: user.id });
        
        setRecommendation({
          ...recommendation,
          isSaved: true
        });
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };
  
  const handleRefresh = () => {
    if (recommendationId) {
      setLoading(true);
      setError(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <Shell className="h-8 w-8 animate-pulse text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading content...</p>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <h3 className="font-medium mb-2">Content Not Available</h3>
          <p className="text-muted-foreground text-sm">{error || 'This recommendation is no longer available'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 overflow-y-auto max-h-full">
      <RecommendationCard 
        recommendation={recommendation}
        onLike={() => handleRecommendationLike()}
        onSave={() => handleRecommendationSave()}
        onDeleted={handleRefresh}
        highlightCommentId={highlightCommentId}
      />

      <CommentsPreview
        topComment={topComment}
        commentCount={recommendation.comment_count}
        onClick={() => setShowComments(true)}
      />

      {showComments && (
        <CommentDialog
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          itemId={recommendationId}
          itemType="recommendation"
        />
      )}
    </div>
  );
};

export default RecommendationContentViewer;
