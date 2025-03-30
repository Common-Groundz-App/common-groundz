
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UserProfile } from './types';

export const useCircleData = (profileUserId: string, currentUserId?: string) => {
  const { toast } = useToast();
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchCircles = async () => {
      if (!profileUserId) return;
      
      setIsLoading(true);
      
      try {
        // Fetch followers (people who follow the profile user)
        const { data: followersData, error: followersError } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', profileUserId);
        
        if (followersError) throw followersError;
        
        // Fetch the profile data for each follower
        const followerProfiles: UserProfile[] = [];
        
        if (followersData && followersData.length > 0) {
          const followerIds = followersData.map(item => item.follower_id);
          
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', followerIds);
          
          if (profilesError) throw profilesError;
          
          if (profilesData) {
            // If the current user is viewing the profile, check which users they follow
            let userFollowingIds: string[] = [];
            if (currentUserId) {
              const { data: userFollowing, error: userFollowingError } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', currentUserId);
              
              if (!userFollowingError && userFollowing) {
                userFollowingIds = userFollowing.map(f => f.following_id);
              }
            }
            
            // Process the profiles
            profilesData.forEach(profile => {
              followerProfiles.push({
                id: profile.id,
                username: profile.username,
                avatar_url: profile.avatar_url,
                isFollowing: userFollowingIds.includes(profile.id)
              });
            });
          }
        }
        
        // Fetch following (people the profile user follows)
        const { data: followingData, error: followingError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', profileUserId);
        
        if (followingError) throw followingError;
        
        // Fetch the profile data for each following
        const followingProfiles: UserProfile[] = [];
        
        if (followingData && followingData.length > 0) {
          const followingIds = followingData.map(item => item.following_id);
          
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', followingIds);
          
          if (profilesError) throw profilesError;
          
          if (profilesData) {
            // If the current user is viewing the profile, check which users they follow
            let userFollowingIds: string[] = [];
            if (currentUserId) {
              const { data: userFollowing, error: userFollowingError } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', currentUserId);
              
              if (!userFollowingError && userFollowing) {
                userFollowingIds = userFollowing.map(f => f.following_id);
              }
            }
            
            // Process the profiles
            profilesData.forEach(profile => {
              followingProfiles.push({
                id: profile.id,
                username: profile.username,
                avatar_url: profile.avatar_url,
                isFollowing: userFollowingIds.includes(profile.id)
              });
            });
          }
        }
        
        setFollowers(followerProfiles);
        setFollowing(followingProfiles);
      } catch (error) {
        console.error('Error fetching circles:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCircles();
  }, [profileUserId, currentUserId]);

  const handleFollowToggle = async (targetUserId: string, currentlyFollowing: boolean) => {
    if (!currentUserId) return;
    
    setActionLoading(targetUserId);
    
    try {
      if (currentlyFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);
        
        if (error) throw error;
        
        toast({
          title: 'Unfollowed',
          description: 'You are no longer following this user.',
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: targetUserId
          });
        
        if (error) throw error;
        
        toast({
          title: 'Following',
          description: 'You are now following this user.',
        });
      }
      
      // Update the UI
      setFollowers(prev => 
        prev.map(follower => 
          follower.id === targetUserId 
            ? {...follower, isFollowing: !currentlyFollowing} 
            : follower
        )
      );
      
      setFollowing(prev => 
        prev.map(follow => 
          follow.id === targetUserId 
            ? {...follow, isFollowing: !currentlyFollowing} 
            : follow
        )
      );
      
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update follow status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return {
    followers,
    following,
    isLoading,
    actionLoading,
    handleFollowToggle
  };
};
