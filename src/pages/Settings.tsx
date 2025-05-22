import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import PreferencesSection from '@/components/settings/PreferencesSection';

const Settings = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1 container mx-auto py-8 px-4 md:px-6">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        
        <div className="max-w-4xl space-y-8">
          {/* Add this new section */}
          <PreferencesSection />
          
          {/* Keep any existing settings sections */}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Settings;
