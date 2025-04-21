
import React from 'react';
import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ReviewVisibilityProps {
  control: any;
}

const ReviewVisibility = ({ control }: ReviewVisibilityProps) => {
  return (
    <div className="space-y-2">
      <Label>Visibility</Label>
      <Controller
        name="visibility"
        control={control}
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            className="grid grid-cols-3 gap-2"
          >
            <div className="flex items-center space-x-2 border border-brand-orange/30 p-3 rounded-lg">
              <RadioGroupItem value="public" id="public" className="text-brand-orange" />
              <Label htmlFor="public">Public</Label>
            </div>
            <div className="flex items-center space-x-2 border border-brand-orange/30 p-3 rounded-lg">
              <RadioGroupItem value="circle_only" id="circle" className="text-brand-orange" />
              <Label htmlFor="circle">Circle Only</Label>
            </div>
            <div className="flex items-center space-x-2 border border-brand-orange/30 p-3 rounded-lg">
              <RadioGroupItem value="private" id="private" className="text-brand-orange" />
              <Label htmlFor="private">Private</Label>
            </div>
          </RadioGroup>
        )}
      />
    </div>
  );
};

export default ReviewVisibility;
