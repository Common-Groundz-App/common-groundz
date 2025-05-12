
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import FoodTagSelector from '@/components/profile/reviews/FoodTagSelector';
import DateSelector from '@/components/profile/reviews/DateSelector';

interface StepFourProps {
  category: string;
  title: string;
  onTitleChange: (value: string) => void;
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
  title,
  onTitleChange,
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
    <div className="w-full space-y-8 py-2">
      <h2 className="text-xl font-medium text-center">
        Additional details (optional)
      </h2>
      
      {/* Title Field - NEW */}
      <div className="space-y-2">
        <Label htmlFor="review-title" className="flex items-center gap-2 font-medium">
          <span className="text-lg">✏️</span>
          <span>Review Title</span>
        </Label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Give your review a catchy title"
          className="border-brand-orange/30 focus-visible:ring-brand-orange/30 text-lg font-medium transition-all duration-200"
        />
        <p className="text-xs text-muted-foreground">
          A good title helps others quickly understand your review
        </p>
      </div>
      
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
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {/* Everyone Option */}
          <div className="flex flex-col space-y-2 border border-brand-orange/30 p-4 rounded-lg hover:bg-brand-orange/5 transition-colors">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="public" id="public" className="text-brand-orange" />
              <Label htmlFor="public" className="cursor-pointer font-medium">Everyone</Label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Your review will be visible to all users of the platform
            </p>
          </div>
          
          {/* My Circle Option */}
          <div className="flex flex-col space-y-2 border border-brand-orange/30 p-4 rounded-lg hover:bg-brand-orange/5 transition-colors">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="circle_only" id="circle" className="text-brand-orange" />
              <Label htmlFor="circle" className="cursor-pointer font-medium">My Circle</Label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Only people who follow you or you follow can see this review
            </p>
          </div>
          
          {/* Just Me Option */}
          <div className="flex flex-col space-y-2 border border-brand-orange/30 p-4 rounded-lg hover:bg-brand-orange/5 transition-colors">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="private" id="private" className="text-brand-orange" />
              <Label htmlFor="private" className="cursor-pointer font-medium">Just Me</Label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Only you can see this private review
            </p>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};

export default StepFour;
