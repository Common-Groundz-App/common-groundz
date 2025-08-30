
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { useProfiles } from '@/hooks/use-profile-cache';
import { CircleContributor } from '@/hooks/use-circle-rating-types';
import { formatRelativeDate } from '@/utils/dateUtils';
import { MessageSquareHeart, MessageSquare, ArrowUpDown } from 'lucide-react';
import { RatingRingIcon } from '@/components/ui/rating-ring-icon';
import { useNavigate } from 'react-router-dom';

interface ContributorModalProps {
  isOpen: boolean;
  onClose: () => void;
  contributors: CircleContributor[];
  entityName?: string;
}

type SortOption = 'rating-desc' | 'rating-asc' | 'recent' | 'oldest';

export const ContributorModal: React.FC<ContributorModalProps> = ({
  isOpen,
  onClose,
  contributors,
  entityName
}) => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('rating-desc');
  const [filterType, setFilterType] = useState<'all' | 'recommendation' | 'review'>('all');
  
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

  const filteredContributors = contributors.filter(contributor => {
    if (filterType === 'all') return true;
    return contributor.type === filterType;
  });

  const sortedContributors = [...filteredContributors].sort((a, b) => {
    switch (sortBy) {
      case 'rating-desc':
        return b.rating - a.rating;
      case 'rating-asc':
        return a.rating - b.rating;
      case 'recent':
      case 'oldest':
        // For now, sort by rating since we don't have timestamps
        return sortBy === 'recent' ? b.rating - a.rating : a.rating - b.rating;
      default:
        return 0;
    }
  });

  const handleProfileClick = (userId: string) => {
    navigate(`/profile/${userId}`);
    onClose();
  };

  const recommendationCount = contributors.filter(c => c.type === 'recommendation').length;
  const reviewCount = contributors.filter(c => c.type === 'review').length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RatingRingIcon rating={4.2} size={20} />
            Circle Contributors
            {entityName && (
              <span className="text-muted-foreground font-normal">
                for {entityName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Summary Stats */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <MessageSquareHeart className="h-4 w-4 text-blue-500" />
              <span>{recommendationCount} Recommendations</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-500" />
              <span>{reviewCount} Reviews</span>
            </div>
          </div>

          {/* Filters and Sort */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-sm border rounded px-2 py-1 bg-background"
              >
                <option value="rating-desc">Highest Rating</option>
                <option value="rating-asc">Lowest Rating</option>
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          {/* Tabs with Content */}
          <Tabs value={filterType} onValueChange={(value) => setFilterType(value as any)} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All ({contributors.length})</TabsTrigger>
              <TabsTrigger value="recommendation">
                Recommendations ({recommendationCount})
              </TabsTrigger>
              <TabsTrigger value="review">Reviews ({reviewCount})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-3 h-full">
                {sortedContributors.map((contributor) => {
                  const profile = profiles?.[contributor.userId];
                  
                  return (
                    <div
                      key={contributor.userId}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
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
                
                {/* Empty State for All */}
                {sortedContributors.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <RatingRingIcon rating={3} size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No contributors found.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="recommendation" className="flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-3 h-full">
                {sortedContributors.filter(c => c.type === 'recommendation').map((contributor) => {
                  const profile = profiles?.[contributor.userId];
                  
                  return (
                    <div
                      key={contributor.userId}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
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
                              borderColor: '#3b82f6',
                              color: '#3b82f6'
                            }}
                          >
                            recommendation
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
                
                {/* Empty State for Recommendations */}
                {sortedContributors.filter(c => c.type === 'recommendation').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <RatingRingIcon rating={3} size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No recommendation contributors found.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="review" className="flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-3 h-full">
                {sortedContributors.filter(c => c.type === 'review').map((contributor) => {
                  const profile = profiles?.[contributor.userId];
                  
                  return (
                    <div
                      key={contributor.userId}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
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
                              borderColor: '#f59e0b',
                              color: '#f59e0b'
                            }}
                          >
                            review
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
                
                {/* Empty State for Reviews */}
                {sortedContributors.filter(c => c.type === 'review').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <RatingRingIcon rating={3} size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No review contributors found.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
