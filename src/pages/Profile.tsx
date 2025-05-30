
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Home, Search, User } from 'lucide-react';
import { NavBar } from "@/components/ui/tubelight-navbar";
import { UserMenu } from '@/components/UserMenu';
import NotificationBell from '@/components/notifications/NotificationBell';
import { SearchDialog } from '@/components/SearchDialog';
import ProfileContent from '@/components/profile/ProfileContent';
import Footer from '@/components/Footer';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';

const Profile = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'posts';
  const location = useLocation();
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [navActiveTab, setNavActiveTab] = useState('Profile');
  
  const navItems = [
    { name: 'Home', url: '/home', icon: Home },
    { name: 'Explore', url: '/explore', icon: Search },
    { name: 'Profile', url: '/profile', icon: User }
  ];

  useEffect(() => {
    const handleOpenSearch = () => {
      setShowSearchDialog(true);
    };
    
    window.addEventListener('open-search-dialog', handleOpenSearch);
    return () => {
      window.removeEventListener('open-search-dialog', handleOpenSearch);
    };
  }, []);
  
  useEffect(() => {
    if (location.pathname.startsWith('/profile')) {
      setNavActiveTab('Profile');
    } else if (location.pathname === '/home' || location.pathname === '/feed') {
      setNavActiveTab('Home');
    } else if (location.pathname === '/explore') {
      setNavActiveTab('Explore');
    }
  }, [location.pathname]);
  
  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Custom Top Navigation - Hide below sm (640px) */}
      <div className="hidden sm:block">
        <NavBar 
          items={navItems} 
          rightSection={
            <div className="flex items-center gap-2">
              {user && <NotificationBell />}
              <UserMenu />
            </div>
          }
          initialActiveTab={navActiveTab}
          className="relative z-50 sticky top-0"
        />
      </div>
      
      <div className="flex-1">
        <ProfileContent profileUserId={id} defaultActiveTab={activeTab} />
      </div>
      <Footer />
      
      {/* Mobile Bottom Navigation - Show below lg (1024px) */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>

      <SearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} />
    </div>
  );
};

export default Profile;
