
import React from 'react';
import { Control } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface PostVisibilitySelectorProps {
  control: Control<any>;
}

export function PostVisibilitySelector({ control }: PostVisibilitySelectorProps) {
  return (
    <FormField
      control={control}
      name="visibility"
      render={({ field }) => (
        <FormItem className="space-y-3">
          <FormLabel>Visibility</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              defaultValue={field.value}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" />
                <FormLabel htmlFor="public" className="font-normal cursor-pointer">
                  Public — Anyone can see this post
                </FormLabel>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="circle_only" id="circle_only" />
                <FormLabel htmlFor="circle_only" className="font-normal cursor-pointer">
                  Circle Only — Only people in your circle can see this post
                </FormLabel>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <FormLabel htmlFor="private" className="font-normal cursor-pointer">
                  Private — Only you can see this post
                </FormLabel>
              </div>
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
