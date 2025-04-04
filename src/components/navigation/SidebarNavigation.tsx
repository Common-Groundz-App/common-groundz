
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Home, 
  Search, 
  User, 
  Star, 
  PlusCircle,
  Settings,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';

export const SidebarNavigation = () => {
  const location = useLocation();
  const { user } = useAuth();
  
  const getInitials = (username?: string) => {
    return username ? username.substring(0, 2).toUpperCase() : 'UN';
  };
  
  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Feed', path: '/feed', icon: Star },
    { name: 'Search', path: '#', icon: Search, onClick: () => {
      // Open the search dialog
      const event = new CustomEvent('open-search-dialog');
      window.dispatchEvent(event);
    }},
    { name: 'Profile', path: '/profile', icon: User }
  ];

  return (
    <div className="h-screen w-16 md:w-64 fixed left-0 top-0 pt-16 bg-background border-r hidden md:flex flex-col">
      <div className="p-4 flex-1">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
                            (item.path === '/profile' && location.pathname.startsWith('/profile'));
            
            return (
              <Tooltip key={item.name} delayDuration={300}>
                <TooltipTrigger asChild>
                  {item.path.startsWith('#') ? (
                    <button
                      onClick={item.onClick}
                      className={cn(
                        "flex items-center w-full p-3 rounded-md text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-accent text-accent-foreground" 
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5 md:mr-2" />
                      <span className="hidden md:inline">{item.name}</span>
                    </button>
                  ) : (
                    <Link
                      to={item.path}
                      className={cn(
                        "flex items-center p-3 rounded-md text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-accent text-accent-foreground" 
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5 md:mr-2" />
                      <span className="hidden md:inline">{item.name}</span>
                    </Link>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right" className="md:hidden">
                  {item.name}
                </TooltipContent>
              </Tooltip>
            );
          })}
          
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Link
                to="/profile"
                className={cn(
                  "flex items-center p-3 rounded-md text-sm font-medium transition-colors mt-6",
                  "text-brand-orange hover:bg-brand-orange/10"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  // Open recommendation form
                  const event = new CustomEvent('open-recommendation-form');
                  window.dispatchEvent(event);
                }}
              >
                <PlusCircle className="h-5 w-5 md:mr-2" />
                <span className="hidden md:inline">Add Recommendation</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:hidden">
              Add Recommendation
            </TooltipContent>
          </Tooltip>
        </nav>
      </div>
      
      {user && (
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <Link to="/profile" className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback>{getInitials(user.user_metadata?.username)}</AvatarFallback>
              </Avatar>
              <div className="hidden md:block flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.user_metadata?.username || 'User'}
                </p>
              </div>
            </Link>
            
            <div className="flex items-center gap-1">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Link
                    to="/settings"
                    className="p-2 rounded-full hover:bg-accent text-muted-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="md:hidden">
                  Settings
                </TooltipContent>
              </Tooltip>
              
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      // Sign out
                      supabase.auth.signOut();
                    }}
                    className="p-2 rounded-full hover:bg-accent text-muted-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="md:hidden">
                  Sign out
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
