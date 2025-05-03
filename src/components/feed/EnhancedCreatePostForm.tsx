
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Image, Smile, MapPin, Tag, MoreHorizontal } from 'lucide-react';
import { MediaUploader } from '@/components/media/MediaUploader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateUUID } from '@/lib/uuid';
import { Entity, EntityType } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { mapPostTypeToDatabase } from './utils/postUtils';
import { SimpleEntitySelector } from './SimpleEntitySelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  content: z.string().min(1, { message: 'Content is required' }),
  title: z.string().optional(),
  post_type: z.enum(['story', 'routine', 'project', 'note', 'journal', 'watching'] as const),
  visibility: z.enum(['public', 'circle_only', 'private']),
  tagged_entities: z.array(z.any()).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PostToEdit {
  id: string;
  title?: string;
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
  const [activeEntityType, setActiveEntityType] = useState<EntityType>('place');
  const [contentHtml, setContentHtml] = useState<string>(postToEdit?.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = useState<string>(() => generateUUID())[0];
  const isEditMode = !!postToEdit;
  const isMobile = useIsMobile();
  const mediaUploaderRef = useRef<HTMLInputElement>(null);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: postToEdit?.title || '',
      content: postToEdit?.content || '',
      post_type: postToEdit?.post_type || defaultPostType,
      visibility: postToEdit?.visibility || 'public',
      tagged_entities: [],
    },
  });

  // Auto grow textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(250, textarea.scrollHeight)}px`;
      };
      
      textarea.addEventListener('input', adjustHeight);
      
      // Initial adjustment
      setTimeout(adjustHeight, 0);
      
      return () => textarea.removeEventListener('input', adjustHeight);
    }
  }, []);
  
  // Set form values when editing
  useEffect(() => {
    if (postToEdit) {
      form.reset({
        title: postToEdit.title || '',
        content: postToEdit.content,
        post_type: postToEdit.post_type,
        visibility: postToEdit.visibility,
      });
      
      if (postToEdit.content) {
        setContentHtml(postToEdit.content);
      }
      
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
      
      // Map to valid database post type
      const databasePostType = mapPostTypeToDatabase(data.post_type);
      
      // Use the form's content or contentHtml
      const content = data.content || contentHtml;
      
      const postData = {
        title: data.title || getAutoTitleFromContent(content),
        content: content,
        post_type: databasePostType,
        visibility: data.visibility,
        media: mediaToSave,
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
        
        // Update entity relationships
        if (selectedEntities.length > 0) {
          // Delete existing relationships
          await supabase
            .from('post_entities')
            .delete()
            .eq('post_id', postToEdit.id);
          
          // Re-add entity relationships
          for (const entity of selectedEntities) {
            await supabase
              .from('post_entities')
              .insert({
                post_id: postToEdit.id,
                entity_id: entity.id
              });
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
            await supabase
              .from('post_entities')
              .insert({
                post_id: newPost.id,
                entity_id: entity.id
              });
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
    // Limit to 4 media items
    if (mediaItems.length >= 4) {
      toast({
        title: 'Media limit reached',
        description: 'You can only upload up to 4 media items per post.',
        variant: 'destructive'
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

  const handleRemoveMedia = (mediaToRemove: MediaItem) => {
    setMediaItems(prev => prev.filter(media => media.id !== mediaToRemove.id));
  };

  const handleEntitiesChange = (entities: Entity[]) => {
    setSelectedEntities(entities);
    setIsEntitySelectorOpen(false);
  };
  
  const triggerMediaUpload = () => {
    // This will be handled by the MediaUploader component
    if (mediaUploaderRef.current) {
      mediaUploaderRef.current.click();
    }
  };
  
  const openEntitySelector = (entityType: EntityType) => {
    setActiveEntityType(entityType);
    setIsEntitySelectorOpen(true);
  };
  
  // Generate title from content if needed
  const getAutoTitleFromContent = (content: string): string => {
    if (!content) return '';
    
    // Extract first line or first X characters
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length <= 50) return firstLine;
    
    return firstLine.substring(0, 47) + '...';
  };
  
  // Get placeholder based on post type
  const getPlaceholder = () => {
    return "What do you want to share today?";
  };
  
  // Get user profile data from user object
  const userAvatarUrl = user?.user_metadata?.avatar_url || '';
  const userUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
  
  const hasContent = !!form.watch('content') || mediaItems.length > 0;
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* User Info + Text Input */}
        <div className="flex gap-3 items-start">
          {/* User Avatar */}
          <Avatar className="h-10 w-10 mt-1 flex-shrink-0">
            <AvatarImage src={userAvatarUrl} alt={userUsername} />
            <AvatarFallback>{userUsername.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          {/* Content Area */}
          <div className="flex-1 space-y-4">
            {/* Username */}
            <div className="font-medium text-sm">
              {userUsername}
            </div>
            
            {/* Main Content Input */}
            <Textarea
              ref={textareaRef}
              placeholder={getPlaceholder()}
              className="w-full min-h-[100px] p-3 text-base border-0 focus-visible:ring-0 resize-none rounded-xl"
              value={form.watch('content')}
              onChange={(e) => {
                form.setValue('content', e.target.value);
                setContentHtml(e.target.value);
              }}
            />
          </div>
        </div>
        
        {/* Media Preview */}
        {mediaItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
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
                  <span className="text-xs">×</span>
                </Button>
              </div>
            ))}
          </div>
        )}
        
        {/* Entity Tags */}
        {selectedEntities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedEntities.map(entity => (
              <div 
                key={entity.id} 
                className="bg-accent/20 text-sm px-2 py-1 rounded-full flex items-center gap-1"
              >
                <span>{entity.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 rounded-full"
                  onClick={() => setSelectedEntities(prev => prev.filter(e => e.id !== entity.id))}
                >
                  <span className="text-xs">×</span>
                </Button>
              </div>
            ))}
          </div>
        )}
        
        {/* Divider before toolbar */}
        <div className="border-t my-3"></div>
        
        {/* Bottom Toolbar + Posting Actions */}
        <div className="flex items-center justify-between">
          {/* Left toolbar with icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hidden MediaUploader that will be triggered by our custom button */}
            <div className="hidden">
              <MediaUploader
                sessionId={sessionId}
                onMediaUploaded={handleMediaUploaded}
                initialMedia={mediaItems}
                customButton={<div ref={mediaUploaderRef}></div>}
              />
            </div>
            
            {/* Media Upload Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={triggerMediaUpload}
            >
              <Image size={20} className="text-muted-foreground" />
            </Button>
            
            {/* Emoji Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => toast({ title: "Coming soon", description: "Emoji picker will be available soon!" })}
            >
              <Smile size={20} className="text-muted-foreground" />
            </Button>
            
            {/* Tag Entities Button - Opens a popover with entity type selection */}
            <Popover open={isEntitySelectorOpen} onOpenChange={setIsEntitySelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                >
                  <Tag size={20} className="text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 space-y-3" align="start">
                <h4 className="text-sm font-medium">Tag a place, product, or media</h4>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="rounded-full"
                    onClick={() => {
                      setActiveEntityType('place');
                      openEntitySelector('place');
                    }}
                  >
                    🏠 Place
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="rounded-full"
                    onClick={() => {
                      setActiveEntityType('food');
                      openEntitySelector('food');
                    }}
                  >
                    🍟 Food
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="rounded-full"
                    onClick={() => {
                      setActiveEntityType('movie');
                      openEntitySelector('movie');
                    }}
                  >
                    🎬 Movie
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="rounded-full"
                    onClick={() => {
                      setActiveEntityType('book');
                      openEntitySelector('book');
                    }}
                  >
                    📚 Book
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="rounded-full"
                    onClick={() => {
                      setActiveEntityType('product');
                      openEntitySelector('product');
                    }}
                  >
                    💄 Product
                  </Button>
                </div>
                
                <SimpleEntitySelector
                  onEntitiesChange={handleEntitiesChange}
                  initialEntities={selectedEntities}
                />
              </PopoverContent>
            </Popover>
            
            {/* Location Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => toast({ title: "Coming soon", description: "Location tagging will be available soon!" })}
            >
              <MapPin size={20} className="text-muted-foreground" />
            </Button>
            
            {/* More Options Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => toast({ title: "Coming soon", description: "More options will be available soon!" })}
            >
              <MoreHorizontal size={20} className="text-muted-foreground" />
            </Button>
          </div>
          
          {/* Right side - Visibility + Post/Cancel */}
          <div className="flex items-center gap-2">
            {/* Visibility Dropdown */}
            <Select
              value={form.watch('visibility')}
              onValueChange={(val) => form.setValue('visibility', val as 'public' | 'circle_only' | 'private')}
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
            
            {/* Cancel Button */}
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              size={isMobile ? "sm" : "default"}
              className="font-normal"
            >
              Cancel
            </Button>
            
            {/* Post Button */}
            <Button
              type="submit"
              disabled={isSubmitting || !hasContent}
              size={isMobile ? "sm" : "default"}
              className="bg-brand-orange hover:bg-brand-orange/90"
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
      </form>
    </Form>
  );
}
