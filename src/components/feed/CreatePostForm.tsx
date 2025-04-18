
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaUploader } from '@/components/media/MediaUploader';
import { useAuth } from '@/contexts/AuthContext';
import { EntitySelector } from '@/components/profile/reviews/ReviewFormEnhancements';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { generateUUID } from '@/lib/uuid';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';

// Define the exact types for post_type and visibility to match schema
const formSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }).max(100),
  content: z.string().min(1, { message: 'Content is required' }),
  post_type: z.enum(['story', 'routine', 'project', 'note']),
  visibility: z.enum(['public', 'circle_only', 'private']),
});

type FormValues = z.infer<typeof formSchema>;

export interface CreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  postToEdit?: {
    id: string;
    title?: string;
    content?: string;
    post_type?: 'story' | 'routine' | 'project' | 'note';
    visibility?: 'public' | 'circle_only' | 'private';
    [key: string]: any;
  };
}

export function CreatePostForm({ onSuccess, onCancel, postToEdit }: CreatePostFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const sessionId = useState<string>(() => generateUUID())[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: postToEdit?.title || '',
      content: postToEdit?.content || '',
      post_type: (postToEdit?.post_type as 'story' | 'routine' | 'project' | 'note') || 'story',
      visibility: (postToEdit?.visibility as 'public' | 'circle_only' | 'private') || 'public',
    },
  });

  const onSubmit = async (data: FormValues) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const postData = {
        ...data,
        media: JSON.parse(JSON.stringify(mediaItems)),
        user_id: user.id,
      };

      // Create the post first
      const { data: newPost, error: postError } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (postError) throw postError;

      // If we have a selected entity, create the relationship
      if (selectedEntity && newPost) {
        const { error: entityError } = await supabase
          .from('post_entities')
          .insert({
            post_id: newPost.id,
            entity_id: selectedEntity.id
          });

        if (entityError) throw entityError;
      }

      onSuccess();
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMediaUploaded = (media: MediaItem) => {
    setMediaItems(prev => {
      const newMedia = {
        ...media,
        order: prev.length
      };
      return [...prev, newMedia];
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Add a title..." {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <RichTextEditor
                  onChange={field.onChange}
                  value={field.value}
                  placeholder="What's on your mind?"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <EntitySelector
            selectedEntity={selectedEntity}
            onEntitySelect={setSelectedEntity}
            entityType="place"
          />

          <MediaUploader
            sessionId={sessionId}
            onMediaUploaded={handleMediaUploaded}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="post_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Visibility</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="circle_only">Circle Only</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : (postToEdit ? 'Update Post' : 'Create Post')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
