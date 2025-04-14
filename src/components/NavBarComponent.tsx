
import { Home, Star, User, Search } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { UserMenu } from './UserMenu'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

export function NavBarComponent() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('Home');
  
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Feed', url: '/feed', icon: Star },
    { name: 'Search', url: '/explore', icon: Search },
    { name: 'Profile', url: '/profile', icon: User }
  ];

  // Update the active tab based on the current URL path
  useEffect(() => {
    if (location.pathname === '/') {
      setActiveTab('Home');
    } else if (location.pathname.startsWith('/profile')) {
      setActiveTab('Profile');
    } else if (location.pathname === '/feed') {
      setActiveTab('Feed');
    } else if (location.pathname === '/explore') {
      setActiveTab('Search');
    }
  }, [location.pathname]);

  return (
    <NavBar 
      items={navItems} 
      rightSection={<UserMenu />}
      initialActiveTab={activeTab}
    />
  )
}

export default NavBarComponent;
