
import * as React from 'react';
import { Home, Search, User } from 'lucide-react';
import { NavBar } from "@/components/ui/tubelight-navbar";
import { UserMenu } from './UserMenu';
import { useLocation } from 'react-router-dom';
import { SearchDialog } from '@/components/SearchDialog';
import { useAuth } from '@/contexts/AuthContext';

export function NavBarComponent() {
  const renderCount = React.useRef(0);
  renderCount.current++;
  
  const location = useLocation();
  const [showSearchDialog, setShowSearchDialog] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Home');

  console.log(`🧭 [NavBarComponent] Render #${renderCount.current} on ${location.pathname}`);

  // Get auth context safely
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch (error) {
    console.warn('⚠️ [NavBarComponent] Auth context not ready, using defaults');
  }

  // Memoize the navigation items to prevent unnecessary re-renders
  const navItems = React.useMemo(() => [
    { name: 'Home', url: '/home', icon: Home },
    { name: 'Explore', url: '/explore', icon: Search },
    { name: 'Profile', url: '/profile', icon: User }
  ], []);

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

  // Check if we're on the Profile page
  const isProfilePage = location.pathname.startsWith('/profile');

  // Memoize the right section to prevent unnecessary re-renders
  const rightSection = React.useMemo(() => (
    <div className="flex items-center gap-2">
      <UserMenu />
    </div>
  ), []);

  return (
    <>
      <NavBar 
        items={navItems} 
        rightSection={rightSection}
        initialActiveTab={activeTab}
        className="relative z-50 sticky top-0"
        hideHamburgerMenu={isProfilePage}
      />
      <SearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} />
    </>
  );
}

export default NavBarComponent;
