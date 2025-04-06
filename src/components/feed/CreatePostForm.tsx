
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { EntityTagSelector } from './EntityTagSelector';

interface CreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type PostFormValues = {
  title: string;
  content: string;
  postType: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
};

export function CreatePostForm({ onSuccess, onCancel }: CreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  
  const form = useForm<PostFormValues>({
    defaultValues: {
      title: '',
      content: '',
      postType: 'story',
      visibility: 'public',
    }
  });

  const onSubmit = async (values: PostFormValues) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create a post',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Insert the post
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          title: values.title,
          content: values.content,
          post_type: values.postType,
          visibility: values.visibility,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (postError) throw postError;
      
      // If entities are selected, associate them with the post
      if (selectedEntities.length > 0 && postData) {
        const entityRelations = selectedEntities.map(entity => ({
          post_id: postData.id,
          entity_id: entity.id
        }));
        
        const { error: entityError } = await supabase
          .from('post_entities')
          .insert(entityRelations);
          
        if (entityError) {
          console.error('Error adding entity relations:', entityError);
          // Continue even if entity relations fail, we still created the post
        }
      }

      toast({
        title: 'Success!',
        description: 'Your post has been created',
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Failed to create post',
        description: 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="postType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Post Type</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select post type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
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

        <FormField
          control={form.control}
          name="content"
          rules={{ required: 'Content is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Write your post content here..." 
                  className="min-h-[120px]" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Entity Selector */}
        <div className="pt-2 pb-1">
          <EntityTagSelector 
            onEntitiesChange={setSelectedEntities}
          />
        </div>

        <FormField
          control={form.control}
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

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-brand-orange hover:bg-brand-orange/90"
          >
            {isSubmitting ? 'Creating...' : 'Create Post'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
