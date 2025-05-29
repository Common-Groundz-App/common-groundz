
import React from 'react';
import { CircleContributor } from '@/hooks/use-circle-rating-types';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { useProfiles } from '@/hooks/use-profile-cache';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CircleContributorsPreviewProps {
  contributors: CircleContributor[];
  totalCount: number;
  maxDisplay?: number;
}

export const CircleContributorsPreview: React.FC<CircleContributorsPreviewProps> = ({
  contributors,
  totalCount,
  maxDisplay = 4
}) => {
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

  return (
    <TooltipProvider>
      <div className="flex items-center mt-1">
        <div className="flex -space-x-1">
          {visibleContributors.map((contributor, index) => {
            const profile = profiles?.[contributor.userId];
            
            return (
              <Tooltip key={contributor.userId}>
                <TooltipTrigger asChild>
                  <div className="cursor-pointer">
                    <ProfileAvatar 
                      userId={contributor.userId}
                      size="xs"
                      className="ring-2 ring-background hover:ring-primary/20 transition-all duration-200 hover:scale-110"
                      style={{ zIndex: maxDisplay - index }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="text-xs">
                    <div className="font-medium">
                      {profile?.displayName || profile?.username || 'User'}
                    </div>
                    <div 
                      className="font-semibold"
                      style={{ color: getRatingColor(contributor.rating) }}
                    >
                      {contributor.rating}★ {contributor.type}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          
          {remainingCount > 0 && (
            <div className="ml-2 text-xs text-muted-foreground font-medium">
              +{remainingCount} more
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};
