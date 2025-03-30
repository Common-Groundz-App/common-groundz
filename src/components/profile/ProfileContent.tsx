
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProfileCoverImage from './ProfileCoverImage';
import ProfileCard from './ProfileCard';
import ProfileTabs from './ProfileTabs';

const ProfileContent = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [coverImage, setCoverImage] = useState<string>('/lovable-uploads/972742c1-8d73-43ee-9508-7a56b2bc2573.png');
  const [profileImage, setProfileImage] = useState<string>('https://images.unsplash.com/photo-1472396961693-142e6e269027');
  const [username, setUsername] = useState<string>('');
  const [bio, setBio] = useState<string>('Food Enthusiast');
  const [location, setLocation] = useState<string>('New York, NY');
  const [memberSince, setMemberSince] = useState<string>('January 2021');
  const [followingCount, setFollowingCount] = useState<number>(120);
  const [tempCoverImage, setTempCoverImage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
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
          
          // Set username if available
          if (data.username) {
            setUsername(data.username);
          } else {
            // Fallback to email name if no username
            setUsername(user.email?.split('@')[0] || 'User');
          }
          
          // Set bio if available
          if (data.bio !== undefined && data.bio !== null) {
            setBio(data.bio);
          }
          
          // Set profile and cover images if available
          if (data.avatar_url) {
            // Add timestamp to force browser to reload the image
            setProfileImage(data.avatar_url + '?t=' + new Date().getTime());
          }
          
          if (data.cover_url) {
            // Add timestamp to force browser to reload the image
            setCoverImage(data.cover_url + '?t=' + new Date().getTime());
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user]);

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

  return (
    <div className="w-full bg-background pt-16 md:pt-20">
      {/* Cover Photo Section */}
      <ProfileCoverImage 
        coverImage={coverImage} 
        isLoading={isLoading} 
        onCoverImageChange={handleCoverImageChange}
        onCoverImageUpdated={handleCoverImageUpdated}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-24">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Card */}
          <ProfileCard 
            username={username}
            bio={bio}
            location={location}
            memberSince={memberSince}
            followingCount={followingCount}
            profileImage={profileImage}
            isLoading={isLoading}
            onProfileImageChange={handleProfileImageChange}
          />
          
          {/* Content Area */}
          <div className="flex-1">
            <ProfileTabs />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContent;
