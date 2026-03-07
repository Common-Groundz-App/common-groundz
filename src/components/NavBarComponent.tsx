
import * as React from 'react';
import { Home, Search, User } from 'lucide-react';
import { NavBar } from "@/components/ui/tubelight-navbar";
import { UserMenu } from './UserMenu';
import { NotificationBell } from './notifications/NotificationBell';
import { useLocation } from 'react-router-dom';
import { SearchDialog } from '@/components/SearchDialog';
import { useAuth } from '@/contexts/AuthContext';
import { isExploreRelatedRoute } from '@/utils/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getProfileUrl } from '@/utils/getProfileUrl';

export function NavBarComponent() {
  const location = useLocation();
  const [showSearchDialog, setShowSearchDialog] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('Home');
  const { user, isLoading } = useAuth();

  const { data: username } = useQuery({
    queryKey: ['profile-username', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      return data?.username || null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // HOIST: Compute values that are needed in both loading and loaded states
  const isAdminPage = location.pathname === '/admin';
  const isProfilePage = location.pathname.startsWith('/profile') || location.pathname.startsWith('/u/');
  
  // HOIST: Memoize navigation items with dynamic profile URL
  const navItems = React.useMemo(() => [
    { name: 'Home', url: '/home', icon: Home },
    { name: 'Explore', url: '/explore', icon: Search },
    { name: 'Profile', url: getProfileUrl(username), icon: User }
  ], [username]);

  // HOIST: Memoize right section (depends on user and isProfilePage, both available)
  const rightSection = React.useMemo(() => (
    <div className="flex items-center gap-2">
      {user && isProfilePage && <NotificationBell />}
      <UserMenu />
    </div>
  ), [user, isProfilePage]);

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
    } else if (location.pathname.startsWith('/profile') || location.pathname.startsWith('/u/')) {
      setActiveTab('Profile');
    } else if (location.pathname === '/home' || location.pathname === '/feed') {
      setActiveTab('Home');
    } else if (isExploreRelatedRoute(location.pathname)) {
      setActiveTab('Explore');
    }
  }, [location.pathname]);

  // Don't render complex nav logic until auth is ready
  if (isLoading) {
    return (
      <NavBar 
        items={navItems} 
        rightSection={rightSection}
        initialActiveTab={activeTab}
        className="relative z-50 sticky top-0"
        hideHamburgerMenu={isProfilePage}
        hideLogo={isAdminPage}
      />
    );
  }

  return (
    <>
      <NavBar 
        items={navItems} 
        rightSection={rightSection}
        initialActiveTab={activeTab}
        className="relative z-50 sticky top-0"
        hideHamburgerMenu={isProfilePage}
        hideLogo={isAdminPage}
      />
      <SearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} />
    </>
  );
}

export default NavBarComponent;
