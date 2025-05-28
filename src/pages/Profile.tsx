
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import ProfileContent from '@/components/profile/ProfileContent';
import Footer from '@/components/Footer';

const Profile = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'posts';
  
  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1">
        <ProfileContent profileUserId={id} defaultActiveTab={activeTab} />
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
