
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
  
  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
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
          // Set username if available
          if (data.username) {
            setUsername(data.username);
          } else {
            // Fallback to email name if no username
            setUsername(user.email?.split('@')[0] || 'User');
          }
          
          // Set bio if available
          if (data.bio) {
            setBio(data.bio);
          }
          
          // Set profile and cover images if available
          if (data.avatar_url) {
            setProfileImage(data.avatar_url);
          }
          
          if (data.cover_url) {
            setCoverImage(data.cover_url);
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

  return (
    <div className="w-full bg-background pt-16 md:pt-20">
      {/* Cover Photo Section */}
      <ProfileCoverImage 
        coverImage={coverImage} 
        isLoading={isLoading} 
        onCoverImageChange={setCoverImage}
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
            onProfileImageChange={setProfileImage}
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
