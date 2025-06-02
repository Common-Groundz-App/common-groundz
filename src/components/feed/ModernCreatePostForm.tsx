
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Users, Globe, Lock, Image as ImageIcon, Smile, Hash, AtSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { MediaUploader } from '@/components/media/MediaUploader';
import { TwitterStyleMediaPreview } from '@/components/feed/TwitterStyleMediaPreview';
import { EntityTagSelector } from '@/components/feed/EntityTagSelector';
import { LocationSearchInput } from '@/components/feed/LocationSearchInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MediaItem } from '@/types/media';
import { PostFeedItem } from '@/hooks/feed/types';
import { feedbackActions } from '@/services/feedbackService';

interface ModernCreatePostFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  postToEdit?: PostFeedItem | null;
}

export const ModernCreatePostForm: React.FC<ModernCreatePostFormProps> = ({
  onSuccess,
  onCancel,
  postToEdit = null
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Form state
  const [content, setContent] = useState(postToEdit?.content || '');
  const [visibility, setVisibility] = useState<'public' | 'circle_only' | 'private'>(
    postToEdit?.visibility || 'public'
  );
  const [media, setMedia] = useState<MediaItem[]>(postToEdit?.media || []);
  const [taggedEntities, setTaggedEntities] = useState<any[]>(postToEdit?.tagged_entities || []);
  const [locationTags, setLocationTags] = useState<string[]>(postToEdit?.tags || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!postToEdit;

  const getVisibilityIcon = (vis: string) => {
    switch(vis) {
      case 'private': return <Lock className="h-4 w-4" />;
      case 'circle_only': return <Users className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getVisibilityLabel = (vis: string) => {
    switch(vis) {
      case 'private': return 'Only Me';
      case 'circle_only': return 'Circle Only';
      default: return 'Public';
    }
  };

  const handleMediaUpload = (newMedia: MediaItem[]) => {
    setMedia(prev => [...prev, ...newMedia]);
  };

  const handleRemoveMedia = (mediaId: string) => {
    setMedia(prev => prev.filter(item => item.id !== mediaId));
  };

  const handleEntityTag = (entity: any) => {
    if (!taggedEntities.some(e => e.id === entity.id)) {
      setTaggedEntities(prev => [...prev, entity]);
    }
  };

  const handleRemoveEntityTag = (entityId: string) => {
    setTaggedEntities(prev => prev.filter(e => e.id !== entityId));
  };

  const handleLocationTag = (location: string) => {
    if (!locationTags.includes(location)) {
      setLocationTags(prev => [...prev, location]);
    }
  };

  const handleRemoveLocationTag = (location: string) => {
    setLocationTags(prev => prev.filter(l => l !== location));
  };

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;

    setIsSubmitting(true);
    try {
      const postData = {
        content: content.trim(),
        visibility,
        media: media.length > 0 ? media : null,
        tags: locationTags.length > 0 ? locationTags : null,
        post_type: 'story' as const,
        status: 'published'
      };

      let result;
      if (isEditing && postToEdit) {
        // Update existing post
        const { data, error } = await supabase
          .from('posts')
          .update(postData)
          .eq('id', postToEdit.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new post
        const { data, error } = await supabase
          .from('posts')
          .insert({
            ...postData,
            user_id: user.id
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      // Handle entity tagging
      if (taggedEntities.length > 0) {
        // First, clear existing entity tags if editing
        if (isEditing && postToEdit) {
          await supabase
            .from('post_entities')
            .delete()
            .eq('post_id', postToEdit.id);
        }

        // Insert new entity tags
        const entityInserts = taggedEntities.map(entity => ({
          post_id: result.id,
          entity_id: entity.id
        }));

        const { error: entityError } = await supabase
          .from('post_entities')
          .insert(entityInserts);

        if (entityError) {
          console.error('Error tagging entities:', entityError);
        }
      }

      // Trigger haptic and sound feedback for successful post creation/edit
      try {
        feedbackActions.post();
      } catch (error) {
        console.error('Error triggering post feedback:', error);
      }

      toast({
        title: isEditing ? 'Post updated' : 'Post created',
        description: isEditing 
          ? 'Your post has been updated successfully' 
          : 'Your post has been shared successfully'
      });

      // Reset form
      if (!isEditing) {
        setContent('');
        setMedia([]);
        setTaggedEntities([]);
        setLocationTags([]);
        setVisibility('public');
      }

      if (onSuccess) {
        onSuccess();
      }

      // Dispatch refresh events
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refresh-feed'));
        window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
      }, 100);

    } catch (error) {
      console.error('Error submitting post:', error);
      toast({
        title: 'Error',
        description: isEditing ? 'Failed to update post' : 'Failed to create post',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {isEditing ? 'Edit Post' : 'Create Post'}
          </h3>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content Editor */}
        <div>
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="What's on your mind?"
            className="min-h-[120px]"
          />
        </div>

        {/* Media Preview */}
        {media.length > 0 && (
          <TwitterStyleMediaPreview
            media={media}
            onRemove={handleRemoveMedia}
            className="rounded-lg"
          />
        )}

        {/* Tagged Entities */}
        {taggedEntities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {taggedEntities.map(entity => (
              <Badge
                key={entity.id}
                variant="secondary"
                className="flex items-center gap-1"
              >
                <AtSign className="h-3 w-3" />
                {entity.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemoveEntityTag(entity.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Location Tags */}
        {locationTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {locationTags.map(location => (
              <Badge
                key={location}
                variant="outline"
                className="flex items-center gap-1"
              >
                <MapPin className="h-3 w-3" />
                {location}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemoveLocationTag(location)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <MediaUploader onUpload={handleMediaUpload}>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <ImageIcon className="h-5 w-5" />
              </Button>
            </MediaUploader>
            
            <EntityTagSelector onEntitySelect={handleEntityTag}>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <AtSign className="h-5 w-5" />
              </Button>
            </EntityTagSelector>
            
            <LocationSearchInput onLocationSelect={handleLocationTag}>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <MapPin className="h-5 w-5" />
              </Button>
            </LocationSearchInput>
          </div>

          <div className="flex items-center gap-3">
            {/* Visibility Selector */}
            <Select value={visibility} onValueChange={(value: any) => setVisibility(value)}>
              <SelectTrigger className="w-auto">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {getVisibilityIcon(visibility)}
                    <span className="hidden sm:inline">{getVisibilityLabel(visibility)}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Public
                  </div>
                </SelectItem>
                <SelectItem value="circle_only">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Circle Only
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Only Me
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className="min-w-[80px]"
            >
              {isSubmitting ? 'Posting...' : (isEditing ? 'Update' : 'Post')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
