import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProfileCard from './ProfileCard';
import ProfileCoverImage from './ProfileCoverImage';
import ProfileTabs from './ProfileTabs';
import { useProfileData } from '@/hooks/use-profile-data';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchUserProfile, fetchFollowerCount, fetchFollowingCount } from '@/services/profileService';

const ProfileContent = () => {
  const { user } = useAuth();
  const { userId } = useParams(); // Get userId from URL if available
  const [viewingOwnProfile, setViewingOwnProfile] = useState<boolean>(true);
  const [profileUserId, setProfileUserId] = useState<string>('');
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [loadingOtherProfile, setLoadingOtherProfile] = useState<boolean>(false);
  const [otherUserFollowing, setOtherUserFollowing] = useState<number>(0);
  const [otherUserFollowers, setOtherUserFollowers] = useState<number>(0);

  // Use the hook to get current user's profile data
  const {
    isLoading,
    coverImage,
    profileImage,
    username,
    bio,
    location,
    memberSince,
    followingCount,
    followerCount,
    hasChanges,
    handleProfileImageChange,
    handleCoverImageChange,
    handleCoverImageUpdated,
    handleSaveChanges
  } = useProfileData();

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

  // Get display data based on whether viewing own or other profile
  const getDisplayData = () => {
    if (viewingOwnProfile) {
      return {
        coverImage,
        profileImage,
        username,
        bio,
        location,
        memberSince,
        followingCount,
        followerCount,
        isLoading,
      };
    } else {
      return {
        coverImage: otherUserProfile?.cover_url || '',
        profileImage: otherUserProfile?.avatar_url || '',
        username: otherUserProfile?.username || 'User',
        bio: otherUserProfile?.bio || 'No bio available',
        location: otherUserProfile?.location || '',
        memberSince,
        followingCount: otherUserFollowing,
        followerCount: otherUserFollowers,
        isLoading: loadingOtherProfile,
      };
    }
  };

  const displayData = getDisplayData();

  // Show loading state while determining profile
  if ((!user || isLoading) && !otherUserProfile) {
    return (
      <div className="w-full bg-background pt-16 md:pt-20">
        <div className="w-full h-48 md:h-64 bg-gray-200 animate-pulse"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-24">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full flex justify-center md:justify-start md:w-[300px] flex-shrink-0">
              <Card className="w-full max-w-[300px] md:w-full p-6">
                <div className="flex flex-col items-center">
                  <Skeleton className="w-24 h-24 md:w-32 md:h-32 rounded-full mb-4" />
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-4 w-32 mb-4" />
                  <Skeleton className="h-10 w-full mb-6" />
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </Card>
            </div>
            <div className="flex-1 flex flex-col w-full">
              <div className="h-24 md:h-32"></div>
              <div className="bg-background pb-1 mb-2 border-b mt-4 md:mt-0">
                <div className="flex space-x-4">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-background pt-16 md:pt-20">
      {/* Cover Image */}
      <ProfileCoverImage 
        coverImage={displayData.coverImage} 
        isLoading={displayData.isLoading} 
        onCoverImageChange={viewingOwnProfile ? handleCoverImageChange : undefined} 
        onCoverImageUpdated={viewingOwnProfile ? handleCoverImageUpdated : undefined} 
        isEditable={viewingOwnProfile}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-24">
        {/* Flex container for profile card and content */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Profile Card - center on mobile, fixed width on desktop */}
          <div className="w-full flex justify-center md:justify-start md:w-[300px] flex-shrink-0">
            <div className="w-full max-w-[300px] md:w-full">
              <ProfileCard 
                username={displayData.username} 
                bio={displayData.bio} 
                location={displayData.location} 
                memberSince={displayData.memberSince} 
                followingCount={displayData.followingCount} 
                followerCount={displayData.followerCount} 
                profileImage={displayData.profileImage} 
                isLoading={displayData.isLoading} 
                onProfileImageChange={viewingOwnProfile ? handleProfileImageChange : undefined} 
                hasChanges={viewingOwnProfile ? hasChanges : false} 
                onSaveChanges={viewingOwnProfile ? handleSaveChanges : undefined} 
                isOwnProfile={viewingOwnProfile}
                profileUserId={profileUserId}
                otherUserProfile={!viewingOwnProfile ? otherUserProfile : null}
              />
            </div>
          </div>
          
          {/* Content Column - takes remaining space */}
          <div className="flex-1 flex flex-col w-full py-0 px-[16px]">
            <ProfileTabs profileUserId={profileUserId} isOwnProfile={viewingOwnProfile} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContent;
