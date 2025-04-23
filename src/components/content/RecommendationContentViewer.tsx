
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RecommendationCard from '@/components/recommendations/RecommendationCard';
import ContentLoading from './ContentLoading';
import ContentError from './ContentError';
import ContentComments from './ContentComments';
import { useRecommendationContent } from '@/hooks/content/useRecommendationContent';
import { useRecommendationInteractions } from '@/hooks/content/useContentInteractions';

interface RecommendationContentViewerProps {
  recommendationId: string;
  highlightCommentId: string | null;
}

const RecommendationContentViewer = ({ 
  recommendationId, 
  highlightCommentId 
}: RecommendationContentViewerProps) => {
  const { user } = useAuth();
  const { recommendation: initialRecommendation, loading, error, topComment } = 
    useRecommendationContent(recommendationId, user?.id);
  const { recommendation, handleRecommendationLike, handleRecommendationSave } = 
    useRecommendationInteractions(initialRecommendation, user?.id);

  const handleRefresh = () => {
    // Refresh can be handled by parent components with state refresh
    window.location.reload();
  };

  if (loading) {
    return <ContentLoading />;
  }

  if (error || !recommendation) {
    return <ContentError message={error} />;
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

      <ContentComments
        itemId={recommendationId}
        itemType="recommendation"
        topComment={topComment}
        commentCount={recommendation.comment_count}
        highlightCommentId={highlightCommentId}
      />
    </div>
  );
};

export default RecommendationContentViewer;
