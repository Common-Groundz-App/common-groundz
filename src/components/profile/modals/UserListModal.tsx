
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { fetchFollowers, fetchFollowing } from '@/components/profile/circles/api/circleService';
import { useFollowActions } from '@/components/profile/circles/hooks/useFollowActions';
import { UserProfile } from '@/components/profile/circles/types';
import UserCard from '@/components/profile/circles/UserCard';
import UserCardSkeleton from '@/components/profile/circles/UserCardSkeleton';
import EmptyState from '@/components/profile/circles/EmptyState';
import { X } from 'lucide-react';

interface UserListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileUserId: string;
  listType: 'followers' | 'following';
  isOwnProfile: boolean;
}

const UserListModal = ({ 
  open, 
  onOpenChange, 
  profileUserId, 
  listType,
  isOwnProfile
}: UserListModalProps) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { actionLoading, handleFollowToggle: toggleFollow } = useFollowActions(user?.id);

  useEffect(() => {
    if (!open || !profileUserId) return;
    
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const userData = listType === 'followers' 
          ? await fetchFollowers(profileUserId, user?.id)
          : await fetchFollowing(profileUserId, user?.id);
        
        setUsers(userData);
      } catch (error) {
        console.error(`Error fetching ${listType}:`, error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUsers();
  }, [open, profileUserId, listType, user?.id]);

  const handleFollowToggle = async (userId: string, isFollowing: boolean) => {
    const isActionUnfollow = isFollowing;
    const wasSuccessful = await toggleFollow(userId, isFollowing, 
      // Update followers state
      (targetUserId, newFollowStatus) => {
        setUsers(prev => 
          prev.map(user => 
            user.id === targetUserId 
              ? {...user, isFollowing: newFollowStatus} 
              : user
          )
        );
      },
      // Update following state (same function since we're managing a single list)
      (targetUserId, newFollowStatus) => {
        setUsers(prev => 
          prev.map(user => 
            user.id === targetUserId 
              ? {...user, isFollowing: newFollowStatus} 
              : user
          )
        );
      }
    );
    
    // If this is the user's own profile and they're unfollowing someone from their following list,
    // dispatch a custom event to update the following count
    if (wasSuccessful && isOwnProfile && listType === 'following' && isActionUnfollow) {
      const countChange = -1; // Decreasing the count by 1 for unfollow
      
      window.dispatchEvent(new CustomEvent('profile-following-count-changed', { 
        detail: { 
          countChange,
          immediate: true  // Flag to indicate this should be applied immediately
        } 
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-lg shadow-lg">
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {listType === 'followers' ? 'Followers' : 'Following'}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] px-1">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <UserCardSkeleton key={i} />
              ))}
            </div>
          ) : users.length === 0 ? (
            <EmptyState type={listType} />
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map((userProfile, index) => (
                <div 
                  key={userProfile.id}
                  className="transition-all duration-200 hover:bg-gray-50"
                >
                  <UserCard
                    id={userProfile.id}
                    username={userProfile.username}
                    avatarUrl={userProfile.avatar_url}
                    isFollowing={userProfile.isFollowing}
                    relationshipType={listType === 'followers' ? 'follower' : 'following'}
                    onFollowToggle={handleFollowToggle}
                    isLoading={actionLoading === userProfile.id}
                    isOwnProfile={isOwnProfile}
                    currentUserId={user?.id}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default UserListModal;
