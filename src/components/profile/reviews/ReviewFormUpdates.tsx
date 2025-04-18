
import React from 'react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { EntitySelector } from './ReviewFormEnhancements';
import { Entity } from '@/services/recommendationService';

// This is a helper file that will be used to update the main ReviewForm component
// We'll need to incorporate these elements into the main ReviewForm

export const renderEntitySelector = (form: any, entityType: 'movie' | 'book' | 'place' | 'product' | 'food') => {
  return (
    <div className="space-y-2 mb-4">
      <EntitySelector
        selectedEntity={form.getValues('entity') as Entity | null}
        onEntitySelect={(entity) => {
          form.setValue('entity_id', entity.id);
          form.setValue('entity', entity);
          if (entity.name && !form.getValues('title')) {
            form.setValue('title', entity.name);
          }
          if (entity.venue && !form.getValues('venue')) {
            form.setValue('venue', entity.venue);
          }
          if (entity.image_url && !form.getValues('image_url')) {
            form.setValue('image_url', entity.image_url);
          }
          if (entity.description && !form.getValues('description')) {
            form.setValue('description', entity.description);
          }
        }}
        entityType={entityType}
      />
    </div>
  );
};
