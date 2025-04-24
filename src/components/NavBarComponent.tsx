
import { Home, Search, User } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { UserMenu } from './UserMenu'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { SearchDialog } from '@/components/SearchDialog'
import { supabase } from '@/integrations/supabase/client'
import NotificationBell from './notifications/NotificationBell'
import { useAuth } from '@/contexts/AuthContext'

// Helper function to check if we're in a Router context
const useIsInRouterContext = () => {
  try {
    useLocation();
    return true;
  } catch (error) {
    return false;
  }
};

export function NavBarComponent() {
  const isInRouterContext = useIsInRouterContext();
  // Only use location if we're in a Router context
  const location = isInRouterContext ? useLocation() : { pathname: '/' };
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const { user } = useAuth();
  
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
    // Only update active tab if we're in a Router context
    if (isInRouterContext) {
      if (location.pathname === '/home') {
        setActiveTab('Home');
      } else if (location.pathname.startsWith('/profile')) {
        setActiveTab('Profile');
      } else if (location.pathname === '/explore') {
        setActiveTab('Explore');
      }
    }
  }, [location.pathname, isInRouterContext]);

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
      />
      <SearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} />
    </>
  )
}

export default NavBarComponent;
