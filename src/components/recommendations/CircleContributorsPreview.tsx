
import React, { useState } from 'react';
import { CircleContributor } from '@/hooks/use-circle-rating-types';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { useProfiles } from '@/hooks/use-profile-cache';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { ContributorModal } from './ContributorModal';
import { RatingDistribution } from './RatingDistribution';
import { Star, Clock } from 'lucide-react';

interface CircleContributorsPreviewProps {
  contributors: CircleContributor[];
  totalCount: number;
  maxDisplay?: number;
  entityName?: string;
}

export const CircleContributorsPreview: React.FC<CircleContributorsPreviewProps> = ({
  contributors,
  totalCount,
  maxDisplay = 4,
  entityName
}) => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Get unique user IDs for profile fetching
  const userIds = contributors.slice(0, maxDisplay).map(c => c.userId);
  const { data: profiles, isLoading } = useProfiles(userIds);
  
  if (contributors.length === 0 || isLoading) {
    return null;
  }

  const visibleContributors = contributors.slice(0, maxDisplay);
  const remainingCount = Math.max(0, totalCount - maxDisplay);

  const getRatingColor = (rating: number) => {
    if (rating < 2) return "#ea384c";
    if (rating < 3) return "#F97316";
    if (rating < 4) return "#FEC006";
    if (rating < 4.5) return "#84cc16";
    return "#22c55e";
  };

  const handleAvatarClick = (userId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    navigate(`/profile/${userId}`);
  };

  const handleViewAllClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsModalOpen(true);
  };

  const handleRatingDistributionClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsModalOpen(true);
  };

  // Generate smart text based on contributor count
  const getViewAllText = () => {
    if (totalCount === 1) return "View details";
    if (totalCount <= maxDisplay) return `View all (${totalCount})`;
    return `+${remainingCount} more`;
  };

  return (
    <TooltipProvider>
      <div className="flex items-center mt-1">
        <div className="flex -space-x-1">
          {visibleContributors.map((contributor, index) => {
            const profile = profiles?.[contributor.userId];
            
            return (
              <Tooltip key={contributor.userId}>
                <TooltipTrigger asChild>
                  <div 
                    className="cursor-pointer relative hover:z-10 transition-all duration-200 hover:scale-110" 
                    style={{ zIndex: maxDisplay - index }}
                    onClick={(e) => handleAvatarClick(contributor.userId, e)}
                  >
                    <ProfileAvatar 
                      userId={contributor.userId}
                      size="xs"
                      className="ring-2 ring-background hover:ring-primary/30 transition-all duration-200"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">
                        {profile?.displayName || profile?.username || 'User'}
                      </div>
                      {profile?.username && (
                        <div className="text-muted-foreground">
                          @{profile.username}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star 
                          className="h-3 w-3" 
                          style={{ color: getRatingColor(contributor.rating) }}
                          fill="currentColor"
                        />
                        <span 
                          className="font-semibold"
                          style={{ color: getRatingColor(contributor.rating) }}
                        >
                          {contributor.rating}★
                        </span>
                      </div>
                      <div className="text-muted-foreground capitalize">
                        {contributor.type}
                      </div>
                    </div>
                    
                    <div className="text-muted-foreground text-xs">
                      Click to view profile
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          
          {/* Always show view details link when there are contributors */}
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={handleViewAllClick}
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer hover:underline"
            >
              {getViewAllText()}
            </button>
          </div>
        </div>
        
        {/* Rating Distribution - Now clickable */}
        {contributors.length > 1 && (
          <div className="ml-3 flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="cursor-pointer transition-all duration-200 hover:scale-105"
                  onClick={handleRatingDistributionClick}
                >
                  <RatingDistribution 
                    contributors={contributors} 
                    size="sm" 
                    className="w-16"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="text-xs">
                  Click to view detailed rating breakdown
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Contributors Modal */}
      <ContributorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        contributors={contributors}
        entityName={entityName}
      />
    </TooltipProvider>
  );
};
