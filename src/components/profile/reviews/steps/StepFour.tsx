
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import FoodTagSelector from '@/components/profile/reviews/FoodTagSelector';
import DateSelector from '@/components/profile/reviews/DateSelector';
import { Eye } from 'lucide-react';

interface StepFourProps {
  category: string;
  description: string;
  onDescriptionChange: (value: string) => void;
  experienceDate: Date | undefined;
  onExperienceDateChange: (date: Date) => void;
  visibility: "public" | "circle_only" | "private";
  onVisibilityChange: (value: "public" | "circle_only" | "private") => void;
  foodTags: string[];
  onAddFoodTag: (tag: string) => void;
  onRemoveFoodTag: (tag: string) => void;
}

const StepFour = ({
  category,
  description,
  onDescriptionChange,
  experienceDate,
  onExperienceDateChange,
  visibility,
  onVisibilityChange,
  foodTags,
  onAddFoodTag,
  onRemoveFoodTag
}: StepFourProps) => {
  // Get visibility info based on selected option
  const getVisibilityInfo = () => {
    switch (visibility) {
      case "public":
        return "Your review will be visible to all users of the platform";
      case "circle_only":
        return "Only people who follow you or you follow can see this review";
      case "private":
        return "Only you can see this private review";
      default:
        return "";
    }
  };
  
  return (
    <div className="w-full space-y-8 py-2">
      <h2 className="text-xl font-medium text-center">
        Additional details (optional)
      </h2>
      
      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="flex items-center gap-2 font-medium">
          <span className="text-lg">💬</span>
          <span>Your thoughts</span>
        </Label>
        <Textarea 
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Tell us what you liked or didn't like..."
          rows={5}
          className="border-brand-orange/30 focus-visible:ring-brand-orange/30 resize-none transition-all duration-200"
        />
      </div>
      
      {/* Experience Date */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 font-medium">
          <span className="text-lg">📅</span>
          <span>When did you experience this?</span>
        </Label>
        <DateSelector 
          value={experienceDate}
          onChange={onExperienceDateChange}
        />
      </div>
      
      {/* Food tags (only for food category) */}
      {category === 'food' && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 font-medium">
            <span className="text-lg">🏷️</span>
            <span>Food tags</span>
          </Label>
          <FoodTagSelector
            selectedTags={foodTags}
            onAddTag={onAddFoodTag}
            onRemoveTag={onRemoveFoodTag}
          />
        </div>
      )}
      
      {/* Visibility */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 font-medium">
          <Eye className="text-muted-foreground" />
          <span>Who can see this review?</span>
        </Label>
        
        <RadioGroup
          value={visibility}
          onValueChange={onVisibilityChange}
          className="flex flex-row space-x-4 sm:space-x-8"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="public" id="public" className="text-brand-orange" />
            <Label htmlFor="public" className="cursor-pointer font-medium">Everyone</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="circle_only" id="circle" className="text-brand-orange" />
            <Label htmlFor="circle" className="cursor-pointer font-medium">My Circle</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="private" id="private" className="text-brand-orange" />
            <Label htmlFor="private" className="cursor-pointer font-medium">Just Me</Label>
          </div>
        </RadioGroup>
        
        {/* Info panel that shows only the selected option's explanation */}
        <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
          {getVisibilityInfo()}
        </div>
      </div>
    </div>
  );
};

export default StepFour;
