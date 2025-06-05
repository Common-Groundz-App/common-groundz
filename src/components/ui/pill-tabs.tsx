
import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PillTabsProps {
  items: {
    value: string;
    label: string;
    emoji: string;
  }[];
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function PillTabs({ items, activeTab, onTabChange }: PillTabsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-4">
      {items.map((item) => (
        <Button
          key={item.value}
          variant={activeTab === item.value ? "default" : "outline"}
          className={cn(
            "rounded-full h-auto py-2 px-4 text-sm font-medium",
            activeTab === item.value 
              ? "bg-brand-orange text-white hover:bg-brand-orange/90" 
              : "bg-muted text-foreground hover:bg-muted/80"
          )}
          onClick={() => onTabChange(item.value)}
        >
          <span className="mr-1">{item.emoji}</span>
          {item.label}
        </Button>
      ))}
    </div>
  );
}
