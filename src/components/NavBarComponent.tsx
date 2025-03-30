
import { Home, Star, User, Search } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { UserMenu } from './UserMenu'
import { useLocation } from 'react-router-dom'
import { CommandDialog } from "@/components/ui/command"
import { useEffect, useState } from 'react'
import { SearchDialogContent } from './SearchDialogContent'

export function NavBarComponent() {
  const location = useLocation();
  const [open, setOpen] = useState(false)
  
  // Close the command dialog when escape key is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])
  
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Features', url: '#features', icon: Star },
    { name: 'Search', url: '#search', icon: Search },
    { name: 'Profile', url: '/profile', icon: User }
  ];

  // Improved active tab detection that works with dynamic routes
  const getActiveTab = () => {
    const path = location.pathname;
    
    // Handle exact matches first
    const exactMatch = navItems.find(item => item.url === path);
    if (exactMatch) return exactMatch.name;
    
    // Handle profile routes
    if (path.startsWith('/profile')) {
      return 'Profile';
    }
    
    // Default to Home if no match
    return 'Home';
  };

  const activeTab = getActiveTab();

  const handleSearchClick = () => {
    setOpen(true);
  };

  // Handle click on search icon specifically
  const handleNavItemClick = (name: string) => {
    if (name === 'Search') {
      setOpen(true);
      return false; // Prevent navigation
    }
    return true; // Allow navigation for other items
  };

  return (
    <>
      <NavBar 
        items={navItems} 
        rightSection={<UserMenu />}
        initialActiveTab={activeTab}
        onItemClick={handleNavItemClick}
      />
      <CommandDialog open={open} onOpenChange={setOpen}>
        <SearchDialogContent setOpen={setOpen} />
      </CommandDialog>
    </>
  )
}

export default NavBarComponent;
