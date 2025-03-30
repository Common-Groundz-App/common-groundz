
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NavBarComponent from '@/components/NavBarComponent';
import ProfileContent from '@/components/profile/ProfileContent';
import Footer from '@/components/Footer';

const Profile = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <NavBarComponent />
      <main className="container mx-auto px-4 py-24">
        <ProfileContent user={user} />
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
