
import React from 'react';
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewRatingProps {
  control: any;
  watch: any;
  errors: any;
}

const ReviewRating = ({ control, watch, errors }: ReviewRatingProps) => {
  return (
    <div className="space-y-2">
      <Label>Rating</Label>
      <div className="flex items-center">
        <Controller
          name="rating"
          control={control}
          rules={{ required: "Please provide a rating" }}
          render={({ field }) => (
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Button
                  type="button"
                  key={star}
                  variant="ghost"
                  className="p-1 hover:bg-transparent"
                  onClick={() => field.onChange(star)}
                >
                  <Star
                    className={cn(
                      "h-6 w-6",
                      star <= field.value ? "fill-brand-orange text-brand-orange" : "text-gray-300"
                    )}
                  />
                </Button>
              ))}
            </div>
          )}
        />
        <span className="ml-2 text-sm">
          {watch('rating') === 0 ? 'Select a rating' : `${watch('rating')} out of 5`}
        </span>
      </div>
      {errors.rating && (
        <p className="text-red-500 text-xs">{errors.rating.message?.toString()}</p>
      )}
    </div>
  );
};

export default ReviewRating;
