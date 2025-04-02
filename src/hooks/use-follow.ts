
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export const useFollow = (profileUserId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState<boolean>(false);
  
  // Check if the current user is following the profile user
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user || !profileUserId || user.id === profileUserId) return;
      
      try {
        const { data, error } = await supabase
          .from('follows')
          .select('*')
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

  const handleFollowToggle = async () => {
    if (!user || !profileUserId) return;
    
    setFollowLoading(true);
    
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profileUserId);
        
        if (error) throw error;
        
        // Update local state
        setIsFollowing(false);
        
        // Notify the user
        toast({
          title: 'Unfollowed',
          description: 'You are no longer following this user.',
        });
        
        // Dispatch a global event for real-time follower count updates
        window.dispatchEvent(new CustomEvent('follow-status-changed', { 
          detail: { 
            follower: user.id,
            following: profileUserId,
            action: 'unfollow'
          } 
        }));
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: profileUserId
          });
        
        if (error) throw error;
        
        // Update local state
        setIsFollowing(true);
        
        // Notify the user
        toast({
          title: 'Following',
          description: 'You are now following this user.',
        });
        
        // Dispatch a global event for real-time follower count updates
        window.dispatchEvent(new CustomEvent('follow-status-changed', { 
          detail: { 
            follower: user.id,
            following: profileUserId,
            action: 'follow'
          } 
        }));
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
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
