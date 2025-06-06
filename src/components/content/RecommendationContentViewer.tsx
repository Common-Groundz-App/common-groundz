import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import CommentsPreview from '@/components/comments/CommentsPreview';
import CommentDialog from '@/components/comments/CommentDialog';
import { Shell } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useProfile } from '@/hooks/use-profile-cache';

interface RecommendationContentViewerProps {
  recommendationId: string;
  highlightCommentId: string | null;
  isInModal?: boolean;
}

const RecommendationContentViewer = ({ 
  recommendationId, 
  highlightCommentId,
  isInModal = false
}: RecommendationContentViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendation, setRecommendation] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showComments, setShowComments] = React.useState(false);
  const [searchParams] = useSearchParams();

  // Use the profile cache for the recommendation author
  const { data: authorProfile } = useProfile(recommendation?.user_id);

  // Determine if we should auto-open comments based on URL params or highlightCommentId
  React.useEffect(() => {
    if (highlightCommentId || searchParams.has('commentId')) {
      setShowComments(true);
    }
  }, [highlightCommentId, searchParams]);

  React.useEffect(() => {
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
        
        const { count: likeCount } = await supabase
          .from('recommendation_likes')
          .select('*', { count: 'exact', head: true })
          .eq('recommendation_id', recommendationId);
          
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
        
        const { count: commentCount } = await supabase
          .from('recommendation_comments')
          .select('*', { count: 'exact', head: true })
          .eq('recommendation_id', recommendationId)
          .eq('is_deleted', false);
        
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
        
        const processedRecommendation = {
          ...data,
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

  // Update recommendation with profile data when available
  React.useEffect(() => {
    if (recommendation && authorProfile) {
      setRecommendation(prevRec => ({
        ...prevRec,
        username: authorProfile.displayName || authorProfile.username,
        avatar_url: authorProfile.avatar_url
      }));
    }
  }, [recommendation, authorProfile]);

  const handleRecommendationLike = async () => {
    if (!user || !recommendation) return;
    
    try {
      if (recommendation.isLiked) {
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

  const handleCommentsClick = () => {
    setShowComments(true);
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
        commentCount={recommendation.comment_count}
        onClick={handleCommentsClick}
      />

      {showComments && (
        <CommentDialog
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          itemId={recommendationId}
          itemType="recommendation"
          highlightCommentId={highlightCommentId}
        />
      )}
    </div>
  );
};

export default RecommendationContentViewer;
