import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Users, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserCard from '@/components/profile/circles/UserCard';
import UserCardSkeleton from '@/components/profile/circles/UserCardSkeleton';
import EmptyState from '@/components/profile/circles/EmptyState';
import { useFollowActions } from '@/components/profile/circles/hooks/useFollowActions';
import { getEntityFollowersWithContext, type EntityFollowerWithContext } from '@/services/entityFollowService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface EntityFollowerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityName?: string;
  totalFollowersCount: number;
}

const getRelationshipLabel = (follower: EntityFollowerWithContext): string => {
  if (follower.is_mutual) return 'Mutual connection';
  if (follower.is_following) return 'You follow them';
  return '';
};

export const EntityFollowerModal: React.FC<EntityFollowerModalProps> = ({
  open,
  onOpenChange,
  entityId,
  entityName,
  totalFollowersCount
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { actionLoading, handleFollowToggle: toggleFollow } = useFollowActions(user?.id);
  
  const [followers, setFollowers] = useState<EntityFollowerWithContext[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState<'all' | 'following' | 'mutual'>('all');

  // Filter followers based on search and relationship filter
  const filteredFollowers = useMemo(() => {
    return followers.filter(follower => {
      const searchMatch = !searchQuery || 
        follower.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        follower.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        follower.last_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const relationshipMatch = relationshipFilter === 'all' ||
        (relationshipFilter === 'following' && follower.is_following) ||
        (relationshipFilter === 'mutual' && follower.is_mutual);

      return searchMatch && relationshipMatch;
    });
  }, [followers, searchQuery, relationshipFilter]);

  const fetchFollowers = async () => {
    if (!entityId) return;
    
    setIsLoading(true);
    try {
      const data = await getEntityFollowersWithContext(entityId, user?.id || null, {
        limit: 100 // Get more followers for the modal
      });
      setFollowers(data);
    } catch (error) {
      console.error('Error fetching followers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load followers. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && entityId) {
      fetchFollowers();
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
    setFollowers(prev => 
      prev.map(follower => 
        follower.id === userId 
          ? {...follower, is_following: !isFollowing} 
          : follower
      )
    );
    
    // Perform the actual follow/unfollow action
    await toggleFollow(userId, isFollowing, 
      // Update followers state
      (targetUserId, newFollowStatus) => {
        setFollowers(prev => 
          prev.map(follower => 
            follower.id === targetUserId 
              ? {...follower, is_following: newFollowStatus} 
              : follower
          )
        );
      },
      // Update following state (not used in this context)
      () => {}
    );
  };

  const followingCount = followers.filter(f => f.is_following).length;
  const mutualCount = followers.filter(f => f.is_mutual).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {entityName ? `${entityName} Followers` : 'Entity Followers'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {totalFollowersCount} follower{totalFollowersCount !== 1 ? 's' : ''}
            {followingCount > 0 && (
              <> • {followingCount} you follow</>
            )}
          </p>
        </DialogHeader>

        {/* Search and Filter Controls */}
        <div className="flex-shrink-0 space-y-3 border-b pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search followers..."
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
                <SelectItem value="all">All followers</SelectItem>
                <SelectItem value="following">People you follow</SelectItem>
                <SelectItem value="mutual">Mutual connections</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Followers List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, index) => (
              <UserCardSkeleton key={index} />
            ))
          ) : filteredFollowers.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-muted-foreground mb-2">
                {searchQuery || relationshipFilter !== 'all' 
                  ? 'No followers found'
                  : 'No followers yet'
                }
              </h3>
              <p className="text-sm text-muted-foreground/70">
                {searchQuery || relationshipFilter !== 'all'
                  ? 'Try adjusting your search or filter'
                  : 'Be the first to follow this!'
                }
              </p>
            </div>
          ) : (
            // Followers list
            <ScrollArea className="h-full">
              <div className="divide-y divide-gray-100">
                {filteredFollowers.map((follower) => (
                  <div key={follower.id} className="transition-all duration-200">
                    <UserCard
                      id={follower.id}
                      username={follower.username}
                      avatarUrl={follower.avatar_url}
                      isFollowing={follower.is_following}
                      relationshipType="follower"
                      onFollowToggle={() => handleFollowToggle(follower.id, follower.is_following)}
                      isLoading={actionLoading === follower.id}
                      isOwnProfile={false}
                      currentUserId={user?.id}
                      onNavigate={handleUserClick}
                    />
                    {/* Relationship context label */}
                    {getRelationshipLabel(follower) && (
                      <div className="px-4 pb-2">
                        <p className="text-xs text-muted-foreground/70 ml-12">
                          {getRelationshipLabel(follower)}
                        </p>
                      </div>
                    )}
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
              Showing {filteredFollowers.length} of {followers.length} followers
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};