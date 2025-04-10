
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import ProfileContent from '@/components/profile/ProfileContent';
import Footer from '@/components/Footer';
import { fetchUserProfile } from '@/services/profileService';

const Profile = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // If no userId is provided, show the current user's profile
  const viewingUserId = userId || user?.id;
  const isOwnProfile = !userId || (user && userId === user.id);

  useEffect(() => {
    const loadProfileData = async () => {
      if (!viewingUserId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await fetchUserProfile(viewingUserId);
        setProfileData(data);
      } catch (err) {
        console.error('Error loading profile data:', err);
        setError('Failed to load profile. The user may not exist or you may not have permission to view it.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfileData();
  }, [viewingUserId]);

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1 pt-2 md:pt-0">
        <ProfileContent 
          userId={viewingUserId} 
          isOwnProfile={isOwnProfile}
          profileData={profileData}
          isLoading={isLoading}
          error={error}
        />
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
