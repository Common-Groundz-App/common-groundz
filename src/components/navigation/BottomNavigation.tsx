
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, User, PlusCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  onClick?: () => void;
  primary?: boolean;
}

export const BottomNavigation = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  const navItems: NavItem[] = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Explore', path: '/explore', icon: Search },
    { 
      name: 'Create', 
      path: '#create', 
      icon: PlusCircle, 
      primary: true, 
      onClick: () => {
        // Open the smart composer with the default post type
        const event = new CustomEvent('open-create-post-dialog', {
          detail: { contentType: 'post' }
        });
        window.dispatchEvent(event);
      }
    },
    { name: 'Circle Picks', path: '/circle-picks', icon: Users },
    { name: 'Profile', path: '/profile', icon: User }
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t md:hidden z-40">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          (item.path === '/profile' && location.pathname.startsWith('/profile')) ||
                          (item.path === '/explore' && location.pathname.startsWith('/explore')) ||
                          (item.path === '/circle-picks' && location.pathname.startsWith('/circle-picks')) ||
                          (item.path === '/home' && (location.pathname === '/home' || location.pathname === '/feed'));
          
          if (item.path.startsWith('#')) {
            return (
              <button
                key={item.name}
                onClick={item.onClick}
                className={cn(
                  "flex flex-col items-center justify-center w-1/5 h-full relative",
                  item.primary 
                    ? "text-brand-orange" 
                    : isActive 
                      ? "text-foreground" 
                      : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  item.primary && "bg-brand-orange/10 p-2 rounded-full"
                )}>
                  <item.icon className={cn(
                    "h-5 w-5 mb-1",
                    item.primary && "text-brand-orange"
                  )} />
                </div>
                <span className="text-xs">{item.name}</span>
              </button>
            );
          }
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-1/5 h-full",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-xs">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
