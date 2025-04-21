
import React, { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewFoodTagsProps {
  foodTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

const ReviewFoodTags = ({ foodTags, onAddTag, onRemoveTag }: ReviewFoodTagsProps) => {
  const [newFoodTag, setNewFoodTag] = useState('');
  
  const commonFoodTags = [
    "Spicy", "Sweet", "Savory", "Vegetarian", "Vegan", "Gluten-Free", 
    "Dairy-Free", "Non-Veg", "Dessert", "Breakfast", "Lunch", "Dinner", 
    "Appetizer", "Main Course", "Large Portion", "Value for Money"
  ];
  
  const addFoodTag = () => {
    if (newFoodTag.trim() && !foodTags.includes(newFoodTag.trim())) {
      onAddTag(newFoodTag.trim());
      setNewFoodTag('');
    }
  };

  return (
    <div className="space-y-2">
      <Label>Add Tags</Label>
      <div className="flex flex-wrap gap-2 mb-2">
        {foodTags.map((tag) => (
          <Badge 
            key={tag} 
            variant="secondary"
            className="flex items-center gap-1 bg-brand-orange/20"
          >
            {tag}
            <button 
              type="button"
              className="ml-1 hover:text-red-500 focus:outline-none"
              onClick={() => onRemoveTag(tag)}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      
      <div className="flex gap-2">
        <Input
          value={newFoodTag}
          onChange={(e) => setNewFoodTag(e.target.value)}
          placeholder="Add a tag (e.g., Spicy, Vegan)"
          className="border-brand-orange/30 focus:ring-brand-orange/30"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addFoodTag();
            }
          }}
        />
        <Button 
          type="button" 
          onClick={addFoodTag}
          variant="outline"
          className="border-brand-orange/30 hover:bg-brand-orange/10"
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      
      <div className="mt-2">
        <p className="text-sm font-medium mb-1">Common tags:</p>
        <div className="flex flex-wrap gap-1">
          {commonFoodTags.map((tag) => (
            <Badge 
              key={tag}
              variant="outline" 
              className={cn(
                "cursor-pointer hover:bg-brand-orange/10 transition-colors",
                foodTags.includes(tag) ? "bg-brand-orange/20" : ""
              )}
              onClick={() => onAddTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReviewFoodTags;
