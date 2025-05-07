
import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from "@/lib/utils";

interface CategorySelectorProps {
  selected: string;
  onChange: (category: string) => void;
}

const CategorySelector = ({ selected, onChange }: CategorySelectorProps) => {
  const categories = [
    { value: 'food', emoji: '🍽️', label: 'Food' },
    { value: 'movie', emoji: '🎬', label: 'Movie' },
    { value: 'book', emoji: '📚', label: 'Book' },
    { value: 'place', emoji: '📍', label: 'Place' },
    { value: 'product', emoji: '🛍️', label: 'Product' }
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {categories.map((category) => (
        <Button
          key={category.value}
          type="button"
          variant={selected === category.value ? "default" : "outline"}
          className={cn(
            "flex flex-col items-center justify-center h-20 gap-1 p-2 transition-all duration-200",
            selected === category.value 
              ? "bg-gradient-to-r from-brand-orange to-brand-orange/90 text-white scale-105 shadow-md" 
              : "hover:bg-accent/40 hover:scale-105",
          )}
          onClick={() => onChange(category.value)}
        >
          <span className="text-lg">{category.emoji}</span>
          <span className="capitalize text-xs">{category.label}</span>
        </Button>
      ))}
    </div>
  );
};

export default CategorySelector;
