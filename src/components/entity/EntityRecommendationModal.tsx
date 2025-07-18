
import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, ThumbsUp, Filter, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserCard from '@/components/profile/circles/UserCard';
import UserCardSkeleton from '@/components/profile/circles/UserCardSkeleton';
import { useFollowActions } from '@/components/profile/circles/hooks/useFollowActions';
import { getEntityRecommendersWithContext, type EntityRecommenderWithContext } from '@/services/entityRecommenderService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { formatRelativeDate } from '@/utils/dateUtils';

interface EntityRecommendationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityName?: string;
  totalRecommendationCount: number;
  circleRecommendationCount?: number;
}

const getRelationshipLabel = (recommender: EntityRecommenderWithContext): string => {
  if (recommender.is_mutual) return 'Mutual connection';
  if (recommender.is_following) return 'You follow them';
  return '';
};

export const EntityRecommendationModal: React.FC<EntityRecommendationModalProps> = ({
  open,
  onOpenChange,
  entityId,
  entityName,
  totalRecommendationCount,
  circleRecommendationCount = 0
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { actionLoading, handleFollowToggle: toggleFollow } = useFollowActions(user?.id);
  
  const [recommenders, setRecommenders] = useState<EntityRecommenderWithContext[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState<'all' | 'following' | 'mutual'>('all');

  // Filter recommenders based on search and relationship filter
  const filteredRecommenders = useMemo(() => {
    return recommenders.filter(recommender => {
      const searchMatch = !searchQuery || 
        recommender.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recommender.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recommender.last_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const relationshipMatch = relationshipFilter === 'all' ||
        (relationshipFilter === 'following' && recommender.is_following) ||
        (relationshipFilter === 'mutual' && recommender.is_mutual);

      return searchMatch && relationshipMatch;
    });
  }, [recommenders, searchQuery, relationshipFilter]);

  const fetchRecommenders = async () => {
    if (!entityId) return;
    
    setIsLoading(true);
    try {
      const data = await getEntityRecommendersWithContext(entityId, user?.id || null, {
        limit: 100
      });
      setRecommenders(data);
    } catch (error) {
      console.error('Error fetching recommenders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recommenders. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && entityId) {
      fetchRecommenders();
    }
  }, [open, entityId, user?.id]);

  // Reset filters when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setRelationshipFilter('all');
    }
  }, [open]);

  const handleUserClick = (userId: string) => {
    onOpenChange(false);
    navigate(`/profile/${userId}`);
  };

  const handleFollowToggle = async (userId: string, isFollowing: boolean) => {
    // Update local state immediately
    setRecommenders(prev => 
      prev.map(recommender => 
        recommender.id === userId 
          ? {...recommender, is_following: !isFollowing} 
          : recommender
      )
    );
    
    // Perform the actual follow/unfollow action
    await toggleFollow(userId, isFollowing, 
      // Update followers state
      (targetUserId, newFollowStatus) => {
        setRecommenders(prev => 
          prev.map(recommender => 
            recommender.id === targetUserId 
              ? {...recommender, is_following: newFollowStatus} 
              : recommender
          )
        );
      },
      // Update following state (not used in this context)
      () => {}
    );
  };

  const followingCount = recommenders.filter(r => r.is_following).length;
  const mutualCount = recommenders.filter(r => r.is_mutual).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5" />
            {entityName ? `${entityName} Recommenders` : 'Entity Recommenders'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {totalRecommendationCount} recommendation{totalRecommendationCount !== 1 ? 's' : ''}
            {circleRecommendationCount > 0 && (
              <> • {circleRecommendationCount} from your circle</>
            )}
          </p>
        </DialogHeader>

        {/* Search and Filter Controls */}
        <div className="flex-shrink-0 space-y-3 border-b pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recommenders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={relationshipFilter}
              onValueChange={(value: 'all' | 'following' | 'mutual') => setRelationshipFilter(value)}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All recommenders</SelectItem>
                <SelectItem value="following">People you follow</SelectItem>
                <SelectItem value="mutual">Mutual connections</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Recommenders List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, index) => (
              <UserCardSkeleton key={index} />
            ))
          ) : filteredRecommenders.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ThumbsUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-muted-foreground mb-2">
                {searchQuery || relationshipFilter !== 'all' 
                  ? 'No recommenders found'
                  : 'No recommendations yet'
                }
              </h3>
              <p className="text-sm text-muted-foreground/70">
                {searchQuery || relationshipFilter !== 'all'
                  ? 'Try adjusting your search or filter'
                  : 'Be the first to recommend this!'
                }
              </p>
            </div>
          ) : (
            // Recommenders list
            <ScrollArea className="h-full">
              <div className="divide-y divide-gray-100">
                {filteredRecommenders.map((recommender) => (
                  <div key={recommender.id} className="transition-all duration-200">
                    <UserCard
                      id={recommender.id}
                      username={recommender.username}
                      avatarUrl={recommender.avatar_url}
                      isFollowing={recommender.is_following}
                      relationshipType="recommender"
                      onFollowToggle={() => handleFollowToggle(recommender.id, recommender.is_following)}
                      isLoading={actionLoading === recommender.id}
                      isOwnProfile={false}
                      currentUserId={user?.id}
                      onNavigate={handleUserClick}
                    />
                    {/* Recommendation context and relationship label */}
                    <div className="px-4 pb-2 space-y-1">
                      {/* Recommendation details */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/70 ml-12">
                        {recommender.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current text-yellow-500" />
                            <span>{recommender.rating}/5</span>
                          </div>
                        )}
                        <span>•</span>
                        <span>{formatRelativeDate(recommender.recommended_at)}</span>
                      </div>
                      {/* Relationship context label */}
                      {getRelationshipLabel(recommender) && (
                        <p className="text-xs text-muted-foreground/70 ml-12">
                          {getRelationshipLabel(recommender)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Results count */}
        {!isLoading && (searchQuery || relationshipFilter !== 'all') && (
          <div className="flex-shrink-0 pt-3 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Showing {filteredRecommenders.length} of {recommenders.length} recommenders
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
