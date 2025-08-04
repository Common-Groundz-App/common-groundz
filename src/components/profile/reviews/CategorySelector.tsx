
import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";
import { InfoTooltip } from '@/components/ui/info-tooltip';

interface CategorySelectorProps {
  selected: string;
  onChange: (category: string) => void;
  disableSelection?: boolean;
}

const CategorySelector = ({ selected, onChange, disableSelection = false }: CategorySelectorProps) => {
  const categories = [
    { value: 'food', emoji: '🍽️', label: 'Food' },
    { value: 'movie', emoji: '🎬', label: 'Movie' },
    { value: 'book', emoji: '📚', label: 'Book' },
    { value: 'place', emoji: '📍', label: 'Place' },
    { value: 'product', emoji: '🛍️', label: 'Product' }
  ];

  // Handler for when a category button is clicked
  const handleCategoryClick = (categoryValue: string) => {
    // If selection is disabled, only allow clicking the already selected category
    if (disableSelection && categoryValue !== selected) {
      return; // Do nothing when clicking disabled categories
    }
    onChange(categoryValue);
  };

  return (
    <div className="grid grid-cols-5 gap-2">
      {categories.map((category) => {
        const isActive = selected === category.value;
        const isDisabled = disableSelection && !isActive;
        
        const button = (
          <Button
            key={category.value}
            type="button"
            variant={isActive ? "default" : "outline"}
            className={cn(
              "flex flex-col items-center justify-center h-20 gap-1 p-2 transition-all duration-200",
              isActive 
                ? "bg-gradient-to-r from-brand-orange to-brand-orange/90 text-white scale-105 shadow-md" 
                : "hover:bg-accent/40 hover:border-brand-orange/50 hover:scale-105",
              "border-2",
              isActive ? "border-brand-orange" : "border-transparent",
              // Add disabled styling
              isDisabled && "opacity-50 cursor-not-allowed hover:scale-100 hover:bg-transparent"
            )}
            onClick={() => handleCategoryClick(category.value)}
            disabled={isDisabled}
          >
            <span className="text-lg">{category.emoji}</span>
            <span className="capitalize text-xs">{category.label}</span>
          </Button>
        );
        
        // Wrap in tooltip if disabled
        if (isDisabled) {
          return (
            <div key={category.value} className="relative">
              <InfoTooltip content="Category selection is locked to match the entity type" side="top" />
              {button}
            </div>
          );
        }
        
        return button;
      })}
    </div>
  );
};

export default CategorySelector;
