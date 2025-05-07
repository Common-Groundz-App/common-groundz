
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { cn } from "@/lib/utils";

interface FoodTagSelectorProps {
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

const FoodTagSelector = ({ selectedTags, onAddTag, onRemoveTag }: FoodTagSelectorProps) => {
  const [newTag, setNewTag] = useState('');

  const commonFoodTags = [
    { name: "Spicy", emoji: "🌶️" },
    { name: "Sweet", emoji: "🍬" },
    { name: "Savory", emoji: "🧂" },
    { name: "Vegetarian", emoji: "🥗" },
    { name: "Vegan", emoji: "🌱" },
    { name: "Gluten-Free", emoji: "🌾" },
    { name: "Dairy-Free", emoji: "🥛" },
    { name: "Non-Veg", emoji: "🍗" },
    { name: "Dessert", emoji: "🍰" },
    { name: "Breakfast", emoji: "🍳" },
    { name: "Lunch", emoji: "🥪" },
    { name: "Dinner", emoji: "🍽️" },
    { name: "Value for Money", emoji: "💰" },
  ];

  const handleAddTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      onAddTag(newTag.trim());
      setNewTag('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.length > 0 && (
          <div className="w-full mb-1">
            <p className="text-sm text-muted-foreground mb-2">Selected tags:</p>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <Badge 
                  key={tag}
                  variant="secondary"
                  className="bg-brand-orange/10 hover:bg-brand-orange/20 text-foreground px-3 py-1 rounded-full flex items-center gap-1"
                >
                  {tag}
                  <span 
                    className="ml-1 cursor-pointer rounded-full hover:bg-accent/50 w-4 h-4 inline-flex items-center justify-center"
                    onClick={() => onRemoveTag(tag)}
                  >
                    ×
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        <p className="text-sm text-muted-foreground w-full mt-2">Common tags:</p>
        {commonFoodTags.map((tag) => (
          <Badge 
            key={tag.name}
            variant="outline" 
            className={cn(
              "cursor-pointer transition-colors py-1.5 px-3",
              selectedTags.includes(tag.name) 
                ? "bg-brand-orange/20 border-brand-orange/40" 
                : "hover:bg-accent/50"
            )}
            onClick={() => selectedTags.includes(tag.name) ? onRemoveTag(tag.name) : onAddTag(tag.name)}
          >
            <span className="mr-1">{tag.emoji}</span>
            {tag.name}
          </Badge>
        ))}
      </div>
      
      <div className="flex gap-2">
        <Input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Add a custom tag"
          className="border-brand-orange/30 focus-visible:ring-brand-orange/30"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddTag();
            }
          }}
        />
        <Button 
          type="button" 
          onClick={handleAddTag}
          variant="outline"
          className="border-brand-orange/30 hover:bg-brand-orange/10"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default FoodTagSelector;
