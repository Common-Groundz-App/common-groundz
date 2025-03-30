
import { Home, Star, Heart, User } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import Logo from './Logo'
import { UserMenu } from './UserMenu'
import { useLocation } from 'react-router-dom'

export function NavBarComponent() {
  const location = useLocation();
  
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Discover', url: '#discover', icon: Star },
    { name: 'Profile', url: '/profile', icon: User }
  ]

  return (
    <NavBar 
      items={navItems} 
      rightSection={<UserMenu />}
      activeTab={location.pathname === '/profile' ? 'Profile' : 'Home'}
    />
  )
}

export default NavBarComponent;
