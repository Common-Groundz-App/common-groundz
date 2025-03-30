
import { Home, Star, Heart, User } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import Logo from './Logo'
import { UserMenu } from './UserMenu'

export function NavBarComponent() {
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Features', url: '#features', icon: Star },
    { name: 'Testimonials', url: '#testimonials', icon: Heart },
    { name: 'About', url: '#about', icon: User }
  ]

  return (
    <NavBar 
      items={navItems} 
      rightSection={<UserMenu />}
    />
  )
}

export default NavBarComponent;
