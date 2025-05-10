
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import FoodTagSelector from '@/components/profile/reviews/FoodTagSelector';
import DateSelector from '@/components/profile/reviews/DateSelector';
import { Globe, Users, Lock } from 'lucide-react';

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
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {/* Everyone Option */}
          <div className={`
            flex flex-col space-y-1 p-3 rounded-lg 
            transition-all duration-200
            ${visibility === 'public' 
              ? 'bg-brand-orange/10 border-2 border-brand-orange' 
              : 'border border-muted hover:bg-brand-orange/5'}
          `}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="public" id="public" className="text-brand-orange" />
              <div className="flex items-center gap-1.5">
                <Globe size={16} className="text-muted-foreground" />
                <Label htmlFor="public" className="cursor-pointer font-medium">Everyone</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Your review will be visible to all users
            </p>
          </div>
          
          {/* My Circle Option */}
          <div className={`
            flex flex-col space-y-1 p-3 rounded-lg 
            transition-all duration-200
            ${visibility === 'circle_only' 
              ? 'bg-brand-orange/10 border-2 border-brand-orange' 
              : 'border border-muted hover:bg-brand-orange/5'}
          `}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="circle_only" id="circle" className="text-brand-orange" />
              <div className="flex items-center gap-1.5">
                <Users size={16} className="text-muted-foreground" />
                <Label htmlFor="circle" className="cursor-pointer font-medium">My Circle</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Only people in your circle can see this
            </p>
          </div>
          
          {/* Just Me Option */}
          <div className={`
            flex flex-col space-y-1 p-3 rounded-lg 
            transition-all duration-200
            ${visibility === 'private' 
              ? 'bg-brand-orange/10 border-2 border-brand-orange' 
              : 'border border-muted hover:bg-brand-orange/5'}
          `}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="private" id="private" className="text-brand-orange" />
              <div className="flex items-center gap-1.5">
                <Lock size={16} className="text-muted-foreground" />
                <Label htmlFor="private" className="cursor-pointer font-medium">Just Me</Label>
              </div>
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
