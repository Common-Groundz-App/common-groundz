import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, User, PlusCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { isExploreRelatedRoute } from '@/utils/navigation';
import { useCanonicalProfileUrl } from '@/hooks/useCanonicalProfileUrl';
import { NotificationBadge } from '@/components/notifications/NotificationBadge';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  onClick?: () => void;
  primary?: boolean;
  badge?: number;
}

export const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profileUrl } = useCanonicalProfileUrl();
  
  const navItems: NavItem[] = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Explore', path: '/explore', icon: Search },
    { 
      name: 'Create', 
      path: '#create', 
      icon: PlusCircle, 
      primary: true, 
      onClick: () => {
        navigate('/create');
      }
    },
    { name: 'My Stuff', path: '/my-stuff', icon: Package },
    { name: 'Profile', path: profileUrl, icon: User }
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t xl:hidden z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isProfileItem = item.name === 'Profile';
          const isActive = location.pathname === item.path || 
                          (isProfileItem && (location.pathname.startsWith('/profile') || location.pathname.startsWith('/u/'))) ||
                          (item.path === '/explore' && isExploreRelatedRoute(location.pathname)) ||
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
                  <NotificationBadge count={item.badge} variant="overlay" />
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
