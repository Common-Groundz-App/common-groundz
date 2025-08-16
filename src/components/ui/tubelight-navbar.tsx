"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { LucideIcon, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";

interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  onClick?: () => void;
}
interface NavBarProps {
  items: NavItem[];
  className?: string;
  rightSection?: React.ReactNode;
  initialActiveTab?: string;
  hideHamburgerMenu?: boolean;
  hideLogo?: boolean;
}
export function NavBar({
  items,
  className,
  rightSection,
  initialActiveTab,
  hideHamburgerMenu = false,
  hideLogo = false
}: NavBarProps) {
  const [activeTab, setActiveTab] = useState(initialActiveTab || items[0].name);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isSmallMobile = useIsMobile(650);
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTab(initialActiveTab || items[0].name);
  }, [initialActiveTab, items]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleNavItemClick = (item: NavItem) => {
    setActiveTab(item.name);
    
    // Check if user is authenticated for protected routes
    const protectedRoutes = ['/explore', '/profile', '/home'];
    const isProtectedRoute = protectedRoutes.includes(item.url);
    
    if (isProtectedRoute && !user) {
      // Redirect unauthenticated users to auth page
      navigate('/auth');
      return;
    }
    
    if (item.onClick) {
      item.onClick();
    } else if (!item.url.startsWith('#')) {
      navigate(item.url);
    }
  };

  return <div className={cn(
    "fixed top-0 left-0 right-0 z-50 py-4 px-4 transition-all duration-300", 
    scrolled ? "bg-background/90 backdrop-blur-md shadow-sm" : "bg-transparent", 
    className
  )}>
      <div className={cn(
        "max-w-7xl mx-auto flex items-center",
        hideLogo ? "justify-center" : "justify-between"
      )}>
        {/* Logo Section - conditionally rendered */}
        {!hideLogo && (
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <div className="p-2 rounded-md flex items-center justify-center bg-transparent">
                <Logo size="md" />
              </div>
            </Link>
          </div>
        )}

        {/* Navigation Items - Centered */}
        {!isSmallMobile ? <div className={cn(
          "flex items-center",
          hideLogo ? "" : "flex-grow justify-center"
        )}>
            <div className={cn(
              "flex items-center gap-2 py-1 px-1 rounded-full shadow-lg transition-all duration-300",
              scrolled ? "bg-background/5 border border-border backdrop-blur-lg" : "bg-background/30 border border-white/10 backdrop-blur-md"
            )}>
              {items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.name;
                return <div 
                    key={item.name} 
                    onClick={() => handleNavItemClick(item)} 
                    className={cn("relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors", 
                      "text-foreground/80 hover:text-primary", 
                      isActive && "bg-muted text-primary")}
                    >
                      <button className="flex items-center space-x-2">
                        <span className="hidden md:inline">{item.name}</span>
                        <span className="md:hidden">
                          <Icon size={18} strokeWidth={2.5} />
                        </span>
                      </button>
                      {isActive && <motion.div layoutId="lamp" className="absolute inset-0 w-full bg-primary/10 rounded-full -z-10" initial={false} transition={{
                type: "spring",
                stiffness: 300,
                damping: 30
              }}>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-orange rounded-t-full">
                      <div className="absolute w-12 h-6 bg-brand-orange/20 rounded-full blur-md -top-2 -left-2" />
                      <div className="absolute w-8 h-6 bg-brand-orange/20 rounded-full blur-md -top-1" />
                      <div className="absolute w-4 h-4 bg-brand-orange/20 rounded-full blur-sm top-0 left-2" />
                    </div>
                  </motion.div>}
                </div>;
              })}
            </div>
          </div> : !hideHamburgerMenu && <div className="flex-grow flex justify-end">
            <Sheet>
              <SheetTrigger asChild>
                <button className={cn(
                  "p-2 rounded-md transition-colors",
                  scrolled ? "hover:bg-gray-100 dark:hover:bg-gray-800" : "hover:bg-white/10"
                )}>
                  <Menu size={24} className="text-foreground" />
                </button>
              </SheetTrigger>
              <SheetContent className="w-[250px] sm:w-[300px]">
                <div className="py-6">
                  <div className="mb-6">
                    <Logo size="lg" />
                  </div>
                  
                  {user ? (
                    // Logged-in user: Show navigation items
                    <nav className="flex flex-col space-y-4">
                      {items.map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.name;
                        return <div 
                          key={item.name} 
                          onClick={() => handleNavItemClick(item)}
                          className={cn("flex items-center space-x-2 px-3 py-2 rounded-md transition-colors cursor-pointer", 
                            isActive ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground/80 hover:text-primary")}
                        >
                          <Icon size={20} strokeWidth={2} />
                          <span>{item.name}</span>
                        </div>;
                      })}
                    </nav>
                  ) : (
                    // Logged-out user: Show auth buttons
                    <div className="flex flex-col space-y-4">
                      <div className="text-center mb-6">
                        <h3 className="text-lg font-semibold text-foreground mb-2">Welcome!</h3>
                        <p className="text-sm text-muted-foreground">Join our community to explore, share, and discover amazing recommendations.</p>
                      </div>
                      
                      <Button asChild className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white">
                        <Link to="/auth">Sign Up</Link>
                      </Button>
                      
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/auth">Log In</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>}
        
        {/* Right section for user menu - positioned absolutely when logo is hidden */}
        {!isSmallMobile && !hideLogo && <div className="flex-shrink-0 w-[150px] flex justify-end">
          {rightSection}
        </div>}
        
        {/* Right section positioned absolutely when logo is hidden */}
        {!isSmallMobile && hideLogo && rightSection && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {rightSection}
          </div>
        )}
      </div>
    </div>;
}
