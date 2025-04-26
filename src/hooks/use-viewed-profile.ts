import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProfileData {
  id: string;
  username: string | null;
  firstName?: string;
  lastName?: string;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string;
  isOwnProfile: boolean;
}

export const useViewedProfile = (userId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Determine if this is the current user's profile
  const isOwnProfile = user?.id === userId || (!userId && !!user);
  
  // Reset state when userId changes
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setProfileData(null);
    setFollowerCount(0);
    setFollowingCount(0);
  }, [userId]);

  // Fetch profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setIsLoading(true);
        
        // Get the ID to fetch (either from URL or current user)
        const profileId = isOwnProfile ? user?.id : userId;
        
        if (!profileId) {
          setIsLoading(false);
          return;
        }

        // Fetch profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .single();

        if (profileError) {
          throw profileError;
        }

        // Fetch additional user metadata if this is own profile
        let firstName = '';
        let lastName = '';
        
        if (isOwnProfile && user) {
          firstName = user.user_metadata?.first_name || '';
          lastName = user.user_metadata?.last_name || '';
        }

        // Set profile data
        setProfileData({
          id: profileId,
          username: profile?.username || null,
          firstName,
          lastName, 
          bio: profile?.bio || null,
          location: profile?.location || null,
          avatar_url: profile?.avatar_url || null,
          cover_url: profile?.cover_url || null,
          created_at: profile?.created_at || '',
          isOwnProfile
        });

        // Fetch follower/following counts
        await fetchFollowerCount(profileId);
        await fetchFollowingCount(profileId);
        
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
        toast({
          title: 'Error',
          description: 'Failed to load profile data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user, userId, isOwnProfile, toast]);

  // Fetch follower count
  const fetchFollowerCount = async (profileId: string) => {
    try {
      const { count, error } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profileId);
        
      if (error) throw error;
      setFollowerCount(count || 0);
    } catch (error) {
      console.error('Error fetching follower count:', error);
    }
  };

  // Fetch following count 
  const fetchFollowingCount = async (profileId: string) => {
    try {
      const { count, error } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profileId);
        
      if (error) throw error;
      setFollowingCount(count || 0);
    } catch (error) {
      console.error('Error fetching following count:', error);
    }
  };

  // Handle follow status change events
  useEffect(() => {
    if (!profileData?.id) return;

    const handleFollowStatusChange = async (event: CustomEvent) => {
      const { follower, following, action } = event.detail;
      
      // Update follower count if this profile was followed/unfollowed
      if (profileData.id === following) {
        setFollowerCount(prevCount => 
          action === 'follow' ? prevCount + 1 : Math.max(0, prevCount - 1)
        );
      }
      
      // Update following count if this profile followed/unfollowed someone
      if (profileData.id === follower) {
        await fetchFollowingCount(profileData.id);
      }
    };

    window.addEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    
    return () => {
      window.removeEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    };
  }, [profileData?.id]);

  // Format display name based on available data
  const getDisplayName = (): string => {
    if (!profileData) return '';

    // For own profile, use first/last name if available
    if (profileData.isOwnProfile) {
      if (profileData.firstName || profileData.lastName) {
        return `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
      }
    }
    
    // Otherwise use username
    return profileData.username || 'User';
  };

  // Format formatted username (with @ symbol)
  const getFormattedUsername = (): string => {
    return profileData?.username ? `@${profileData.username}` : '';
  };

  // Format member since date
  const getMemberSince = (): string => {
    if (!profileData?.created_at) return 'Recently joined';
    
    try {
      const createdDate = new Date(profileData.created_at);
      return createdDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long'
      });
    } catch (error) {
      return 'Recently joined';
    }
  };

  return {
    profileData,
    isLoading,
    error,
    followerCount,
    followingCount,
    isOwnProfile,
    displayName: getDisplayName(),
    formattedUsername: getFormattedUsername(),
    memberSince: getMemberSince()
  };
};
