
import { Home, Star, Search, User } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { UserMenu } from './UserMenu'
import { useLocation } from 'react-router-dom'
import { useState } from 'react'
import { SearchDialog } from '@/components/SearchDialog'

export function NavBarComponent() {
  const location = useLocation();
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Features', url: '#features', icon: Star },
    { name: 'Search', url: '#', icon: Search, onClick: () => setShowSearchDialog(true) },
    { name: 'Profile', url: '/profile', icon: User }
  ];

  // Find the active tab based on the current location
  const activeTab = navItems.find(item => 
    item.url === location.pathname || 
    (location.pathname !== '/' && item.url.startsWith(location.pathname))
  )?.name || navItems[0].name;

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
