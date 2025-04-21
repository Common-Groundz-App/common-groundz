
import React from 'react';
import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ReviewCategorySelectProps {
  control: any;
  onCategoryChange: (value: string) => void;
}

const ReviewCategorySelect = ({ control, onCategoryChange }: ReviewCategorySelectProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="category">Category</Label>
      <Controller
        name="category"
        control={control}
        render={({ field }) => (
          <Select 
            onValueChange={(val) => {
              field.onChange(val);
              onCategoryChange(val);
            }}
            value={field.value}
          >
            <SelectTrigger className="border-brand-orange/30 focus:ring-brand-orange/30">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="movie">Movie</SelectItem>
              <SelectItem value="book">Book</SelectItem>
              <SelectItem value="place">Place</SelectItem>
              <SelectItem value="product">Product</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
};

export default ReviewCategorySelect;
