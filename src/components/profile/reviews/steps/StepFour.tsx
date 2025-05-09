
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import FoodTagSelector from '@/components/profile/reviews/FoodTagSelector';
import DateSelector from '@/components/profile/reviews/DateSelector';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

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
  return (
    <TooltipProvider>
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
        <div className="space-y-2">
          <Label className="flex items-center gap-2 font-medium">
            <span className="text-lg">👁️</span>
            <span>Who can see this review?</span>
          </Label>
          <RadioGroup
            value={visibility}
            onValueChange={onVisibilityChange}
            className="grid grid-cols-3 gap-2"
          >
            <div className="flex flex-col items-center space-y-1.5 border border-brand-orange/30 p-3 rounded-lg hover:bg-brand-orange/5 transition-colors">
              <RadioGroupItem value="public" id="public" className="text-brand-orange" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="public" className="cursor-pointer text-xs font-normal flex items-center gap-1">
                    Everyone
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Your review will be visible to all users of the platform</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-col items-center space-y-1.5 border border-brand-orange/30 p-3 rounded-lg hover:bg-brand-orange/5 transition-colors">
              <RadioGroupItem value="circle_only" id="circle" className="text-brand-orange" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="circle" className="cursor-pointer text-xs font-normal flex items-center gap-1">
                    My Circle
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Only people who follow you or you follow can see this review</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-col items-center space-y-1.5 border border-brand-orange/30 p-3 rounded-lg hover:bg-brand-orange/5 transition-colors">
              <RadioGroupItem value="private" id="private" className="text-brand-orange" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="private" className="cursor-pointer text-xs font-normal flex items-center gap-1">
                    Just Me
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Only you can see this private review</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </RadioGroup>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default StepFour;
