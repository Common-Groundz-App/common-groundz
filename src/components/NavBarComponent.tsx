
import * as React from 'react';
import { Home, Search, User } from 'lucide-react';
import { NavBar } from "@/components/ui/tubelight-navbar";
import { UserMenu } from './UserMenu';
import { useLocation } from 'react-router-dom';
import { SearchDialog } from '@/components/SearchDialog';
import { supabase } from '@/integrations/supabase/client';
import NotificationBell from './notifications/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';

export function NavBarComponent() {
  const location = useLocation();
  const [showSearchDialog, setShowSearchDialog] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Home');
  const { user } = useAuth();
  
  // Different navigation items based on authentication state
  const authenticatedNavItems = [
    { name: 'Home', url: '/home', icon: Home },
    { name: 'Explore', url: '/explore', icon: Search },
    { name: 'Profile', url: '/profile', icon: User }
  ];

  const unauthenticatedNavItems = [
    { name: 'Login', url: '/auth', icon: User },
    { name: 'Sign Up', url: '/auth?tab=signup', icon: User }
  ];

  const navItems = user ? authenticatedNavItems : unauthenticatedNavItems;

  React.useEffect(() => {
    const handleOpenSearch = () => {
      setShowSearchDialog(true);
    };
    
    window.addEventListener('open-search-dialog', handleOpenSearch);
    return () => {
      window.removeEventListener('open-search-dialog', handleOpenSearch);
    };
  }, []);
  
  React.useEffect(() => {
    if (location.pathname === '/') {
      setActiveTab('Home');
    } else if (location.pathname.startsWith('/profile')) {
      setActiveTab('Profile');
    } else if (location.pathname === '/home' || location.pathname === '/feed') {
      setActiveTab('Home');
    } else if (location.pathname === '/explore') {
      setActiveTab('Explore');
    }
  }, [location.pathname]);

  return (
    <>
      <NavBar 
        items={navItems} 
        rightSection={
          <div className="flex items-center gap-2">
            {user && <NotificationBell />}
            <UserMenu />
          </div>
        }
        initialActiveTab={activeTab}
        className="relative z-50 sticky top-0"
        isAuthenticated={!!user}
      />
      <SearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} />
    </>
  );
}

export default NavBarComponent;
