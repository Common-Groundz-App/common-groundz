
"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { LucideIcon, MoreHorizontal, Settings, Home, Star, Search, User, Bell, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { SearchDialog } from "@/components/SearchDialog";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer";
import { useProfile } from "@/hooks/use-profile-cache";

interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  onClick?: () => void;
  badge?: number;
}

interface VerticalNavBarProps {
  items?: NavItem[];
  className?: string;
  initialActiveTab?: string;
  logoSize?: "sm" | "md" | "lg";
}

export function VerticalTubelightNavbar({
  items: propItems,
  className,
  initialActiveTab,
  logoSize = "md"
}: VerticalNavBarProps) {
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { unreadCount } = useNotifications();

  const defaultNavItems: NavItem[] = [
    { name: 'Home', url: '/home', icon: Home },
    { name: 'Explore', url: '/explore', icon: Search },
    { name: 'My Stuff', url: '/my-stuff', icon: Package },
    { name: 'Profile', url: '/profile', icon: User },
    { 
      name: 'Notifications', 
      url: '#notifications', 
      icon: Bell,
      onClick: () => setShowNotifications(true),
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    { name: 'Settings', url: '/settings', icon: Settings }
  ];

  const items = propItems || defaultNavItems;

  const [activeTab, setActiveTab] = useState(initialActiveTab || items[0].name);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  
  // Use enhanced profile service
  const { data: profile, isLoading } = useProfile(user?.id);

  // Map routes to tab names - only real routes, not # URLs
  const getTabNameFromPath = (pathname: string): string | null => {
    const routeMap: Record<string, string> = {
      '/home': 'Home',
      '/feed': 'Home',
      '/explore': 'Explore',
      '/my-stuff': 'My Stuff',
      '/profile': 'Profile',
      '/settings': 'Settings'
    };
    return routeMap[pathname] || null;
  };

  // Sync active tab with route (preserves manual clicks for non-route items like Notifications)
  useEffect(() => {
    const tabFromPath = getTabNameFromPath(location.pathname);
    if (tabFromPath) {
      setActiveTab(tabFromPath);
    }
  }, [location.pathname]);

  const handleNavItemClick = (item: NavItem) => {
    setActiveTab(item.name);
    if (item.onClick) {
      item.onClick();
    }
  };

  const getInitials = () => {
    if (profile?.initials) {
      return profile.initials;
    }
    
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    
    return "U";
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account",
      });
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Error signing out",
        description: "There was a problem signing you out",
        variant: "destructive",
      });
    }
  };

  // Use enhanced profile data with fallbacks
  const displayName = profile?.displayName || user?.email?.split('@')[0] || 'User';
  const username = profile?.username || user?.email?.split('@')[0] || 'user';

  return (
    <>
      <div className={cn(
        "h-full w-16 xl:w-64 bg-background border-r flex flex-col",
        className
      )}>
        {/* Logo Section - Made sticky to stay visible on scroll */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 p-4 flex justify-center xl:justify-start flex-shrink-0">
          <Logo size={logoSize} />
        </div>

        {/* Navigation Items - Use flex-1 to take remaining space */}
        <div className="p-2 flex-1 flex flex-col min-h-0">
          <div className={cn(
            "w-full flex flex-col items-center xl:items-start gap-2 py-1 px-1 rounded-md"
          )}>
            {items.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <div 
                  key={item.name} 
                  onClick={() => handleNavItemClick(item)}
                  className={cn(
                    "relative cursor-pointer text-sm font-semibold w-full rounded-md transition-colors", 
                    "text-foreground/80 hover:text-primary"
                  )}
                >
                  {(item.url.startsWith('#') || item.onClick) ? (
                    <button 
                      className={cn(
                        "flex items-center w-full space-x-2 px-3 py-3 xl:py-2 rounded-md relative",
                        isActive && "bg-muted text-primary"
                      )}
                      onClick={item.onClick}
                    >
                      <Icon size={18} strokeWidth={2.5} />
                      <span className="hidden xl:inline">{item.name}</span>
                      {item.badge && (
                        <span className="absolute right-2 top-2 xl:relative xl:right-auto xl:top-auto xl:ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-medium text-white">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ) : (
                    <Link 
                      to={item.url} 
                      className={cn(
                        "flex items-center w-full space-x-2 px-3 py-3 xl:py-2 rounded-md",
                        isActive && "bg-muted text-primary"
                      )}
                    >
                      <Icon size={18} strokeWidth={2.5} />
                      <span className="hidden xl:inline">{item.name}</span>
                    </Link>
                  )}
                  {isActive && (
                    <motion.div 
                      layoutId="vertical-lamp" 
                      className="absolute inset-0 w-full bg-primary/10 rounded-md -z-10" 
                      initial={false} 
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30
                      }}
                    >
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-8 w-1 bg-brand-orange rounded-full">
                        <div className="absolute h-12 w-6 bg-brand-orange/20 rounded-full blur-md -left-2 -top-2" />
                        <div className="absolute h-8 w-6 bg-brand-orange/20 rounded-full blur-md -left-1" />
                        <div className="absolute h-4 w-4 bg-brand-orange/20 rounded-full blur-sm -left-0.5" />
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* User Menu - Fixed to bottom with flex-shrink-0 */}
        {user && (
          <div className="p-2 flex-shrink-0 mt-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center px-3 py-2 rounded-md hover:bg-accent transition-colors">
                  <div className="flex items-center w-full">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback>{getInitials()}</AvatarFallback>
                    </Avatar>
                    <div className="ml-3 flex-1 min-w-0 hidden xl:block text-left">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{username}</p>
                    </div>
                    <MoreHorizontal size={18} className="ml-auto text-muted-foreground hover:text-foreground hidden xl:block flex-shrink-0" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">View Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <SearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} />
      <NotificationDrawer open={showNotifications} onOpenChange={setShowNotifications} />
    </>
  );
}
