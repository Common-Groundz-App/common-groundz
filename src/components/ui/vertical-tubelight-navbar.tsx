
"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { LucideIcon, MoreHorizontal, Settings, Home, Star, Search, User } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  onClick?: () => void;
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
  // Define default navigation items
  const defaultNavItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Feed', url: '/feed', icon: Star },
    { name: 'Search', url: '#', icon: Search, onClick: () => {
      const event = new CustomEvent('open-search-dialog');
      window.dispatchEvent(event);
    }},
    { name: 'Profile', url: '/profile', icon: User },
    { name: 'Settings', url: '/settings', icon: Settings }
  ];

  // Use provided items or default items
  const items = propItems || defaultNavItems;

  const [activeTab, setActiveTab] = useState(initialActiveTab || items[0].name);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState({
    fullName: "",
    username: "",
    avatarUrl: null as string | null
  });

  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

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

  const handleNavItemClick = (item: NavItem) => {
    setActiveTab(item.name);
    if (item.onClick) {
      item.onClick();
    }
  };

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

  return (
    <div className={cn(
      "h-full w-16 md:w-64 bg-background border-r flex flex-col",
      className
    )}>
      <div className="p-4 flex justify-center md:justify-start">
        <Logo size={logoSize} />
      </div>

      <div className="p-2 flex-grow flex flex-col">
        <div className={cn(
          "w-full flex flex-col items-center md:items-start gap-2 py-1 px-1 rounded-md"
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
                {item.url.startsWith('#') || item.onClick ? (
                  <button 
                    className={cn(
                      "flex items-center w-full space-x-2 px-3 py-3 md:py-2 rounded-md",
                      isActive && "bg-muted text-primary"
                    )}
                  >
                    <Icon size={18} strokeWidth={2.5} />
                    <span className="hidden md:inline">{item.name}</span>
                  </button>
                ) : (
                  <Link 
                    to={item.url} 
                    className={cn(
                      "flex items-center w-full space-x-2 px-3 py-3 md:py-2 rounded-md",
                      isActive && "bg-muted text-primary"
                    )}
                  >
                    <Icon size={18} strokeWidth={2.5} />
                    <span className="hidden md:inline">{item.name}</span>
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

      {user && (
        <div className="p-2 mt-auto mb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center px-3 py-2 rounded-md hover:bg-accent transition-colors">
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
  );
}
