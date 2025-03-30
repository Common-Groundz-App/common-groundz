
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
    <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo Section */}
        <div className="flex-shrink-0">
          <img 
            src="/lovable-uploads/87c43c69-609c-4783-9425-7a25bb42926e.png" 
            alt="Common Groundz Logo" 
            className="h-10" 
          />
        </div>
        
        {/* Navigation Items */}
        <div className="flex justify-center space-x-8">
          {navItems.map(item => (
            <NavItem 
              key={item.name}
              name={item.name} 
              url={item.url} 
              isActive={activeTab === item.name} 
            />
          ))}
        </div>
        
        {/* User Menu */}
        <div className="flex-shrink-0">
          <UserMenu />
        </div>
      </div>
      <div className="h-1 bg-brand-orange w-full"></div>
    </div>
  );
}

// NavItem component for consistent styling
function NavItem({ name, url, isActive }: { name: string; url: string; isActive: boolean }) {
  return (
    <a 
      href={url} 
      className="relative py-5 px-2 text-sm font-medium transition-colors"
    >
      <span className={`${isActive ? 'text-brand-orange' : 'text-gray-700 hover:text-gray-900'}`}>
        {name}
      </span>
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-1 bg-brand-orange"></span>
      )}
    </a>
  );
}

export default NavBarComponent;
