
import { useCallback } from 'react';
import { MessageSquare } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useEntityShare } from '@/hooks/use-entity-share';
import { Entity } from '@/services/recommendation/types';
import { ReviewWithUser } from '@/types/entities';
import { SafeUserProfile } from '@/types/profile';

interface UseEntityActionsProps {
  entity: Entity | null;
  user: SafeUserProfile | null;
  userReview: ReviewWithUser | null;
  onReviewFormOpen: () => void;
  onTimelineStart: (reviewId: string) => void;
}

export const useEntityActions = ({
  entity,
  user,
  userReview,
  onReviewFormOpen,
  onTimelineStart
}: UseEntityActionsProps) => {
  const { toast } = useToast();
  const { shareEntity } = useEntityShare();

  const getSidebarButtonConfig = useCallback(() => {
    if (!userReview) {
      return {
        text: 'Write Review',
        icon: MessageSquare,
        action: handleAddReview,
        tooltip: null
      };
    }
    
    if (userReview.has_timeline && userReview.timeline_count && userReview.timeline_count > 0) {
      return {
        text: 'Add Timeline Update',
        icon: MessageSquare,
        action: () => handleStartTimeline(userReview.id),
        tooltip: 'Continue tracking how your experience evolves'
      };
    }
    
    return {
      text: 'Update Your Review',
      icon: MessageSquare,
      action: () => handleStartTimeline(userReview.id),
      tooltip: 'Already reviewed this? Add how it\'s going now.'
    };
  }, [userReview]);

  const handleAddReview = useCallback(() => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to add a review",
        variant: "destructive",
      });
      return;
    }
    
    onReviewFormOpen();
  }, [user, toast, onReviewFormOpen]);

  const handleStartTimeline = useCallback((reviewId: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to start a timeline",
        variant: "destructive",
      });
      return;
    }
    
    onTimelineStart(reviewId);
  }, [user, toast, onTimelineStart]);

  const handleShare = useCallback(async () => {
    if (!entity) return;

    const entityUrl = `${window.location.origin}/entity/${entity.slug || entity.id}?v=4`;
    
    await shareEntity({
      name: entity.name,
      description: entity.description || undefined,
      url: entityUrl
    });
  }, [entity, shareEntity]);

  return {
    getSidebarButtonConfig,
    handleAddReview,
    handleStartTimeline,
    handleShare
  };
};
