
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import ProfileContent from '@/components/profile/ProfileContent';
import Footer from '@/components/Footer';

const Profile = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  
  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1">
        <ProfileContent />
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
