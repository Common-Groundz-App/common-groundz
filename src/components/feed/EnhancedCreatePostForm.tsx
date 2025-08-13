
import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MediaUploader } from '@/components/media/MediaUploader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SimpleEntitySelector } from '@/components/feed/SimpleEntitySelector';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { createPost, updatePost } from '@/services/postService';
import { insertPostEntity } from '@/services/postEntityService';
import { processPostHashtags, parseHashtags } from '@/services/hashtagService';
import { Loader2, X, Hash } from 'lucide-react';

interface EnhancedCreatePostFormProps {
  onSuccess?: (post: any) => void;
  existingPost?: any;
  isEditing?: boolean;
  onCancel?: () => void;
}

export function EnhancedCreatePostForm({ 
  onSuccess, 
  existingPost, 
  isEditing = false,
  onCancel 
}: EnhancedCreatePostFormProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Add hashtag preview state
  const [detectedHashtags, setDetectedHashtags] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setUserDisplayName(user.user_metadata?.username || user.email);
      setAvatarUrl(user.user_metadata?.avatar_url || null);
    }
  }, [user]);

  useEffect(() => {
    if (isEditing && existingPost) {
      setContent(existingPost.content || '');
      setMediaItems(existingPost.media || []);
      
      // Set initial entities if available
      if (existingPost.tags && Array.isArray(existingPost.tags)) {
        setSelectedEntities(existingPost.tags.map((tag: string) => ({
          id: tag, // Assuming tag can be used as a temporary ID
          name: tag,
          type: 'unknown'
        })));
      }
    }
  }, [isEditing, existingPost]);

  const handleMediaUploaded = (newMedia: MediaItem[]) => {
    setMediaItems([...mediaItems, ...newMedia]);
  };

  const handleMediaRemove = (mediaToRemove: MediaItem) => {
    setMediaItems(mediaItems.filter(media => media.url !== mediaToRemove.url));
  };

  const handleEntitySelect = (entity: Entity) => {
    setSelectedEntities([...selectedEntities, entity]);
  };

  const handleEntityRemove = (entityToRemove: Entity) => {
    setSelectedEntities(selectedEntities.filter(entity => entity.id !== entityToRemove.id));
  };

  // Update content change handler to detect hashtags
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Update detected hashtags for preview
    const hashtags = parseHashtags(newContent);
    const uniqueNormalized = [...new Set(hashtags.map(h => h.normalized))];
    setDetectedHashtags(uniqueNormalized);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || isSubmitting) return;
    
    if (!content.trim() && mediaItems.length === 0) {
      toast({
        title: 'Content required',
        description: 'Please add some content or media to your post.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let newPost;
      
      if (isEditing && existingPost) {
        // Update existing post
        newPost = await updatePost(existingPost.id, {
          content: content.trim(),
          media: mediaItems,
          tags: selectedEntities.map(entity => entity.name),
        });
      } else {
        // Create new post
        newPost = await createPost({
          content: content.trim(),
          post_type: 'text',
          visibility: 'public',
          media: mediaItems,
          tags: selectedEntities.map(entity => entity.name),
        });
      }

      if (newPost) {
        // Process hashtags AFTER post creation/update (handles both new and edited posts)
        await processPostHashtags(newPost.id, content);
        
        // Handle entity relationships
        if (selectedEntities.length > 0) {
          await Promise.all(
            selectedEntities.map(entity => insertPostEntity(newPost.id, entity.id))
          );
        }

        toast({
          title: isEditing ? 'Post updated!' : 'Post created!',
          description: isEditing ? 'Your post has been updated successfully.' : 'Your post has been shared successfully.',
        });

        // Reset form
        setContent('');
        setMediaItems([]);
        setSelectedEntities([]);
        setDetectedHashtags([]);
        
        // Call success callback
        onSuccess?.(newPost);
      }
    } catch (error: any) {
      console.error('Error creating/updating post:', error);
      toast({
        title: 'Error',
        description: error.message || `Failed to ${isEditing ? 'update' : 'create'} post. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session || !user) {
    return <p>Please sign in to create a post.</p>;
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className="bg-white rounded-lg border border-gray-200 p-4 space-y-4"
    >
      {/* User Info + Text Input */}
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 cursor-pointer hover:opacity-90 transition-opacity">
          <AvatarImage src={avatarUrl || ''} alt={userDisplayName} />
          <AvatarFallback className="bg-brand-orange text-white font-semibold">
            {userDisplayName?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{userDisplayName}</p>
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="What's on your mind?"
            className="min-h-[80px] resize-none border-0 p-0 text-base placeholder:text-gray-500 focus-visible:ring-0 shadow-none"
            style={{ height: 'auto' }}
          />
        </div>
      </div>

      {/* Hashtag Preview */}
      {detectedHashtags.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hash className="h-4 w-4" />
            <span>Detected hashtags:</span>
          </div>
          {detectedHashtags.map(tag => (
            <span key={tag} className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Media Display + Uploader */}
      {mediaItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {mediaItems.map((media, index) => (
            <div key={index} className="relative">
              <img
                src={media.url}
                alt="Media Preview"
                className="h-20 w-20 object-cover rounded-md"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-6 w-6 p-0 hover:bg-gray-200/80"
                onClick={() => handleMediaRemove(media)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <MediaUploader onMediaUploaded={handleMediaUploaded} />

      {/* Entity Selector - commented out for now since SimpleEntitySelector may not exist */}
      {/* <SimpleEntitySelector
        selectedEntities={selectedEntities}
        onEntitySelect={handleEntitySelect}
        onEntityRemove={handleEntityRemove}
      /> */}

      {/* Submit Buttons */}
      <div className="flex justify-end gap-2">
        {isEditing && onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              {isEditing ? 'Updating...' : 'Creating...'}
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            </>
          ) : (
            isEditing ? 'Update Post' : 'Create Post'
          )}
        </Button>
      </div>
    </form>
  );
}
