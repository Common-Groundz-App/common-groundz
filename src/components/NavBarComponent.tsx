
import { Home, Star, Search, User } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { UserMenu } from './UserMenu'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { SearchDialog } from '@/components/SearchDialog'

export function NavBarComponent() {
  const location = useLocation();
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Features', url: '#features', icon: Star },
    { name: 'Search', url: '#', icon: Search, onClick: () => setShowSearchDialog(true) },
    { name: 'Profile', url: '/profile', icon: User }
  ];

  // Update the active tab based on the current URL path
  useEffect(() => {
    if (location.pathname === '/') {
      setActiveTab('Home');
    } else if (location.pathname.startsWith('/profile')) {
      setActiveTab('Profile');
    } else if (location.pathname.includes('features')) {
      setActiveTab('Features');
    }
  }, [location.pathname]);

  return (
    <>
      <NavBar 
        items={navItems} 
        rightSection={<UserMenu />}
        initialActiveTab={activeTab}
      />
      <SearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} />
    </>
  )
}

export default NavBarComponent;
