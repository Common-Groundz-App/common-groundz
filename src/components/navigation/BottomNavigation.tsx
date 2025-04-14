
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, User, Star, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const BottomNavigation = () => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Feed', path: '/feed', icon: Star },
    { name: 'Add', path: '#add', icon: PlusCircle, primary: true },
    { name: 'Search', path: '/explore', icon: Search },
    { name: 'Profile', path: '/profile', icon: User }
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t md:hidden z-40">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          (item.path === '/profile' && location.pathname.startsWith('/profile')) ||
                          (item.path === '/explore' && location.pathname.startsWith('/explore'));
          
          if (item.path.startsWith('#')) {
            let onClick;
            
            if (item.path === '#add') {
              onClick = () => {
                // Open recommendation form
                const event = new CustomEvent('open-recommendation-form');
                window.dispatchEvent(event);
              };
            }
            
            return (
              <button
                key={item.name}
                onClick={onClick}
                className={cn(
                  "flex flex-col items-center justify-center w-1/5 h-full",
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
