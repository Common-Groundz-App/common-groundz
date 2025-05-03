
import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateUUID } from '@/lib/uuid';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Textarea } from '@/components/ui/textarea';
import { MediaUploader } from '@/components/media/MediaUploader';
import { Entity, EntityType } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { SimpleEntitySelector } from './SimpleEntitySelector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { mapPostTypeToDatabase } from './utils/postUtils';
import {
  ImageIcon, SmileIcon, Tag, MapPin, MoreHorizontal, X, Check
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Form schema
const formSchema = z.object({
  content: z.string().min(1, { message: 'Content is required' }),
  title: z.string().optional(),
  post_type: z.enum(['story', 'routine', 'project', 'note', 'journal', 'watching']),
  visibility: z.enum(['public', 'circle_only', 'private']),
});

type FormData = z.infer<typeof formSchema>;

interface PostToEdit {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note' | 'journal' | 'watching';
  visibility: 'public' | 'circle_only' | 'private';
  tagged_entities?: Entity[];
  media?: MediaItem[];
}

interface EnhancedCreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  postToEdit?: PostToEdit;
  defaultPostType?: 'story' | 'routine' | 'project' | 'note' | 'journal' | 'watching';
}

export function EnhancedCreatePostForm({
  onSuccess,
  onCancel,
  postToEdit,
  defaultPostType = 'story'
}: EnhancedCreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>(postToEdit?.tagged_entities || []);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(postToEdit?.media || []);
  const [isEntitySelectorOpen, setIsEntitySelectorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = useState<string>(() => generateUUID())[0];
  const isEditMode = !!postToEdit;
  
  // Get user profile data
  const userAvatarUrl = user?.user_metadata?.avatar_url || '';
  const userUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: postToEdit?.title || '',
      content: postToEdit?.content || '',
      post_type: postToEdit?.post_type || defaultPostType,
      visibility: postToEdit?.visibility || 'public',
    },
  });

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };
      
      textarea.addEventListener('input', adjustHeight);
      // Initial adjustment
      adjustHeight();
      
      return () => textarea.removeEventListener('input', adjustHeight);
    }
  }, []);

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      // Clean media items for database storage
      const mediaToSave = mediaItems.map(item => ({
        id: item.id || generateUUID(),
        url: item.url,
        type: item.type,
        caption: item.caption || '',
        alt: item.alt || '',
        order: item.order,
        thumbnail_url: item.thumbnail_url || item.url
      }));
      
      // Auto-generate title from content if not provided
      const title = data.title || getAutoTitleFromContent(data.content);
      
      // Map to valid database post type
      const databasePostType = mapPostTypeToDatabase(data.post_type);
      
      const postData = {
        title,
        content: data.content,
        post_type: databasePostType,
        visibility: data.visibility,
        media: mediaToSave,
        user_id: user.id,
      };
      
      if (isEditMode && postToEdit) {
        // Update existing post
        const { error } = await supabase
          .from('posts')
          .update(postData)
          .eq('id', postToEdit.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        // Update entity relationships
        if (selectedEntities.length > 0) {
          // Delete existing entity relationships
          const { error: deleteError } = await supabase
            .from('post_entities')
            .delete()
            .eq('post_id', postToEdit.id);
            
          if (deleteError) throw deleteError;
          
          // Re-add entity relationships
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
        
        // Add entity relationships
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

  // Handle media upload
  const handleMediaUploaded = (media: MediaItem) => {
    // Limit to 4 media items
    if (mediaItems.length >= 4) {
      toast({ 
        title: 'Limit reached', 
        description: 'You can upload up to 4 media files per post' 
      });
      return;
    }
    
    setMediaItems(prev => {
      const newMedia = {
        ...media,
        order: prev.length
      };
      return [...prev, newMedia];
    });
  };

  // Handle media removal
  const handleRemoveMedia = (mediaToRemove: MediaItem) => {
    setMediaItems(prev => prev.filter(media => media.id !== mediaToRemove.id));
  };

  // Handle entity selection
  const handleEntitiesChange = (entities: Entity[]) => {
    setSelectedEntities(entities);
    setIsEntitySelectorOpen(false);
  };
  
  // Auto-generate title from content if needed
  const getAutoTitleFromContent = (content: string): string => {
    if (!content) return '';
    
    // Extract first line or first X characters
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length <= 50) return firstLine;
    
    return firstLine.substring(0, 47) + '...';
  };

  // Get placeholder text
  const getPlaceholder = () => {
    return "What do you want to share today?";
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex gap-3 items-start">
          {/* User Avatar */}
          <UserAvatar 
            username={userUsername} 
            imageUrl={userAvatarUrl} 
            className="h-10 w-10 mt-1 flex-shrink-0" 
          />
          
          {/* Content Area */}
          <div className="flex-1 space-y-4">
            {/* Main Content Input */}
            <Textarea
              ref={textareaRef}
              placeholder={getPlaceholder()}
              className="w-full min-h-[120px] p-3 text-base border-0 focus-visible:ring-0 resize-none rounded-xl bg-accent/5"
              value={form.watch('content')}
              onChange={(e) => {
                form.setValue('content', e.target.value);
              }}
            />
            
            {/* Media Preview */}
            {mediaItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {mediaItems.map((item, index) => (
                  <div key={item.id || index} className="relative rounded-xl overflow-hidden group aspect-square">
                    {item.type === 'image' ? (
                      <img src={item.url} alt={item.alt || `Image ${index + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <video src={item.url} className="w-full h-full object-cover" />
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-80 hover:opacity-100"
                      onClick={() => handleRemoveMedia(item)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Entity Tags */}
            {selectedEntities.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedEntities.map(entity => {
                  let icon = <Tag size={14} />;
                  if ((entity as any).type === 'place' || (entity as any).entity_type === 'place') {
                    icon = <MapPin size={14} />;
                  }
                  
                  return (
                    <div 
                      key={entity.id} 
                      className="bg-accent/10 text-sm px-2 py-1 rounded-full flex items-center gap-1"
                    >
                      {icon}
                      <span>{entity.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 rounded-full"
                        onClick={() => setSelectedEntities(prev => prev.filter(e => e.id !== entity.id))}
                      >
                        <X size={10} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Actions Bar */}
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                {/* Hidden Media Uploader */}
                <MediaUploader
                  onMediaUploaded={handleMediaUploaded}
                  sessionId={sessionId}
                  className="hidden" 
                  customButton={
                    <Button type="button" variant="ghost" size="sm" className="rounded-full">
                      <ImageIcon size={20} className="text-muted-foreground" />
                    </Button>
                  }
                />
                
                {/* Entity Tag Button */}
                <Popover open={isEntitySelectorOpen} onOpenChange={setIsEntitySelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                    >
                      <Tag size={20} className="text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3">
                    <SimpleEntitySelector
                      onEntitiesChange={handleEntitiesChange}
                      initialEntities={selectedEntities}
                    />
                  </PopoverContent>
                </Popover>
                
                {/* Emoji Button (placeholder) */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm" 
                  className="rounded-full"
                  onClick={() => toast({ title: "Coming soon", description: "Emoji picker will be available soon!" })}
                >
                  <SmileIcon size={20} className="text-muted-foreground" />
                </Button>
                
                {/* Location Button (placeholder) */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => toast({ title: "Coming soon", description: "Location picker will be available soon!" })}
                >
                  <MapPin size={20} className="text-muted-foreground" />
                </Button>
                
                {/* More Options Button (placeholder) */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => toast({ title: "Coming soon", description: "More options will be available soon!" })}
                >
                  <MoreHorizontal size={20} className="text-muted-foreground" />
                </Button>
              </div>
              
              {/* Visibility and Post/Cancel Buttons */}
              <div className="flex items-center gap-2">
                <Select 
                  value={form.watch('visibility')}
                  onValueChange={(value) => form.setValue('visibility', value as 'public' | 'circle_only' | 'private')}
                >
                  <SelectTrigger className="w-[110px] h-9 text-xs">
                    <SelectValue placeholder="Visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="circle_only">Circle Only</SelectItem>
                    <SelectItem value="private">Only Me</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  size="sm"
                  className="font-normal"
                >
                  Cancel
                </Button>
                
                <Button
                  type="submit"
                  disabled={isSubmitting || !form.watch('content')}
                  size="sm"
                  className={cn(
                    "bg-brand-orange hover:bg-brand-orange/90",
                    (!form.watch('content') && !mediaItems.length) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1">
                      <span className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin"></span>
                      {isEditMode ? 'Updating...' : 'Posting...'}
                    </span>
                  ) : (
                    isEditMode ? 'Update' : 'Post'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
