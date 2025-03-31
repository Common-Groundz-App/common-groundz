
import { Home, Star, Heart, User } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { UserMenu } from './UserMenu'
import { useLocation } from 'react-router-dom'

export function NavBarComponent() {
  const location = useLocation();
  
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Features', url: '#features', icon: Star },
    { name: 'Testimonials', url: '#testimonials', icon: Heart },
    { name: 'Profile', url: '/profile', icon: User }
  ];

  // Find the active tab based on the current location
  const activeTab = navItems.find(item => 
    item.url === location.pathname || 
    (location.pathname !== '/' && item.url.startsWith(location.pathname))
  )?.name || navItems[0].name;

  return (
    <NavBar 
      items={navItems} 
      rightSection={<UserMenu />}
      initialActiveTab={activeTab}
    />
  )
}

export default NavBarComponent;
