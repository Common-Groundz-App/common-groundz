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
import { X } from 'lucide-react';

// Define valid database post types
type DatabasePostType = 'story' | 'routine' | 'project' | 'note';
// Define all UI post types
type UIPostType = DatabasePostType | 'journal' | 'watching';

// Map UI post types to database post types
const mapPostTypeToDatabase = (uiType: UIPostType): DatabasePostType => {
  switch (uiType) {
    case 'journal': return 'note';  // Map journal to note
    case 'watching': return 'note'; // Map watching to note
    default: return uiType as DatabasePostType;
  }
};

const formSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }).max(100),
  content: z.string().min(1, { message: 'Content is required' }),
  post_type: z.enum(['story', 'routine', 'project', 'note', 'journal', 'watching'] as const),
  visibility: z.enum(['public', 'circle_only', 'private']),
  media: z.array(z.any()).optional(),
  tagged_entities: z.array(z.any()).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PostToEdit {
  id: string;
  title: string;
  content: string;
  post_type: UIPostType;
  visibility: 'public' | 'circle_only' | 'private';
  tagged_entities?: Entity[];
  media?: MediaItem[];
}

interface CreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  postToEdit?: PostToEdit;
  defaultPostType?: UIPostType;
}

export function CreatePostForm({ 
  onSuccess, 
  onCancel, 
  postToEdit,
  defaultPostType = 'story' 
}: CreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const sessionId = useState<string>(() => generateUUID())[0];
  const isEditMode = !!postToEdit;
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(postToEdit?.tagged_entities?.[0] || null);
  const [showEntitySelector, setShowEntitySelector] = useState(false);
  // Store the HTML string content separately
  const [contentHtml, setContentHtml] = useState<string>('');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      post_type: defaultPostType,
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
      
      // When editing, we need to set the content HTML as well
      if (postToEdit.content) {
        setContentHtml(postToEdit.content);
      }
      
      if (postToEdit.tagged_entities) {
        setSelectedEntities(postToEdit.tagged_entities);
      }
      
      if (postToEdit.media) {
        setMediaItems(postToEdit.media);
      }
    } else {
      // For new posts, set the default post type
      form.setValue('post_type', defaultPostType);
    }
  }, [postToEdit, form, defaultPostType]);

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    console.log('Starting form submission with data:', data);
    console.log('Selected entities:', selectedEntities);
    console.log('Media items:', mediaItems);
    console.log('Content HTML:', contentHtml);
    
    try {
      // Create a clean version of mediaItems for database storage
      // Using direct serialization to avoid circular references
      const mediaToSave = mediaItems.map(item => ({
        id: item.id || generateUUID(),
        url: item.url,
        type: item.type,
        caption: item.caption || '',
        alt: item.alt || '',
        order: item.order,
        thumbnail_url: item.thumbnail_url || item.url
      }));
      
      console.log('Cleaned media items for storage:', mediaToSave);
      
      // Map UI post type to valid database post type
      const databasePostType = mapPostTypeToDatabase(data.post_type);
      
      // Use the HTML string content from our state
      const postData = {
        title: data.title,
        content: contentHtml, // Use the HTML string instead of complex object
        post_type: databasePostType, // Use the mapped database-compatible post type
        visibility: data.visibility,
        media: mediaToSave,
        user_id: user.id,
      };
      
      console.log('Post data being sent to database:', postData);
      
      if (isEditMode) {
        // ... keep existing code (post update logic)
        
        const { error } = await supabase
          .from('posts')
          .update(postData)
          .eq('id', postToEdit.id)
          .eq('user_id', user.id);
          
        if (error) {
          console.error('Error updating post:', error);
          throw error;
        }
        
        if (selectedEntities.length > 0) {
          // Delete existing entity relationships
          const { error: deleteError } = await supabase
            .from('post_entities')
            .delete()
            .eq('post_id', postToEdit.id);
            
          if (deleteError) {
            console.error('Error deleting existing entity relationships:', deleteError);
            throw deleteError;
          }
          
          console.log('Adding entity relationships for entities:', selectedEntities.map(e => e.id));
          
          // Re-add entity relationships with just the entity ID
          for (const entity of selectedEntities) {
            const { error: insertError } = await supabase
              .from('post_entities')
              .insert({
                post_id: postToEdit.id,
                entity_id: entity.id
              });
              
            if (insertError) {
              console.error('Error inserting entity relationship:', insertError);
              throw insertError;
            }
          }
        }
        
        toast({ 
          title: 'Post updated!',
          description: 'Your post has been updated successfully.',
        });
      } else {
        // Create new post
        console.log('Creating new post with content type:', typeof postData.content);
        const { data: newPost, error } = await supabase
          .from('posts')
          .insert(postData)
          .select()
          .single();
          
        if (error) {
          console.error('Error creating post:', error);
          throw error;
        }
        
        console.log('New post created:', newPost);
        
        // Add entity relationships with just the entity ID
        if (selectedEntities.length > 0 && newPost) {
          console.log('Adding entity relationships for new post');
          
          for (const entity of selectedEntities) {
            console.log('Adding relationship for entity:', entity.id);
            
            const { error: entityError } = await supabase
              .from('post_entities')
              .insert({
                post_id: newPost.id,
                entity_id: entity.id
              });
              
            if (entityError) {
              console.error('Error creating entity relationship:', entityError);
              throw entityError;
            }
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
    console.log('Media uploaded:', media);
    setMediaItems(prev => {
      const newMedia = {
        ...media,
        order: prev.length
      };
      return [...prev, newMedia];
    });
  };

  const handleEntitiesChange = (entities: Entity[]) => {
    console.log('Entities changed:', entities);
    setSelectedEntities(entities);
  };

  const handleRemoveMedia = (mediaToRemove: MediaItem) => {
    console.log('Removing media:', mediaToRemove);
    setMediaItems(prev => prev.filter(media => media.id !== mediaToRemove.id));
  };

  function getEntityTypeLabel(entity: Entity | null): string {
    if (!entity) return "place";
    if ((entity as any).entity_type) return (entity as any).entity_type;
    if ((entity as any).category) return (entity as any).category;
    return "place";
  }

  // Get placeholder text based on post type
  const getPlaceholderText = () => {
    const postType = form.watch('post_type');
    switch (postType) {
      case 'journal':
        return "Share your journey, progress, or experiences...";
      case 'watching':
        return "What are you currently watching, reading, or doing?";
      case 'story':
        return "Share your story with the community...";
      case 'routine':
        return "Share your routine or process...";
      case 'project':
        return "Tell us about your project...";
      case 'note':
        return "What's on your mind?";
      default:
        return "What's on your mind?";
    }
  };

  // Get title label based on post type
  const getTitleLabel = () => {
    const postType = form.watch('post_type');
    switch (postType) {
      case 'journal':
        return "Journal Title";
      case 'watching':
        return "What are you watching/doing?";
      case 'story':
        return "Story Title";
      case 'routine':
        return "Routine Name";
      case 'project':
        return "Project Name";
      case 'note':
        return "Title";
      default:
        return "Title";
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{getTitleLabel()}</FormLabel>
              <FormControl>
                <Input placeholder={`Add a title...`} {...field} />
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
                  onChange={(json, html) => {
                    // Store the HTML string for submission
                    setContentHtml(html);
                    // Keep the form field value in sync
                    field.onChange(html);
                  }}
                  value={field.value}
                  placeholder={getPlaceholderText()}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Media Preview Section */}
        {mediaItems.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Media Preview</p>
            <div className="grid grid-cols-2 gap-2">
              {mediaItems.map((item, index) => (
                <div key={item.id || index} className="relative border rounded overflow-hidden group">
                  {item.type === 'image' ? (
                    <img src={item.url} alt={item.alt || `Image ${index + 1}`} className="w-full h-40 object-cover" />
                  ) : (
                    <video src={item.url} className="w-full h-40 object-cover" />
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-80 hover:opacity-100"
                    onClick={() => handleRemoveMedia(item)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
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
                console.log('EntityTagSelector selected entities:', entities);
                setSelectedEntities(entities);
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
                      <SelectItem value="journal">Journal</SelectItem>
                      <SelectItem value="watching">Currently Watching/Doing</SelectItem>
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
