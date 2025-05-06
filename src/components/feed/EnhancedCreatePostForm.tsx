import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MediaUploader } from '@/components/media/MediaUploader';
import { UserAvatar } from '@/components/ui/user-avatar';
import { SimpleEntitySelector } from '@/components/feed/SimpleEntitySelector';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { Badge } from '@/components/ui/badge';
import { X, Image, Smile, Tag, MapPin, MoreHorizontal, Globe, Lock, Users } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getDisplayName } from '@/services/profileService';
import { TwitterStyleMediaPreview } from '@/components/media/TwitterStyleMediaPreview';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// Emoji picker styles are now in global CSS (index.css)

interface EnhancedCreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  profileData?: any;
}

type VisibilityOption = 'public' | 'private' | 'circle';

// Map UI visibility types to database visibility types
const mapVisibilityToDatabase = (visibility: VisibilityOption): 'public' | 'private' | 'circle_only' => {
  switch (visibility) {
    case 'public': return 'public';
    case 'private': return 'private';
    case 'circle': return 'circle_only';
    default: return 'public';
  }
};

export function EnhancedCreatePostForm({ onSuccess, onCancel, profileData }: EnhancedCreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitySelectorVisible, setEntitySelectorVisible] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityOption>('public');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(uuidv4()).current;
  const [cursorPosition, setCursorPosition] = useState<{ start: number, end: number }>({ start: 0, end: 0 });
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const MAX_MEDIA_COUNT = 4;
  
  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Handle click outside for emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerVisible && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setEmojiPickerVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [emojiPickerVisible]);

  // Save cursor position when textarea is focused or clicked
  const saveCursorPosition = () => {
    if (textareaRef.current) {
      setCursorPosition({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd
      });
    }
  };

  // Handle emoji selection and insertion
  const handleEmojiSelect = (emoji: any) => {
    if (textareaRef.current) {
      const start = cursorPosition.start;
      const end = cursorPosition.end;
      
      // Insert emoji at cursor position
      const newContent = 
        content.substring(0, start) + 
        emoji.native + 
        content.substring(end);
      
      setContent(newContent);
      
      // Update cursor position for next insertion
      const newPosition = start + emoji.native.length;
      setCursorPosition({ start: newPosition, end: newPosition });
      
      // Focus back on textarea and set cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPosition, newPosition);
          
          // Ensure textarea height is adjusted
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      }, 10);
    }
    
    // Close emoji picker after selection
    setEmojiPickerVisible(false);
  };

  // Handle keyboard shortcut for posting (Cmd/Ctrl + Enter)
  useEffect(() => {
    const isPostButtonDisabled = (!content.trim() && media.length === 0) || isSubmitting;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isPostButtonDisabled) {
        handleSubmit();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [content, media, isSubmitting]);

  // Handle drag and drop for the entire form
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (formRef.current) {
        formRef.current.classList.add('bg-accent/20');
      }
    };
    
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (formRef.current) {
        formRef.current.classList.remove('bg-accent/20');
      }
    };
    
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      if (formRef.current) {
        formRef.current.classList.remove('bg-accent/20');
      }
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
          // Handle file upload logic here if you have direct access
          // For now, we'll let the MediaUploader handle it
        }
      }
    };
    
    const currentRef = formRef.current;
    if (currentRef) {
      currentRef.addEventListener('dragover', handleDragOver, { passive: true });
      currentRef.addEventListener('dragleave', handleDragLeave, { passive: true });
      currentRef.addEventListener('drop', handleDrop);
    }
    
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('dragover', handleDragOver);
        currentRef.removeEventListener('dragleave', handleDragLeave);
        currentRef.removeEventListener('drop', handleDrop);
      }
    };
  }, []);

  const handleMediaUpload = (mediaItem: MediaItem) => {
    if (media.length < MAX_MEDIA_COUNT) {
      setMedia((prev) => [...prev, { ...mediaItem, order: prev.length }]);
    } else {
      toast({
        title: 'Media limit reached',
        description: `You can only upload up to ${MAX_MEDIA_COUNT} media items`,
        variant: 'destructive',
      });
    }
  };

  const removeMedia = (itemToRemove: MediaItem) => {
    setMedia((prev) => 
      prev
        .filter((item) => item.url !== itemToRemove.url)
        .map((item, index) => ({ ...item, order: index }))
    );
  };

  const handleEntitiesChange = (newEntities: Entity[]) => {
    setEntities(newEntities);
    setEntitySelectorVisible(false);
  };

  const removeEntity = (entityId: string) => {
    setEntities(prev => prev.filter(entity => entity.id !== entityId));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create posts',
        variant: 'destructive',
      });
      return;
    }

    if (!content.trim() && media.length === 0) {
      toast({
        title: 'Empty post',
        description: 'Please add some content or media to your post',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Map visibility to database enum type
      const dbVisibility = mapVisibilityToDatabase(visibility);
      
      // Clean media items for database
      const mediaToSave = media.map(item => ({
        id: item.id || uuidv4(),
        url: item.url,
        type: item.type,
        caption: item.caption || '',
        alt: item.alt || '',
        order: item.order,
        is_deleted: false,
        thumbnail_url: item.thumbnail_url || item.url
      }));

      // Store location in media metadata if it exists
      let postMetadata = {};
      if (location) {
        postMetadata = { location };
      }

      // Prepare post data for database - explicitly type the post_type
      // IMPORTANT: Remove location field as it doesn't exist in the database schema
      const postData = {
        content,
        media: mediaToSave,
        visibility: dbVisibility,
        user_id: user.id,
        post_type: 'story' as 'story' | 'routine' | 'project' | 'note', // Explicit type casting
        // We can optionally store location in tags or metadata if needed
        tags: location ? [location] : undefined,
      };

      console.log('Submitting post:', postData);
      
      // Save to database
      const { data: newPost, error } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      console.log('Post created:', newPost);
      
      // Add entity relationships if any
      if (entities.length > 0 && newPost) {
        for (const entity of entities) {
          const { error: entityError } = await supabase
            .from('post_entities')
            .insert({
              post_id: newPost.id,
              entity_id: entity.id
            });
            
          if (entityError) {
            console.error('Error saving entity relationship:', entityError);
          }
        }
      }
      
      toast({
        title: 'Post created',
        description: 'Your post has been published successfully',
      });

      // Trigger refresh events for various parts of the app
      window.dispatchEvent(new CustomEvent('refresh-for-you-feed'));
      window.dispatchEvent(new CustomEvent('refresh-following-feed'));
      window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
      window.dispatchEvent(new CustomEvent('refresh-posts'));

      // Reset form and notify parent
      onSuccess();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Error',
        description: 'Failed to create post. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  function getVisibilityIcon() {
    switch (visibility) {
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'circle':
        return <Users className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  }

  function getEntityIcon(type: string) {
    switch (type) {
      case 'place':
        return '🏠';
      case 'food':
        return '🍽️';
      case 'movie':
        return '🎬';
      case 'book':
        return '📚';
      case 'product':
        return '💄';
      default:
        return '🏷️';
    }
  }

  // Computed properties
  const isPostButtonDisabled = (!content.trim() && media.length === 0) || isSubmitting;
  
  // Get user display name using the profileData or fallback to user metadata
  const userDisplayName = user ? (
    profileData ? getDisplayName(user, profileData) : 
    (user.user_metadata?.username || user.email?.split('@')[0] || 'User')
  ) : 'User';

  // Get avatar URL from profileData
  const avatarUrl = profileData?.avatar_url || null;

  return (
    <div 
      ref={formRef} 
      className="bg-background rounded-xl shadow-sm p-5 transition-all"
    >
      {/* User Info + Text Input */}
      <div className="flex gap-3">
        <UserAvatar 
          username={userDisplayName} 
          imageUrl={avatarUrl}
          className="h-10 w-10 cursor-pointer hover:opacity-90 transition-opacity"
        />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{userDisplayName}</p>
          <Textarea
            ref={textareaRef}
            placeholder="What do you want to share today?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] resize-none border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/70"
            onClick={saveCursorPosition}
            onKeyUp={saveCursorPosition}
            onFocus={saveCursorPosition}
          />
        </div>
      </div>

      {/* Twitter Style Media Preview */}
      {media.length > 0 && (
        <TwitterStyleMediaPreview
          media={media}
          onRemove={removeMedia}
        />
      )}

      {/* Entity Tags */}
      {entities.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {entities.map((entity) => (
            <Badge 
              key={entity.id} 
              variant="outline" 
              className="gap-1 pl-2 pr-1 py-1 flex items-center text-xs bg-accent/30"
            >
              <span>{getEntityIcon(entity.type)}</span>
              <span>{entity.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 rounded-full hover:bg-muted"
                onClick={() => removeEntity(entity.id)}
              >
                <X size={10} />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Entity Selector (only shown when tag button is clicked) */}
      {entitySelectorVisible && (
        <div className="mt-3 p-3 border rounded-lg bg-background animate-fade-in">
          <SimpleEntitySelector 
            onEntitiesChange={handleEntitiesChange}
            initialEntities={entities}
          />
        </div>
      )}

      {/* Location Input (only shown when location button is clicked) */}
      {showLocationInput && (
        <div className="flex items-center gap-2 mt-3 animate-fade-in">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Add location"
            className="flex-1 border-b bg-transparent text-sm py-1 focus:outline-none"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLocationInput(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        {/* Left: Toolbar */}
        <div className="flex items-center gap-1">
          <MediaUploader
            sessionId={sessionId}
            onMediaUploaded={handleMediaUpload}
            initialMedia={media}
            maxMediaCount={MAX_MEDIA_COUNT}
            customButton={
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full p-2 hover:bg-accent hover:text-accent-foreground",
                  media.length >= MAX_MEDIA_COUNT && "opacity-50 cursor-not-allowed"
                )}
                disabled={media.length >= MAX_MEDIA_COUNT}
              >
                <Image className="h-5 w-5" />
                {media.length > 0 && (
                  <span className="ml-1 text-xs font-medium">
                    {media.length}/{MAX_MEDIA_COUNT}
                  </span>
                )}
              </Button>
            }
          />
          
          {/* Emoji Button - Improved implementation */}
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full p-2 hover:bg-accent hover:text-accent-foreground",
                emojiPickerVisible && "bg-accent/50 text-accent-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                saveCursorPosition();
                setEmojiPickerVisible(!emojiPickerVisible);
              }}
            >
              <Smile className="h-5 w-5" />
            </Button>
            
            {emojiPickerVisible && (
              <div 
                ref={emojiPickerRef}
                className="absolute z-50 bottom-full mb-2 left-0 emoji-picker-wrapper"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
              >
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
                  modalish={false}
                  showSkinTones={false}
                />
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-full p-2 hover:bg-accent hover:text-accent-foreground",
              entitySelectorVisible && "bg-accent/50 text-accent-foreground"
            )}
            onClick={() => setEntitySelectorVisible(!entitySelectorVisible)}
          >
            <Tag className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-full p-2 hover:bg-accent hover:text-accent-foreground",
              showLocationInput && "bg-accent/50 text-accent-foreground"
            )}
            onClick={() => setShowLocationInput(!showLocationInput)}
          >
            <MapPin className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full p-2 hover:bg-accent hover:text-accent-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        {/* Right: Visibility + Post Actions */}
        <div className="flex items-center gap-2">
          <Select
            value={visibility}
            onValueChange={(value: VisibilityOption) => setVisibility(value)}
          >
            <SelectTrigger className="w-[130px] h-9 border-none">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {getVisibilityIcon()}
                  <span>
                    {visibility === 'public' ? 'Public' : 
                     visibility === 'private' ? 'Only Me' : 
                     'Circle Only'}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>Public</span>
                </div>
              </SelectItem>
              <SelectItem value="private">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span>Only Me</span>
                </div>
              </SelectItem>
              <SelectItem value="circle">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Circle Only</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={onCancel} 
            disabled={isSubmitting}
            className="hover:bg-accent/50"
          >
            Cancel
          </Button>
          
          <Button 
            className={cn(
              "bg-brand-orange hover:bg-brand-orange/90 transition-all",
              (!isPostButtonDisabled && !isSubmitting) && "animate-fade-in"
            )}
            onClick={handleSubmit} 
            disabled={isPostButtonDisabled}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin" /> 
                <span>Posting...</span>
              </div>
            ) : (
              <span>Post</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
