
"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface TubelightTabsProps {
  defaultValue: string;
  className?: string;
  items: {
    value: string;
    label: string;
    icon?: LucideIcon;
  }[];
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}

export function TubelightTabs({
  defaultValue,
  className,
  items,
  onValueChange,
  children
}: TubelightTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  useEffect(() => {
    if (defaultValue) {
      setActiveTab(defaultValue);
    }
  }, [defaultValue]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (onValueChange) {
      onValueChange(value);
    }
  };

  return (
    <RadixTabs.Root value={activeTab} onValueChange={handleTabChange} className="px-0 py-[96px]">
      <div className="flex justify-center mb-6">
        <RadixTabs.List className={cn(
          "flex items-center gap-2 py-1 px-1 rounded-full shadow-lg",
          "bg-background/30 border border-white/10 backdrop-blur-md"
        )}>
          {items.map(item => {
            const isActive = activeTab === item.value;
            const Icon = item.icon;
            
            return (
              <RadixTabs.Trigger 
                key={item.value} 
                value={item.value} 
                className={cn(
                  "relative cursor-pointer text-sm font-semibold rounded-full transition-colors",
                  "text-foreground/80 hover:text-primary flex items-center justify-center",
                  "px-6 py-2",
                  isActive && "text-primary"
                )}
              >
                {Icon && (
                  <span className="md:hidden">
                    <Icon size={18} strokeWidth={2.5} />
                  </span>
                )}
                <span className="hidden md:inline">{item.label}</span>
                
                {isActive && (
                  <motion.div 
                    layoutId="tube-tab" 
                    className="absolute inset-0 w-full bg-primary/10 rounded-full -z-10" 
                    initial={false} 
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30
                    }}
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-orange rounded-t-full">
                      <div className="absolute w-12 h-6 bg-brand-orange/20 rounded-full blur-md -top-2 -left-2" />
                      <div className="absolute w-8 h-6 bg-brand-orange/20 rounded-full blur-md -top-1" />
                      <div className="absolute w-4 h-4 bg-brand-orange/20 rounded-full blur-sm top-0 left-2" />
                    </div>
                  </motion.div>
                )}
              </RadixTabs.Trigger>
            );
          })}
        </RadixTabs.List>
      </div>
      
      {children}
    </RadixTabs.Root>
  );
}

export const TabsContent = RadixTabs.Content;
