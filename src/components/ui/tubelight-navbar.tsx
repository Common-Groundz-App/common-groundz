"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { LucideIcon, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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
}
export function NavBar({
  items,
  className,
  rightSection,
  initialActiveTab
}: NavBarProps) {
  const [activeTab, setActiveTab] = useState(initialActiveTab || items[0].name);
  const [scrolled, setScrolled] = useState(false);
  const isMobile = useIsMobile();
  const isSmallMobile = useIsMobile(650);

  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

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
    if (item.onClick) {
      item.onClick();
    }
  };

  return <div className={cn(
    "fixed top-0 left-0 right-0 z-50 py-4 px-4 transition-all duration-300", 
    scrolled ? "bg-background/90 backdrop-blur-md shadow-sm" : "bg-transparent", 
    className
  )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo Section */}
        <div className="flex-shrink-0">
          <Link to="/" className="flex items-center">
            <div className="p-2 rounded-md flex items-center justify-center bg-transparent">
              <Logo size="md" />
            </div>
          </Link>
        </div>

        {/* Navigation Items - Centered for Desktop */}
        {!isSmallMobile ? <div className="flex-grow flex justify-center">
            <div className={cn(
              "flex items-center gap-2 py-1 px-1 rounded-full shadow-lg transition-all duration-300",
              scrolled ? "bg-background/5 border border-border backdrop-blur-lg" : "bg-background/30 border border-white/10 backdrop-blur-md"
            )}>
              {items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.name;
                return <div key={item.name} 
                    onClick={() => handleNavItemClick(item)} 
                    className={cn("relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors", 
                      "text-foreground/80 hover:text-primary", 
                      isActive && "bg-muted text-primary")}
                    >
                      {item.url.startsWith('#') || item.onClick ? (
                        <button className="flex items-center space-x-2">
                          <span className="hidden md:inline">{item.name}</span>
                          <span className="md:hidden">
                            <Icon size={18} strokeWidth={2.5} />
                          </span>
                        </button>
                      ) : (
                        <Link to={item.url} className="flex items-center space-x-2">
                          <span className="hidden md:inline">{item.name}</span>
                          <span className="md:hidden">
                            <Icon size={18} strokeWidth={2.5} />
                          </span>
                        </Link>
                      )}
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
          </div> : <div className="flex-grow flex justify-end">
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
                </div>
              </SheetContent>
            </Sheet>
          </div>}
        
        {/* Right section for user menu */}
        {!isSmallMobile && <div className="flex-shrink-0 w-[150px] flex justify-end">
          {rightSection}
        </div>}
      </div>
    </div>;
}
