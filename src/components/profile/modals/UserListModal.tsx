
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const navigate = useNavigate();
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
        
        console.log(`Fetched ${userData.length} ${listType} for user ${profileUserId}`);
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
    const isActionFollow = !isFollowing;
    const isActionUnfollow = isFollowing;
    
    // First update the local UI state
    setUsers(prev => 
      prev.map(user => 
        user.id === userId 
          ? {...user, isFollowing: !isFollowing} 
          : user
      )
    );
    
    // Then perform the actual follow/unfollow action
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
    
    // If the action was successful, update the count in the profile card
    if (wasSuccessful) {
      // If this is viewing own profile and follows someone from modal
      if (user?.id === profileUserId && isActionFollow) {
        // Increment following count for own profile
        window.dispatchEvent(new CustomEvent('profile-following-count-changed', { 
          detail: { 
            countChange: 1,
            immediate: true
          } 
        }));
      }
      
      // If this is viewing own profile and unfollows someone from modal
      if (user?.id === profileUserId && isActionUnfollow) {
        // Decrement following count for own profile
        window.dispatchEvent(new CustomEvent('profile-following-count-changed', { 
          detail: { 
            countChange: -1,
            immediate: true
          } 
        }));
      }
      
      // If the user follows/unfollows a profile's owner
      if (userId === profileUserId) {
        // Update follower count when the viewed profile is followed/unfollowed
        window.dispatchEvent(new CustomEvent('profile-follower-count-changed', { 
          detail: { 
            countChange: isActionFollow ? 1 : -1,
            immediate: true
          } 
        }));
      }
    }
  };

  const handleUserClick = (userId: string) => {
    const userProfile = users.find(u => u.id === userId);
    onOpenChange(false);
    navigate(userProfile?.username ? `/u/${userProfile.username}` : `/profile/${userId}`);
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
                  className="transition-all duration-200"
                >
                  <UserCard
                    id={userProfile.id}
                    username={userProfile.username}
                    avatarUrl={userProfile.avatar_url}
                    isFollowing={userProfile.isFollowing}
                    relationshipType={listType === 'followers' ? 'follower' : 'following'}
                    onFollowToggle={() => handleFollowToggle(userProfile.id, userProfile.isFollowing)}
                    isLoading={actionLoading === userProfile.id}
                    isOwnProfile={isOwnProfile}
                    currentUserId={user?.id}
                    onNavigate={handleUserClick}
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
