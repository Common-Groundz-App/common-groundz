
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import {
  FOLLOW_STATUS_CHANGED_EVENT,
  dispatchFollowStatusChanged,
  isFollowEventFor,
  isUniqueViolation,
  parseFollowStatusChanged,
} from '@/utils/followEvents';

export const useFollow = (profileUserId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { requireAuth } = useAuthPrompt();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState<boolean>(false);

  // Live mirror of the signed-in id, readable from inside async closures so a
  // sign-out / account switch mid-request can never toast or write stale state.
  const viewerRef = useRef<string | null>(user?.id ?? null);
  viewerRef.current = user?.id ?? null;

  // Check if the current user is following the profile user
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user || !profileUserId || user.id === profileUserId) return;
      
      try {
        const { data, error } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', user.id)
          .eq('following_id', profileUserId)
          .maybeSingle();
        
        if (error) throw error;
        setIsFollowing(!!data);
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };
    
    checkFollowStatus();
  }, [user, profileUserId]);

  // Live sync: another surface (e.g. the notification drawer) followed or
  // unfollowed this same user, so flip immediately instead of waiting for a
  // remount/refresh. Strictly account-scoped and target-scoped.
  useEffect(() => {
    const viewerId = user?.id ?? null;
    if (!viewerId || !profileUserId) return;

    const handler = (event: Event) => {
      const detail = parseFollowStatusChanged(event);
      if (!detail) return;
      if (!isFollowEventFor(detail, viewerId, profileUserId)) return;
      setIsFollowing(detail.action === 'follow');
    };

    window.addEventListener(FOLLOW_STATUS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FOLLOW_STATUS_CHANGED_EVENT, handler);
  }, [user?.id, profileUserId]);

  const syncFollowCaches = (viewerId: string, targetId: string, following: boolean) => {
    queryClient.setQueryData<string[]>(['user-following', viewerId], (prev) => {
      if (!prev) return prev;
      if (following) return prev.includes(targetId) ? prev : [...prev, targetId];
      return prev.filter((id) => id !== targetId);
    });
    void queryClient.invalidateQueries({ queryKey: ['notification-follow-back', viewerId] });
    void queryClient.invalidateQueries({ queryKey: ['followers', targetId] });
    void queryClient.invalidateQueries({ queryKey: ['following', viewerId] });
  };

  const handleFollowToggle = async () => {
    if (!profileUserId) return;
    if (!requireAuth({ action: 'follow', surface: 'profile_header' })) return;
    
    // Email verification gate (Phase 2 — UI only)
    if (!canPerformAction('canFollowUsers')) {
      showVerificationRequired('canFollowUsers');
      return;
    }

    const currentViewerId = user?.id ?? null;
    if (!currentViewerId || currentViewerId === profileUserId) return;

    const isSameAccount = () => viewerRef.current === currentViewerId;
    
    setFollowLoading(true);
    
    try {
      if (isFollowing) {
        // Unfollow. Returning rows tells us whether this was a real transition:
        // a no-op delete must not dispatch (count listeners would decrement).
        const { data, error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentViewerId)
          .eq('following_id', profileUserId)
          .select('follower_id');
        
        if (error) throw error;
        if (!isSameAccount()) return;

        const removed = (data ?? []).length > 0;
        
        setIsFollowing(false);
        syncFollowCaches(currentViewerId, profileUserId, false);
        
        if (removed) {
          toast({
            title: 'Unfollowed',
            description: 'You are no longer following this user.',
          });
          dispatchFollowStatusChanged({
            follower: currentViewerId,
            following: profileUserId,
            action: 'unfollow',
          });
        }
      } else {
        // Follow — idempotent insert-ignore. `follows` has no UPDATE policy, so
        // this must be DO NOTHING; a duplicate returns zero rows, which is our
        // "nothing changed" signal (no event, no toast, no count bump).
        const { data, error } = await supabase
          .from('follows')
          .upsert(
            { follower_id: currentViewerId, following_id: profileUserId },
            { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
          )
          .select('follower_id');
        
        // Any remaining race that still raises a unique violation is a success.
        if (error && !isUniqueViolation(error)) throw error;
        if (!isSameAccount()) return;

        const inserted = !error && (data ?? []).length > 0;
        
        setIsFollowing(true);
        syncFollowCaches(currentViewerId, profileUserId, true);
        
        if (inserted) {
          toast({
            title: 'Following',
            description: 'You are now following this user.',
          });
          dispatchFollowStatusChanged({
            follower: currentViewerId,
            following: profileUserId,
            action: 'follow',
          });
        }
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      if (!isSameAccount()) return;
      toast({
        title: 'Error',
        description: error.message || 'Failed to update follow status',
        variant: 'destructive',
      });
    } finally {
      setFollowLoading(false);
    }
  };

  return {
    isFollowing,
    followLoading,
    handleFollowToggle
  };
};
