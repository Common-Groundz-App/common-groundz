
"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";

interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  onClick?: () => void;
}

interface VerticalNavBarProps {
  items: NavItem[];
  className?: string;
  initialActiveTab?: string;
  logoSize?: "sm" | "md" | "lg";
}

export function VerticalTubelightNavbar({
  items,
  className,
  initialActiveTab,
  logoSize = "md"
}: VerticalNavBarProps) {
  const [activeTab, setActiveTab] = useState(initialActiveTab || items[0].name);

  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

  const handleNavItemClick = (item: NavItem) => {
    setActiveTab(item.name);
    if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <div className={cn(
      "h-full w-16 md:w-64 bg-background border-r flex flex-col",
      className
    )}>
      {/* Logo Section */}
      <div className="p-4 flex justify-center md:justify-start">
        <Logo size={logoSize} />
      </div>

      {/* Navigation Items */}
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

      {/* Add recommendation button at bottom */}
      <div className="p-2 mb-4">
        <button
          onClick={() => {
            // Open recommendation form
            const event = new CustomEvent('open-recommendation-form');
            window.dispatchEvent(event);
          }}
          className={cn(
            "flex items-center w-full space-x-2 px-3 py-2 rounded-md transition-colors",
            "text-brand-orange hover:bg-brand-orange/10"
          )}
        >
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <span className="hidden md:inline">Add Recommendation</span>
        </button>
      </div>
    </div>
  );
}
