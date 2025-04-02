
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, fetchFollowerCount, fetchFollowingCount } from '@/services/profileService';

export const useProfilePageState = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  const [viewingOwnProfile, setViewingOwnProfile] = useState<boolean>(true);
  const [profileUserId, setProfileUserId] = useState<string>('');
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [loadingOtherProfile, setLoadingOtherProfile] = useState<boolean>(false);
  const [otherUserFollowing, setOtherUserFollowing] = useState<number>(0);
  const [otherUserFollowers, setOtherUserFollowers] = useState<number>(0);

  // Determine if we're viewing own profile or someone else's
  useEffect(() => {
    if (!user) return;
    
    if (userId && userId !== user.id) {
      setViewingOwnProfile(false);
      setProfileUserId(userId);
      
      // Fetch the other user's profile
      const fetchOtherUserProfile = async () => {
        setLoadingOtherProfile(true);
        try {
          // Get profile data
          const profileData = await fetchUserProfile(userId);
          setOtherUserProfile(profileData);
          
          // Get follower and following counts
          const followingData = await fetchFollowingCount(userId);
          const followerData = await fetchFollowerCount(userId);
          
          setOtherUserFollowing(followingData);
          setOtherUserFollowers(followerData);
          
        } catch (error) {
          console.error('Error fetching profile:', error);
        } finally {
          setLoadingOtherProfile(false);
        }
      };
      
      fetchOtherUserProfile();
    } else {
      setViewingOwnProfile(true);
      setProfileUserId(user.id);
    }
  }, [user, userId]);

  // Listen for follow status changes to update counts in real-time
  useEffect(() => {
    const handleFollowStatusChange = async (event: CustomEvent) => {
      const { follower, following, action } = event.detail;
      
      console.log("Follow status changed:", { follower, following, action });
      console.log("Current profile userId:", profileUserId);
      console.log("Current user:", user?.id);
      
      // If the current profile is being followed/unfollowed
      if (profileUserId === following) {
        console.log("Updating follower count for profile:", profileUserId);
        // Refetch the current profile's follower count to ensure accuracy
        const updatedFollowerCount = await fetchFollowerCount(profileUserId);
        
        if (viewingOwnProfile) {
          // Update own profile follower count via the useProfileData hook's event
          window.dispatchEvent(new CustomEvent('profile-follower-count-changed', { 
            detail: { count: updatedFollowerCount } 
          }));
        } else {
          // Update other user's follower count directly
          console.log("Setting other user followers to:", updatedFollowerCount);
          setOtherUserFollowers(updatedFollowerCount);
        }
      }
      
      // If we're viewing the profile of the user who followed/unfollowed someone
      if (profileUserId === follower) {
        console.log("Updating following count for user:", follower);
        // Refetch following count for accuracy
        const updatedFollowingCount = await fetchFollowingCount(follower);
        
        if (viewingOwnProfile) {
          // Update own profile following count via the useProfileData hook's event
          window.dispatchEvent(new CustomEvent('profile-following-count-changed', { 
            detail: { count: updatedFollowingCount } 
          }));
        } else {
          // Update other user's following count directly
          setOtherUserFollowing(updatedFollowingCount);
        }
      }
    };

    // Add event listener
    window.addEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    };
  }, [profileUserId, viewingOwnProfile, user?.id]);

  return {
    viewingOwnProfile,
    profileUserId,
    otherUserProfile,
    loadingOtherProfile,
    otherUserFollowing,
    otherUserFollowers
  };
};
