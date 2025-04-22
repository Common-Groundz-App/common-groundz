
import React, { useEffect, useRef } from 'react';
import { useProfileData } from '@/hooks/use-profile-data';
import { RecommendationCard } from '@/components/recommendations/RecommendationCard';
import { RecommendationSkeleton } from '@/components/recommendations/RecommendationSkeleton';
import { EmptyRecommendations } from '@/components/recommendations/EmptyRecommendations';
import { toast } from '@/hooks/use-toast';

interface ProfileRecommendationsProps {
  profileUserId?: string;
  isOwnProfile: boolean;
  highlightRecId?: string | null;
  highlightCommentId?: string | null;
}

const ProfileRecommendations = ({ 
  profileUserId, 
  isOwnProfile,
  highlightRecId,
  highlightCommentId
}: ProfileRecommendationsProps) => {
  const { recommendations, isLoading } = useProfileData(profileUserId).recommendations;
  const highlightedRecRef = useRef<HTMLDivElement>(null);

  // Effect to scroll to highlighted recommendation
  useEffect(() => {
    if (highlightRecId && recommendations && recommendations.length > 0 && !isLoading) {
      // Check if the recommendation exists
      const recExists = recommendations.some(rec => rec.id === highlightRecId);
      
      if (recExists) {
        // Short delay to ensure DOM is updated
        setTimeout(() => {
          if (highlightedRecRef.current) {
            highlightedRecRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Add a highlight effect
            highlightedRecRef.current.classList.add('ring-2', 'ring-primary', 'ring-opacity-50');
            setTimeout(() => {
              highlightedRecRef.current?.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50');
            }, 2000);
            
            // If there's a comment to highlight
            if (highlightCommentId) {
              toast({
                title: "Comment found",
                description: "Scrolling to the specific comment",
                duration: 2000
              });
            }
          }
        }, 100);
      } else {
        toast({
          title: "Recommendation not found",
          description: "The recommendation you're looking for might have been deleted or is not visible.",
          variant: "destructive",
          duration: 3000
        });
      }
    }
  }, [highlightRecId, recommendations, isLoading, highlightCommentId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <RecommendationSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return <EmptyRecommendations isOwnProfile={isOwnProfile} />;
  }

  return (
    <div className="space-y-6">
      {recommendations.map((recommendation) => (
        <div
          key={recommendation.id}
          ref={recommendation.id === highlightRecId ? highlightedRecRef : null}
          className={`transition-all duration-300 rounded-lg ${recommendation.id === highlightRecId ? 'bg-accent/30' : ''}`}
        >
          <RecommendationCard
            recommendation={recommendation}
            isOwnRecommendation={isOwnProfile}
            highlightCommentId={recommendation.id === highlightRecId ? highlightCommentId : null}
            showExpanded={recommendation.id === highlightRecId}
          />
        </div>
      ))}
    </div>
  );
};

export default ProfileRecommendations;
