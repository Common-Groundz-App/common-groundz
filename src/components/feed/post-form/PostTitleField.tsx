
import React from 'react';
import { Control } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface PostTitleFieldProps {
  control: Control<any>;
}

export function PostTitleField({ control }: PostTitleFieldProps) {
  return (
    <FormField
      control={control}
      name="title"
      rules={{ required: 'Title is required' }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Title</FormLabel>
          <FormControl>
            <Input placeholder="Enter title for your post" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
