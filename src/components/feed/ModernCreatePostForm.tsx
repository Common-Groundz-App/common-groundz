
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Image, Video, X, AtSign, Smile } from 'lucide-react';
import { MediaUploader } from '@/components/media/MediaUploader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateUUID } from '@/lib/uuid';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { mapPostTypeToDatabase } from './utils/postUtils';
import { SimpleEntitySelector } from './SimpleEntitySelector';
import { getDisplayName } from '@/services/profileService';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

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
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note' | 'journal' | 'watching';
  visibility: 'public' | 'circle_only' | 'private';
  tagged_entities?: Entity[];
  media?: MediaItem[];
}

interface ModernCreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  postToEdit?: PostToEdit;
  defaultPostType?: 'story' | 'routine' | 'project' | 'note' | 'journal' | 'watching';
  profileData?: any;
}

export function ModernCreatePostForm({ 
  onSuccess, 
  onCancel, 
  postToEdit,
  defaultPostType = 'story',
  profileData
}: ModernCreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>(postToEdit?.tagged_entities || []);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(postToEdit?.media || []);
  const [isEntitySelectorOpen, setIsEntitySelectorOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [contentHtml, setContentHtml] = useState<string>(postToEdit?.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = useState<string>(() => generateUUID())[0];
  const isEditMode = !!postToEdit;
  const isMobile = useIsMobile();
  const [cursorPosition, setCursorPosition] = useState<{ start: number, end: number } | null>(null);
  
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
        textarea.style.height = `${textarea.scrollHeight}px`;
      };
      
      textarea.addEventListener('input', adjustHeight);
      // Initial adjustment
      adjustHeight();
      
      return () => textarea.removeEventListener('input', adjustHeight);
    }
  }, []);
  
  // Set form values when editing
  useEffect(() => {
    if (postToEdit) {
      form.reset({
        title: postToEdit.title,
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

  // Save cursor position when textarea is focused or clicked
  const saveCursorPosition = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      setCursorPosition({ start, end });
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: any) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const currentContent = form.getValues('content');
      let start = textarea.selectionStart;
      let end = textarea.selectionEnd;
      
      // Use saved cursor position if textarea lost focus (e.g. when clicking emoji)
      if (document.activeElement !== textarea && cursorPosition) {
        start = cursorPosition.start;
        end = cursorPosition.end;
      }
      
      // Insert emoji at cursor position
      const newContent = 
        currentContent.substring(0, start) + 
        emoji.native + 
        currentContent.substring(end);
      
      // Update form value and content HTML
      form.setValue('content', newContent);
      setContentHtml(newContent);
      
      // Update cursor position for next insertion
      const newPosition = start + emoji.native.length;
      setCursorPosition({ start: newPosition, end: newPosition });
      
      // Optional: Focus back on textarea after emoji insertion
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPosition, newPosition);
        }
      }, 10);
    }
    
    // Close emoji picker after selection
    setIsEmojiPickerOpen(false);
  };

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
    const postType = form.watch('post_type');
    switch (postType) {
      case 'journal':
        return "What's happening in your journey?";
      case 'watching':
        return "What are you watching or doing right now?";
      case 'story':
        return "What's on your mind?";
      case 'routine':
        return "Share your routine...";
      case 'project':
        return "Tell us about your project...";
      case 'note':
        return "What's on your mind?";
      default:
        return "What's on your mind?";
    }
  };
  
  // Get user display name using the profileData or fallback to user metadata
  const userDisplayName = user ? (
    profileData ? getDisplayName(user, profileData) : 
    (user.user_metadata?.username || user.email?.split('@')[0] || 'User')
  ) : 'User';

  // Get avatar URL from profileData
  const avatarUrl = profileData?.avatar_url || null;
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex gap-3 items-start">
          {/* User Avatar */}
          <Avatar className="h-10 w-10 mt-1">
            <AvatarImage src={avatarUrl} alt={userDisplayName} />
            <AvatarFallback>{userDisplayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          {/* Content Area */}
          <div className="flex-1 space-y-4">
            {/* Main Content Input */}
            <Textarea
              ref={textareaRef}
              placeholder={getPlaceholder()}
              className="w-full min-h-[120px] p-3 text-base border-0 focus-visible:ring-0 resize-none bg-accent/10 rounded-lg"
              value={form.watch('content')}
              onChange={(e) => {
                form.setValue('content', e.target.value);
                setContentHtml(e.target.value);
              }}
              onClick={saveCursorPosition}
              onKeyUp={saveCursorPosition}
              onFocus={saveCursorPosition}
            />
            
            {/* Media Preview */}
            {mediaItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {mediaItems.map((item, index) => (
                  <div key={item.id || index} className="relative rounded-lg overflow-hidden group aspect-square">
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
                      <X size={10} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Actions Bar */}
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                {/* Media Upload Button */}
                <MediaUploader
                  onMediaUploaded={handleMediaUploaded}
                  sessionId={sessionId}
                  className="hidden"
                />
                
                {/* Custom media upload button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    // Trigger the hidden file input
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.multiple = true;
                    fileInput.accept = 'image/*,video/*';
                    fileInput.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files) {
                        // Process files here
                        // This is just a placeholder since we can't directly invoke the hidden uploader
                        toast({
                          title: "Media upload",
                          description: "Please use the MediaUploader component directly"
                        });
                      }
                    };
                    fileInput.click();
                  }}
                >
                  <Image size={20} className="text-muted-foreground" />
                </Button>
                
                {/* Entity Tag Button */}
                <Popover open={isEntitySelectorOpen} onOpenChange={setIsEntitySelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                    >
                      <AtSign size={20} className="text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2">
                    <SimpleEntitySelector
                      onEntitiesChange={handleEntitiesChange}
                      initialEntities={selectedEntities}
                    />
                  </PopoverContent>
                </Popover>
                
                {/* Emoji Button */}
                <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                    >
                      <Smile size={20} className="text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 border-none" align="start" side={isMobile ? "top" : "bottom"}>
                    <div className="emoji-mart-container overflow-hidden rounded-md border shadow-md">
                      <Picker 
                        data={data}
                        onEmojiSelect={handleEmojiSelect}
                        theme="light"
                        previewPosition="none"
                        set="native"
                        skinTonePosition="none"
                        emojiSize={20}
                        emojiButtonSize={28}
                        maxFrequentRows={2}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Post/Cancel Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  size={isMobile ? "sm" : "default"}
                  className="font-normal"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
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
          </div>
        </div>
      </form>
    </Form>
  );
}
