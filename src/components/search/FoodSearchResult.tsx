
import React from "react";
import { CommandItem } from "@/components/ui/command";
import { SearchResult, getIconForType } from "@/utils/searchUtils";

interface FoodSearchResultProps {
  food: SearchResult;
  onSelect: (result: SearchResult) => void;
}

export function FoodSearchResult({ food, onSelect }: FoodSearchResultProps) {
  return (
    <CommandItem
      key={food.id}
      onSelect={() => onSelect(food)}
      className="cursor-pointer"
    >
      <div className="flex items-center gap-2">
        {food.imageUrl ? (
          <img 
            src={food.imageUrl} 
            alt={food.title} 
            className="h-6 w-6 rounded object-cover"
          />
        ) : (
          getIconForType(food.type, food.title)
        )}
        <div className="flex flex-col">
          <span>{food.title}</span>
          {food.subtitle && (
            <span className="text-xs text-muted-foreground">{food.subtitle}</span>
          )}
        </div>
      </div>
    </CommandItem>
  );
}
