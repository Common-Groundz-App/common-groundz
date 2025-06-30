
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useSearchParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import ProfileContent from '@/components/profile/ProfileContent';
import Footer from '@/components/Footer';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';

const Profile = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'posts';

  // Use the ID from params if provided, otherwise use current user's ID
  const profileUserId = id || user?.id;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1">
        <ProfileContent profileUserId={profileUserId} defaultActiveTab={activeTab} />
      </div>
      <Footer />
      
      {/* Mobile Bottom Navigation - Only show on mobile screens */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default Profile;
