
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
import { generateUUID } from '@/lib/uuid';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { Json } from '@/integrations/supabase/types';
import { EntityPreviewCard } from '@/components/common/EntityPreviewCard';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { X, Trash2 } from 'lucide-react';

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

// Helper function to simplify entity objects for storage
const cleanEntityForStorage = (entity: Entity) => {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type || null,
    venue: entity.venue || null,
    description: entity.description || null,
    image_url: entity.image_url || null,
  };
};

export function CreatePostForm({ onSuccess, onCancel, postToEdit }: CreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const sessionId = useState<string>(() => generateUUID())[0];
  const isEditMode = !!postToEdit;
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(postToEdit?.tagged_entities?.[0] || null);
  const [showEntitySelector, setShowEntitySelector] = useState(false);

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

  useEffect(() => {
    if (postToEdit?.tagged_entities?.[0]) {
      setSelectedEntity(postToEdit.tagged_entities[0]);
    }
  }, [postToEdit]);

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
      // Prepare media items for storage - clean structure without circular references
      const cleanMediaItems = mediaItems.map(item => ({
        url: item.url,
        type: item.type,
        caption: item.caption || '',
        alt: item.alt || '',
        order: item.order || 0,
        thumbnail_url: item.thumbnail_url || '',
        session_id: item.session_id || '',
        id: item.id || generateUUID()
      }));
      
      const postData = {
        title: data.title,
        content: data.content,
        post_type: data.post_type,
        visibility: data.visibility,
        media: cleanMediaItems,
        user_id: user.id,
      };
      
      if (isEditMode) {
        const { error } = await supabase
          .from('posts')
          .update(postData)
          .eq('id', postToEdit.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        if (selectedEntities.length > 0) {
          const { error: deleteError } = await supabase
            .from('post_entities')
            .delete()
            .eq('post_id', postToEdit.id);
            
          if (deleteError) throw deleteError;
          
          for (const entity of selectedEntities) {
            // Clean the entity object before inserting
            const cleanEntity = cleanEntityForStorage(entity);
            
            const { error: insertError } = await supabase
              .from('post_entities')
              .insert({
                post_id: postToEdit.id,
                entity_id: cleanEntity.id
              });
              
            if (insertError) throw insertError;
          }
        }
        
        toast({ 
          title: 'Post updated!',
          description: 'Your post has been updated successfully.',
        });
      } else {
        const { data: newPost, error } = await supabase
          .from('posts')
          .insert(postData)
          .select()
          .single();
          
        if (error) throw error;
        
        if (selectedEntities.length > 0 && newPost) {
          for (const entity of selectedEntities) {
            // Clean the entity object before inserting
            const cleanEntity = cleanEntityForStorage(entity);
            
            const { error: entityError } = await supabase
              .from('post_entities')
              .insert({
                post_id: newPost.id,
                entity_id: cleanEntity.id
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
      const newMedia = {
        ...media,
        order: prev.length
      };
      return [...prev, newMedia];
    });
  };

  const handleRemoveMedia = (indexToRemove: number) => {
    setMediaItems(prev => {
      // Remove the item at the specified index
      const newMediaItems = prev.filter((_, index) => index !== indexToRemove);
      
      // Re-order the remaining items
      return newMediaItems.map((item, index) => ({
        ...item,
        order: index
      }));
    });
  };

  const handleEntitiesChange = (entities: Entity[]) => {
    setSelectedEntities(entities);
  };

  function getEntityTypeLabel(entity: Entity | null): string {
    if (!entity) return "place";
    if ((entity as any).entity_type) return (entity as any).entity_type;
    if ((entity as any).category) return (entity as any).category;
    return "place";
  }

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
        
        <div className="space-y-3">
          <FormLabel>Media</FormLabel>
          
          {/* Media Uploader comes FIRST as requested */}
          <MediaUploader
            sessionId={sessionId}
            onMediaUploaded={handleMediaUploaded}
          />
          
          {/* Media Previews BELOW the uploader */}
          {mediaItems.length > 0 && (
            <div className="mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mediaItems.map((item, index) => (
                  <div key={index} className="relative border rounded-md overflow-hidden group">
                    {item.type === 'image' ? (
                      <div className="aspect-video relative">
                        <ImageWithFallback 
                          src={item.url} 
                          alt={item.alt || `Image ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video relative">
                        <video 
                          src={item.url} 
                          className="w-full h-full object-cover" 
                          controls 
                        />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveMedia(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {(selectedEntity && !showEntitySelector) ? (
          <EntityPreviewCard
            entity={selectedEntity}
            type={getEntityTypeLabel(selectedEntity)}
            onChange={() => setShowEntitySelector(true)}
          />
        ) : (
          <div>
            <EntityTagSelector
              onEntitiesChange={(entities) => {
                setSelectedEntity(entities[0]);
                setShowEntitySelector(false);
                form.setValue('tagged_entities', entities);
              }}
              initialEntities={selectedEntity ? [selectedEntity] : []}
            />
          </div>
        )}
        
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
