
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { toggleFollowStatus } from '../api/circleService';
import { UserProfile } from '../types';
import { useEmailVerification } from '@/hooks/useEmailVerification';

export const useFollowActions = (currentUserId?: string) => {
  const { toast } = useToast();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleFollowToggle = async (
    targetUserId: string,
    currentlyFollowing: boolean,
    updateFollowers: (userId: string, isFollowing: boolean) => void,
    updateFollowing: (userId: string, isFollowing: boolean) => void
  ) => {
    if (!currentUserId) return false;
    
    // Email verification gate (Phase 2 — UI only)
    if (!canPerformAction('canFollowUsers')) {
      showVerificationRequired('canFollowUsers');
      return false;
    }
    
    setActionLoading(targetUserId);
    
    try {
      const isNowFollowing = await toggleFollowStatus(
        currentUserId, 
        targetUserId, 
        currentlyFollowing
      );
      
      // Show success toast
      toast({
        title: isNowFollowing ? 'Following' : 'Unfollowed',
        description: isNowFollowing 
          ? 'You are now following this user.' 
          : 'You are no longer following this user.',
      });
      
      // Update UI state
      updateFollowers(targetUserId, isNowFollowing);
      updateFollowing(targetUserId, isNowFollowing);
      
      return true; // Indicate success
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update follow status',
        variant: 'destructive',
      });
      return false; // Indicate failure
    } finally {
      setActionLoading(null);
    }
  };

  return {
    actionLoading,
    handleFollowToggle
  };
};
