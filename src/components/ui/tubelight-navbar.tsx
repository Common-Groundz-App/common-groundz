
"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Link, useLocation } from "react-router-dom"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
  demoMode?: boolean
}

export function TubelightNavBar({ items, className, demoMode = false }: NavBarProps) {
  const [activeTab, setActiveTab] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  
  // Use location only if not in demo mode
  const location = !demoMode ? useLocation() : null;

  useEffect(() => {
    // Set active tab based on current route (if not in demo mode)
    if (!demoMode && location) {
      const currentPath = location.pathname;
      const activeItem = items.find(item => 
        item.url === currentPath || 
        (item.url === '/' && currentPath === '')
      );
      
      if (activeItem) {
        setActiveTab(activeItem.name);
      } else {
        // Default to first item if no match found
        setActiveTab(items[0].name);
      }
    } else if (demoMode) {
      // In demo mode, just set the first item as active
      setActiveTab(items[0].name);
    }
  }, [location, items, demoMode]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Render different link components based on mode
  const NavLink = ({ item, isActive }: { item: NavItem, isActive: boolean }) => {
    const Icon = item.icon;
    const linkContent = (
      <>
        <span className="hidden sm:inline">{item.name}</span>
        <span className="sm:hidden">
          <Icon size={20} strokeWidth={2.5} />
        </span>
        {isActive && (
          <motion.div
            layoutId="lamp"
            className="absolute inset-0 w-full bg-primary/10 rounded-full -z-10"
            initial={false}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
          >
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full">
              <div className="absolute w-12 h-6 bg-primary/30 rounded-full blur-md -top-2 -left-2" />
              <div className="absolute w-8 h-6 bg-primary/30 rounded-full blur-md -top-1" />
              <div className="absolute w-4 h-4 bg-primary/30 rounded-full blur-sm top-0 left-2" />
            </div>
          </motion.div>
        )}
      </>
    );

    // Use regular button in demo mode
    if (demoMode) {
      return (
        <button
          onClick={() => setActiveTab(item.name)}
          className={cn(
            "relative cursor-pointer text-sm font-semibold px-4 py-2 rounded-full transition-colors",
            "text-foreground/80 hover:text-primary",
            isActive && "text-primary",
          )}
        >
          {linkContent}
        </button>
      );
    }

    // Use React Router Link in normal mode
    return (
      <Link
        to={item.url}
        onClick={() => setActiveTab(item.name)}
        className={cn(
          "relative cursor-pointer text-sm font-semibold px-4 py-2 rounded-full transition-colors",
          "text-foreground/80 hover:text-primary",
          isActive && "text-primary",
        )}
      >
        {linkContent}
      </Link>
    );
  };

  return (
    <div
      className={cn(
        "z-50 w-[90%] max-w-md mx-auto",
        className,
      )}
    >
      <div className="flex items-center justify-center gap-1 bg-background/90 border border-border backdrop-blur-lg py-1 px-1 rounded-full shadow-lg">
        {items.map((item) => {
          const isActive = activeTab === item.name;
          return (
            <NavLink 
              key={item.name} 
              item={item} 
              isActive={isActive} 
            />
          );
        })}
      </div>
    </div>
  );
}
