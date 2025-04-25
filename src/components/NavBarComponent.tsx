
import { Home, Search, User } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { UserMenu } from './UserMenu'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { SearchDialog } from '@/components/SearchDialog'
import { supabase } from '@/integrations/supabase/client'
import NotificationBell from './notifications/NotificationBell'
import { useAuth } from '@/contexts/AuthContext'

export function NavBarComponent() {
  const location = useLocation();
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
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
    // The root path "/" should have no active tab
    if (location.pathname === '/') {
      setActiveTab('');
      return;
    }
    
    // Set active tab based on path
    if (location.pathname.startsWith('/profile')) {
      setActiveTab('Profile');
    } else if (location.pathname === '/home' || location.pathname === '/feed') {
      setActiveTab('Home');
    } else if (location.pathname === '/explore') {
      setActiveTab('Explore');
    } else {
      // Default to no active tab for unmatched routes
      setActiveTab('');
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
      />
      <SearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} />
    </>
  )
}

export default NavBarComponent;
