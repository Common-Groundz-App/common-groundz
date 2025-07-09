
import React, { useState } from 'react';
import { Heart, Share2, Bookmark, Edit3, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface EntityV3ActionButtonsProps {
  entityId: string;
  entityName: string;
  websiteUrl?: string;
  className?: string;
}

export const EntityV3ActionButtons: React.FC<EntityV3ActionButtonsProps> = ({
  entityId,
  entityName,
  websiteUrl,
  className
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { toast } = useToast();

  const handleLike = () => {
    setIsLiked(!isLiked);
    toast({
      title: isLiked ? "Removed from favorites" : "Added to favorites",
      description: `${entityName} ${isLiked ? 'removed from' : 'added to'} your favorites.`,
    });
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    toast({
      title: isSaved ? "Removed from saved" : "Saved for later",
      description: `${entityName} ${isSaved ? 'removed from' : 'added to'} your saved items.`,
    });
  };

  const handleShare = async () => {
    const currentUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: entityName,
          url: currentUrl,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      try {
        await navigator.clipboard.writeText(currentUrl);
        toast({
          title: "Link copied!",
          description: "The link has been copied to your clipboard.",
        });
      } catch (error) {
        toast({
          title: "Failed to copy link",
          description: "Please copy the URL manually from your browser.",
          variant: "destructive",
        });
      }
    }
  };

  const handleWriteReview = () => {
    toast({
      title: "Write a review",
      description: "Review functionality coming soon!",
    });
  };

  const handleVisitWebsite = () => {
    if (websiteUrl) {
      window.open(websiteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Primary Actions */}
      <div className="flex gap-2">
        <Button 
          onClick={handleWriteReview}
          className="flex-1"
          size="lg"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Write Review
        </Button>
        
        {websiteUrl && (
          <Button 
            variant="outline"
            onClick={handleVisitWebsite}
            className="flex-1"
            size="lg"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Visit Website
          </Button>
        )}
      </div>

      {/* Secondary Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleLike}
          className={cn(
            "flex-1",
            isLiked && "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
          )}
        >
          <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleSave}
          className={cn(
            "flex-1",
            isSaved && "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
          )}
        >
          <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleShare}
          className="flex-1"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
