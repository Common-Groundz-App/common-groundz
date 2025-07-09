
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Heart, 
  Share2, 
  Bookmark, 
  Star, 
  Bell,
  BellOff,
  Users,
  Plus,
  Check
} from 'lucide-react';
import { useEntityFollow } from '@/hooks/use-entity-follow';
import { useToast } from '@/hooks/use-toast';
import { Entity } from '@/services/recommendation/types';

interface EntityV3SidebarActionsProps {
  entity: Entity;
  stats?: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
}

export const EntityV3SidebarActions: React.FC<EntityV3SidebarActionsProps> = ({ 
  entity, 
  stats 
}) => {
  const { isFollowing, followersCount, isLoading, toggleFollow, canFollow } = useEntityFollow(entity.id);
  const { toast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const handleFollow = async () => {
    if (!canFollow) {
      toast({
        title: "Authentication required",
        description: "Please sign in to follow entities",
        variant: "destructive",
      });
      return;
    }

    try {
      await toggleFollow();
      toast({
        title: isFollowing ? "Unfollowed" : "Following",
        description: isFollowing 
          ? `You are no longer following ${entity.name}` 
          : `You are now following ${entity.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    toast({
      title: isBookmarked ? "Removed from bookmarks" : "Bookmarked",
      description: isBookmarked 
        ? `${entity.name} removed from your bookmarks`
        : `${entity.name} added to your bookmarks`,
    });
  };

  const handleShare = (platform?: string) => {
    const url = window.location.href;
    const text = `Check out ${entity.name}`;
    
    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else {
      navigator.clipboard.writeText(url);
      toast({
        title: "Link copied",
        description: "Share link copied to clipboard",
      });
    }
    setShowShareOptions(false);
  };

  const handleReview = () => {
    // Navigate to review creation or open modal
    toast({
      title: "Review feature",
      description: "Review creation will be implemented soon",
    });
  };

  return (
    <div className="space-y-4">
      {/* Primary Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            className="w-full" 
            variant="default"
            onClick={handleReview}
          >
            <Star className="h-4 w-4 mr-2" />
            Write Review
          </Button>
          
          <Button 
            className={`w-full ${isFollowing ? 'bg-red-500 hover:bg-red-600' : ''}`}
            variant={isFollowing ? 'default' : 'outline'}
            onClick={handleFollow}
            disabled={isLoading}
          >
            {isFollowing ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Following
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Follow
              </>
            )}
          </Button>
          
          <div className="flex gap-2">
            <Button 
              className="flex-1" 
              variant="outline" 
              size="sm"
              onClick={() => setShowShareOptions(!showShareOptions)}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button 
              className="flex-1" 
              variant="outline" 
              size="sm"
              onClick={handleBookmark}
            >
              <Bookmark className={`h-4 w-4 mr-2 ${isBookmarked ? 'fill-current' : ''}`} />
              {isBookmarked ? 'Saved' : 'Save'}
            </Button>
          </div>
          
          {/* Share Options */}
          {showShareOptions && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg">
              <Button variant="ghost" size="sm" onClick={() => handleShare('twitter')}>
                Twitter
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleShare('facebook')}>
                Facebook  
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleShare('whatsapp')}>
                WhatsApp
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleShare('copy')}>
                Copy Link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow Stats */}
      {followersCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span>{followersCount} followers</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {isFollowing ? (
                  <>
                    <Bell className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Notifications on</span>
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Follow for updates</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">Type</div>
            <Badge variant="secondary" className="capitalize">
              {entity.type}
            </Badge>
          </div>
          
          {entity.venue && (
            <div>
              <div className="text-sm font-medium mb-1">Location</div>
              <div className="text-sm text-muted-foreground">{entity.venue}</div>
            </div>
          )}
          
          {entity.website_url && (
            <div>
              <div className="text-sm font-medium mb-1">Website</div>
              <a 
                href={entity.website_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Visit Website
              </a>
            </div>
          )}
          
          {entity.is_verified && (
            <div>
              <div className="text-sm font-medium mb-1">Status</div>
              <Badge variant="default">Verified</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
