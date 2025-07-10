
import React from 'react';
import { Heart, Bookmark, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityFollowButton } from '@/components/entity/EntityFollowButton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface EntityV3ActionButtonsProps {
  entityId: string;
  entityName: string;
  isLoading?: boolean;
  className?: string;
}

export const EntityV3ActionButtons: React.FC<EntityV3ActionButtonsProps> = ({
  entityId,
  entityName,
  isLoading = false,
  className
}) => {
  const { toast } = useToast();

  const handleBookmark = () => {
    toast({
      title: "Bookmarked",
      description: `${entityName} has been added to your bookmarks`,
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: entityName,
          url: window.location.href,
        });
      } catch (error) {
        // User cancelled or error occurred
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link copied",
          description: "Link has been copied to your clipboard",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to copy link",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className={cn("col-span-full lg:col-span-4 space-y-3", className)}>
        <div className="animate-pulse space-y-2">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("col-span-full lg:col-span-4 space-y-3", className)}>
      {/* Follow Button */}
      <EntityFollowButton
        entityId={entityId}
        entityName={entityName}
        variant="default"
        size="default"
        showCount={true}
      />

      {/* Bookmark Button */}
      <Button
        variant="outline"
        size="default"
        onClick={handleBookmark}
        className="w-full gap-2"
      >
        <Bookmark className="h-4 w-4" />
        Bookmark
      </Button>

      {/* Share Button */}
      <Button
        variant="outline"
        size="default"
        onClick={handleShare}
        className="w-full gap-2"
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>
    </div>
  );
};
