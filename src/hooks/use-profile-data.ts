
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useProfileData = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [coverImage, setCoverImage] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [bio, setBio] = useState<string>('Food Enthusiast');
  const [location, setLocation] = useState<string>('');
  const [memberSince, setMemberSince] = useState<string>('');
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [tempCoverImage, setTempCoverImage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Default cover image with a nice pattern
  const defaultCoverImage = 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=1600&h=400&q=80';
  
  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Get profile data from profiles table
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }
        
        if (data) {
          console.log('Profile data loaded:', data);
          
          // Get user metadata from auth
          const userMetadata = user.user_metadata;
          const firstName = userMetadata?.first_name || '';
          const lastName = userMetadata?.last_name || '';
          
          // Set display name using first and last name if available
          let displayName = '';
          if (firstName || lastName) {
            displayName = `${firstName} ${lastName}`.trim();
            setUsername(displayName);
          } else if (data.username) {
            // Use username as display name if no first/last name
            setUsername(data.username);
          } else {
            // Fallback to email name if no username
            setUsername(user.email?.split('@')[0] || 'User');
          }
          
          // Set bio if available
          if (data.bio !== undefined && data.bio !== null) {
            setBio(data.bio);
          }
          
          // Set location from metadata or use default
          setLocation(userMetadata?.location || 'Add your location');
          
          // Format the created_at date for member since
          if (data.created_at) {
            const createdDate = new Date(data.created_at);
            setMemberSince(createdDate.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long'
            }));
          } else {
            setMemberSince('Recently joined');
          }
          
          // Set profile and cover images if available
          if (data.avatar_url) {
            // Add timestamp to force browser to reload the image
            setProfileImage(data.avatar_url + '?t=' + new Date().getTime());
          } else {
            setProfileImage(''); // Empty string to trigger initials avatar
          }
          
          if (data.cover_url) {
            // Add timestamp to force browser to reload the image
            setCoverImage(data.cover_url + '?t=' + new Date().getTime());
          } else {
            setCoverImage(defaultCoverImage);
          }
          
          // Fetch following count
          const { data: followingData, error: followingError } = await supabase
            .from('follows')
            .select('*', { count: 'exact' })
            .eq('follower_id', user.id);
            
          if (!followingError) {
            setFollowingCount(followingData?.length || 0);
          }
          
          // Fetch followers count
          const { data: followerData, error: followerError } = await supabase
            .from('follows')
            .select('*', { count: 'exact' })
            .eq('following_id', user.id);
            
          if (!followerError) {
            setFollowerCount(followerData?.length || 0);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user, defaultCoverImage]);

  // Check for changes that need to be saved
  useEffect(() => {
    setHasChanges(!!tempCoverImage);
  }, [tempCoverImage]);

  // Handler for profile image update
  const handleProfileImageChange = (url: string) => {
    setProfileImage(url);
  };

  // Handler for cover image update
  const handleCoverImageChange = (url: string) => {
    setCoverImage(url);
  };

  // Handler for temporary cover image (before saving)
  const handleCoverImageUpdated = (url: string | null) => {
    console.log("Setting tempCoverImage to:", url);
    setTempCoverImage(url);
    setHasChanges(true);
  };

  // Save all profile changes
  const handleSaveChanges = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Prepare update object
      const updates: any = {};
      
      // Add cover image if it was changed
      if (tempCoverImage) {
        updates.cover_url = tempCoverImage;
      }
      
      // Only update if we have changes
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);
        
        if (error) {
          throw error;
        }
        
        // Clear temporary state
        setTempCoverImage(null);
        
        // Reset changes flag
        setHasChanges(false);
        
        // Notify user
        toast({
          title: 'Profile updated',
          description: 'Your profile has been successfully updated.'
        });
        
        // Refresh the UserMenu
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'There was a problem updating your profile',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
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
  };
};
