
import { Home, Star, Search, User } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { UserMenu } from './UserMenu'
import { useLocation } from 'react-router-dom'
import { useState } from 'react'
import { SearchDialog } from './SearchDialog'

export function NavBarComponent() {
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Features', url: '#features', icon: Star },
    { name: 'Search', url: '#', icon: Search },
    { name: 'Profile', url: '/profile', icon: User }
  ];

  // Find the active tab based on the current location
  const activeTab = navItems.find(item => 
    item.url === location.pathname || 
    (location.pathname !== '/' && item.url.startsWith(location.pathname))
  )?.name || navItems[0].name;

  const handleNavItemClick = (name: string) => {
    if (name === 'Search') {
      setIsSearchOpen(true);
      return;
    }
  };

  return (
    <>
      <NavBar 
        items={navItems.map(item => ({
          ...item,
          onClick: () => handleNavItemClick(item.name)
        }))} 
        rightSection={<UserMenu />}
        initialActiveTab={activeTab}
      />
      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  )
}

export default NavBarComponent;
