import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { useProfiles } from '@/hooks/use-profile-cache';
import { CircleContributor } from '@/hooks/use-circle-rating-types';
import { MessageSquareHeart, MessageSquare } from 'lucide-react';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

// Flexible stats type that accepts both old and new formats
interface StatsData {
  recommendationCount: number;
  reviewCount: number;
  averageRating: number | null;
  circleRecommendationCount?: number;
}

interface ContributorModalProps {
  isOpen: boolean;
  onClose: () => void;
  contributors: CircleContributor[];
  entityName?: string;
  stats?: StatsData | null;
}

export const ContributorModal: React.FC<ContributorModalProps> = ({
  isOpen,
  onClose,
  contributors,
  entityName,
  stats
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // Get unique user IDs for profile fetching
  const userIds = contributors.map(c => c.userId);
  const { data: profiles } = useProfiles(userIds);

  const getRatingColor = (rating: number) => {
    if (rating < 2) return "#ea384c";
    if (rating < 3) return "#F97316";
    if (rating < 4) return "#FEC006";
    if (rating < 4.5) return "#84cc16";
    return "#22c55e";
  };

  const handleProfileClick = (userId: string) => {
    navigate(`/profile/${userId}`);
    onClose();
  };

  // Use stats data for total recommendation counts (like entity header)
  const totalRecommendationCount = stats?.recommendationCount || 0;
  const circleRecommendationCount = stats?.circleRecommendationCount || 0;
  const reviewCount = contributors.filter(c => c.type === 'review').length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col mx-4 rounded-xl sm:rounded-xl">
        <DialogHeader className={isMobile ? 'pb-2' : ''}>
          <DialogTitle className={isMobile ? 'flex flex-col items-start gap-1' : 'flex items-center gap-2'}>
            <div className="flex items-center gap-2">
              <RatingRingIcon rating={4.2} size={20} />
              Circle Contributors
            </div>
            {entityName && (
              <span className={`text-muted-foreground ${isMobile ? 'text-sm font-normal ml-7' : 'font-normal'}`}>
                for {entityName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Summary Stats */}
          <div className={`${isMobile ? 'flex flex-col gap-3' : 'flex gap-4'} text-sm`}>
            <div className="flex items-center gap-2">
              <MessageSquareHeart className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'} text-blue-500`} />
              <span>
                {circleRecommendationCount > 0 ? (
                  <>{circleRecommendationCount} recommending from your circle</>
                ) : (
                  <>0 recommending from your circle</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'} text-amber-500`} />
              <span>{reviewCount} reviews from your circle</span>
            </div>
          </div>

          {/* Contributors List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {contributors.map((contributor) => {
              const profile = profiles?.[contributor.userId];
              
              return (
                <div
                  key={contributor.userId}
                  className={`flex items-center gap-3 ${isMobile ? 'p-4' : 'p-3'} rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer ${isMobile ? 'min-h-[64px]' : ''}`}
                  onClick={() => handleProfileClick(contributor.userId)}
                >
                  <ProfileAvatar
                    userId={contributor.userId}
                    size="sm"
                    className="ring-2 ring-background"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {profile?.displayName || profile?.username || 'User'}
                      </span>
                      <Badge
                        variant="outline"
                        className="capitalize text-xs"
                        style={{
                          borderColor: contributor.type === 'recommendation' ? '#3b82f6' : '#f59e0b',
                          color: contributor.type === 'recommendation' ? '#3b82f6' : '#f59e0b'
                        }}
                      >
                        {contributor.type}
                      </Badge>
                    </div>
                    {profile?.username && (
                      <div className="text-sm text-muted-foreground">
                        @{profile.username}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <RatingRingIcon
                        rating={contributor.rating}
                        size={16}
                      />
                      <span
                        className="font-semibold"
                        style={{ color: getRatingColor(contributor.rating) }}
                      >
                        {contributor.rating}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Empty State */}
            {contributors.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <RatingRingIcon rating={3} size={32} className="mx-auto mb-2 opacity-50" />
                <p>No contributors found.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};