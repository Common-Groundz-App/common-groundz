import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Home, 
  Search, 
  User, 
  Settings,
  LogOut,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export const SidebarNavigation = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [profileData, setProfileData] = useState({
    fullName: "",
    username: "",
    avatarUrl: null as string | null
  });
  
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;
      
      try {
        const userMetadata = user.user_metadata;
        const firstName = userMetadata?.first_name || '';
        const lastName = userMetadata?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        
        const { data, error } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        setProfileData({
          fullName: fullName || (data?.username || user.email?.split('@')[0] || 'User'),
          username: data?.username || user.email?.split('@')[0] || 'user',
          avatarUrl: data?.avatar_url
        });
      } catch (error) {
        console.error("Error fetching profile data:", error);
      }
    };
    
    fetchProfileData();
  }, [user]);
  
  const getInitials = () => {
    if (profileData.fullName) {
      const words = profileData.fullName.trim().split(' ');
      if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
      }
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    
    return "U";
  };
  
  const navItems = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Explore', path: '/explore', icon: Search },
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Settings', path: '/settings', icon: Settings }
  ];

  return (
    <div className="h-screen w-16 md:w-64 fixed left-0 top-0 pt-16 bg-background border-r hidden md:flex flex-col">
      <div className="p-4 flex-1">
        <TooltipProvider>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                              (item.path === '/profile' && location.pathname.startsWith('/profile')) ||
                              (item.path === '/explore' && location.pathname.startsWith('/explore')) ||
                              (item.path === '/home' && (location.pathname === '/home' || location.pathname === '/feed'));
              
              return (
                <Tooltip key={item.name} delayDuration={300}>
                  <TooltipTrigger asChild>
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
                  </TooltipTrigger>
                  <TooltipContent side="right" className="md:hidden">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </TooltipProvider>
      </div>
      
      {user && (
        <div className="p-4 mt-auto mb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center w-full p-2 rounded-md hover:bg-accent transition-colors">
                <div className="flex items-center w-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profileData.avatarUrl || ""} />
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="ml-3 flex-1 min-w-0 hidden md:block text-left">
                    <p className="text-sm font-medium truncate">{profileData.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{profileData.username}</p>
                  </div>
                  <MoreHorizontal size={18} className="ml-auto text-muted-foreground hover:text-foreground hidden md:block" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">View Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => signOut()} 
                className="cursor-pointer"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};
