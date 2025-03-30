
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfileData } from './use-profile-data';
import { mockSearchResults } from '@/utils/searchUtils';

export const useProfileDisplayData = (
  userId: string | undefined, 
  currentUserId: string | undefined
) => {
  const [viewingOwnProfile, setViewingOwnProfile] = useState<boolean>(true);
  const [profileUserId, setProfileUserId] = useState<string>('');
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [loadingOtherProfile, setLoadingOtherProfile] = useState<boolean>(false);
  const [isMockUser, setIsMockUser] = useState<boolean>(false);
  
  // Use the hook to get current user's profile data
  const ownProfileData = useProfileData();
  
  // Determine if we're viewing own profile or someone else's
  useEffect(() => {
    if (!currentUserId) return;
    
    // Check if the userId is for a mock user (e.g., "user1", "user2")
    if (userId && userId.startsWith('user')) {
      setViewingOwnProfile(false);
      setProfileUserId(userId);
      setIsMockUser(true);
      
      // Find the mock user in our mock data
      const mockUser = mockSearchResults.find(result => result.id === userId);
      if (mockUser) {
        setOtherUserProfile({
          username: mockUser.title,
          bio: mockUser.subtitle || 'No bio available',
          avatar_url: mockUser.imageUrl || '',
          cover_url: '',
          location: mockUser.location || 'No location available',
          memberSince: mockUser.memberSince || 'January 2021',
          followingCount: mockUser.followingCount || 0
        });
      }
      setLoadingOtherProfile(false);
    } 
    // Check if we're viewing another real user's profile (with UUID)
    else if (userId && userId !== currentUserId) {
      setViewingOwnProfile(false);
      setProfileUserId(userId);
      setIsMockUser(false);
      
      // Fetch the other user's profile from Supabase
      const fetchOtherUserProfile = async () => {
        setLoadingOtherProfile(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (error) throw error;
          
          setOtherUserProfile(data);
        } catch (error) {
          console.error('Error fetching profile:', error);
        } finally {
          setLoadingOtherProfile(false);
        }
      };
      
      fetchOtherUserProfile();
    } 
    // We're viewing our own profile
    else {
      setViewingOwnProfile(true);
      setProfileUserId(currentUserId);
      setIsMockUser(false);
    }
  }, [userId, currentUserId]);

  // Get display data based on whether viewing own or other profile
  const getDisplayData = () => {
    if (viewingOwnProfile) {
      return {
        ...ownProfileData,
        isOwnProfile: true
      };
    } else if (isMockUser) {
      // For mock users, use the data from the mock profile
      return {
        coverImage: otherUserProfile?.cover_url || 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80',
        profileImage: otherUserProfile?.avatar_url || '',
        username: otherUserProfile?.username || 'User',
        bio: otherUserProfile?.bio || 'No bio available',
        location: otherUserProfile?.location || 'No location available',
        memberSince: otherUserProfile?.memberSince || 'January 2021',
        followingCount: otherUserProfile?.followingCount || 0,
        isLoading: false,
        hasChanges: false,
        handleProfileImageChange: undefined,
        handleCoverImageChange: undefined,
        handleCoverImageUpdated: undefined,
        handleSaveChanges: undefined,
        isOwnProfile: false
      };
    } else {
      // For real Supabase users
      return {
        coverImage: otherUserProfile?.cover_url || 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80',
        profileImage: otherUserProfile?.avatar_url || '',
        username: otherUserProfile?.username || 'User',
        bio: otherUserProfile?.bio || 'No bio available',
        location: ownProfileData.location,
        memberSince: ownProfileData.memberSince,
        followingCount: ownProfileData.followingCount,
        isLoading: loadingOtherProfile,
        hasChanges: false,
        handleProfileImageChange: undefined,
        handleCoverImageChange: undefined,
        handleCoverImageUpdated: undefined,
        handleSaveChanges: undefined,
        isOwnProfile: false
      };
    }
  };

  const displayData = getDisplayData();
  const isLoading = (viewingOwnProfile ? ownProfileData.isLoading : loadingOtherProfile) || !currentUserId;

  return {
    displayData,
    profileUserId,
    viewingOwnProfile,
    isLoading
  };
};
