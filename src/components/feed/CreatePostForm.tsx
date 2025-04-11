
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { MediaUploader } from '@/components/media/MediaUploader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EntityTagSelector } from './EntityTagSelector';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { v4 as uuidv4 } from 'uuid';
import { Json } from '@/integrations/supabase/types';

const formSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }).max(100),
  content: z.string().min(1, { message: 'Content is required' }),
  post_type: z.enum(['story', 'routine', 'project', 'note']),
  visibility: z.enum(['public', 'circle_only', 'private']),
  media: z.array(z.any()).optional(),
  tagged_entities: z.array(z.any()).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PostToEdit {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  tagged_entities?: Entity[];
  media?: MediaItem[];
}

interface CreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  postToEdit?: PostToEdit;
}

export function CreatePostForm({ onSuccess, onCancel, postToEdit }: CreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const sessionId = useState<string>(() => uuidv4())[0]; // Generate a stable sessionId
  const isEditMode = !!postToEdit;
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      post_type: 'story',
      visibility: 'public',
      media: [],
      tagged_entities: [],
    },
  });
  
  // Load post data for editing
  useEffect(() => {
    if (postToEdit) {
      form.reset({
        title: postToEdit.title,
        content: postToEdit.content,
        post_type: postToEdit.post_type,
        visibility: postToEdit.visibility,
        tagged_entities: postToEdit.tagged_entities || [],
        media: postToEdit.media || [],
      });
      
      if (postToEdit.tagged_entities) {
        setSelectedEntities(postToEdit.tagged_entities);
      }
      
      if (postToEdit.media) {
        setMediaItems(postToEdit.media);
      }
    }
  }, [postToEdit, form]);

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      // Convert MediaItem[] to Json for database compatibility
      const mediaJson = JSON.parse(JSON.stringify(mediaItems)) as Json;
      
      const postData = {
        title: data.title,
        content: data.content,
        post_type: data.post_type,
        visibility: data.visibility,
        media: mediaJson,
        user_id: user.id,
      };
      
      if (isEditMode) {
        // Update existing post
        const { error } = await supabase
          .from('posts')
          .update(postData)
          .eq('id', postToEdit.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        // Delete existing entity relationships and create new ones
        if (selectedEntities.length > 0) {
          // First, remove all existing entity relationships
          const { error: deleteError } = await supabase
            .from('post_entities')
            .delete()
            .eq('post_id', postToEdit.id);
            
          if (deleteError) throw deleteError;
          
          // Now create new entity relationships
          for (const entity of selectedEntities) {
            const { error: insertError } = await supabase
              .from('post_entities')
              .insert({
                post_id: postToEdit.id,
                entity_id: entity.id
              });
              
            if (insertError) throw insertError;
          }
        }
        
        toast({ 
          title: 'Post updated!',
          description: 'Your post has been updated successfully.',
        });
      } else {
        // Create new post
        const { data: newPost, error } = await supabase
          .from('posts')
          .insert(postData)
          .select()
          .single();
          
        if (error) throw error;
        
        // Create entity relationships
        if (selectedEntities.length > 0 && newPost) {
          for (const entity of selectedEntities) {
            const { error: entityError } = await supabase
              .from('post_entities')
              .insert({
                post_id: newPost.id,
                entity_id: entity.id
              });
              
            if (entityError) throw entityError;
          }
        }
        
        toast({ 
          title: 'Post created!',
          description: 'Your post has been published successfully.',
        });
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error submitting post:', error);
      toast({
        title: 'Something went wrong',
        description: 'Your post could not be saved. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleMediaUploaded = (media: MediaItem) => {
    setMediaItems(prev => {
      // Add order number to new media item
      const newMedia = {
        ...media,
        order: prev.length
      };
      return [...prev, newMedia];
    });
  };
  
  const handleEntitiesChange = (entities: Entity[]) => {
    setSelectedEntities(entities);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Add a title..." {...field} />
              </FormControl>
              <FormMessage />
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
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Media uploader with the correct props */}
        <div>
          {isEditMode && mediaItems.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Current Media</p>
              <div className="grid grid-cols-2 gap-2">
                {mediaItems.map((item, index) => (
                  <div key={index} className="relative border rounded overflow-hidden">
                    {item.type === 'image' ? (
                      <img src={item.url} alt={item.alt || `Image ${index + 1}`} className="w-full h-40 object-cover" />
                    ) : (
                      <video src={item.url} className="w-full h-40 object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <MediaUploader
            sessionId={sessionId}
            onMediaUploaded={handleMediaUploaded}
          />
        </div>
        
        {/* Entity selector with the correct props */}
        <EntityTagSelector
          onEntitiesChange={handleEntitiesChange}
          initialEntities={postToEdit?.tagged_entities || []}
        />
        
        <div className="space-y-3 pt-3">
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
                  <FormMessage />
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isEditMode ? (isSubmitting ? 'Updating...' : 'Update Post') : (isSubmitting ? 'Publishing...' : 'Publish Post')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
