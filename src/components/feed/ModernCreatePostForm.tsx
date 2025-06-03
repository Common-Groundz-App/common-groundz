
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Lock, Users, X, MapPin, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { PostFeedItem } from '@/hooks/feed/types';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaItem } from '@/types/media';
import { LocationSearchInput } from './LocationSearchInput';
import TagInput from '@/components/preferences/TagInput';

export interface ModernCreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  defaultPostType?: string;
  postToEdit?: PostFeedItem;
  profileData?: any;
}

export const ModernCreatePostForm: React.FC<ModernCreatePostFormProps> = ({
  onSuccess,
  onCancel,
  defaultPostType = 'story',
  postToEdit,
  profileData
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [content, setContent] = useState(postToEdit?.content || '');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'circle_only'>(postToEdit?.visibility || 'public');
  const [media, setMedia] = useState<MediaItem[]>(postToEdit?.media || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tags, setTags] = useState<string[]>(postToEdit?.tags || []);
  const [postType, setPostType] = useState<'story' | 'routine' | 'project' | 'note'>(
    (postToEdit?.post_type as 'story' | 'routine' | 'project' | 'note') || 'story'
  );

  const handleSubmit = async () => {
    if (!user) return;
    
    if (!content.trim() && media.length === 0) {
      toast({
        title: "Content required",
        description: "Please add some content or media to your post",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (postToEdit) {
        // Update existing post
        const { error } = await supabase
          .from('posts')
          .update({
            content: content.trim(),
            visibility,
            media: media as any,
            tags,
            post_type: postType,
            status: 'published'
          })
          .eq('id', postToEdit.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new post
        const { error } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            content: content.trim(),
            visibility,
            media: media as any,
            tags,
            post_type: postType,
            status: 'published'
          });

        if (error) throw error;
      }

      toast({
        title: postToEdit ? "Post updated" : "Post created",
        description: postToEdit ? "Your post has been updated successfully" : "Your post has been shared successfully"
      });

      onSuccess();
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: "Error",
        description: postToEdit ? "Failed to update post" : "Failed to create post",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVisibilityIcon = () => {
    switch(visibility) {
      case 'private': return <Lock className="h-4 w-4" />;
      case 'circle_only': return <Users className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getVisibilityLabel = () => {
    switch(visibility) {
      case 'private': return 'Only Me';
      case 'circle_only': return 'Circle Only';
      default: return 'Public';
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const handleMediaUploaded = (newMedia: MediaItem[]) => {
    setMedia(newMedia);
  };

  const handleContentChange = (_json: object, html: string) => {
    setContent(html);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {postToEdit ? 'Edit Post' : 'Create Post'}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* User Info */}
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.username || 'You'} />
            <AvatarFallback>{getInitials(user?.user_metadata?.username)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium">{user?.user_metadata?.username || 'You'}</div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Select value={visibility} onValueChange={(value: 'public' | 'private' | 'circle_only') => setVisibility(value)}>
                <SelectTrigger className="w-auto h-auto p-1 border-0 bg-transparent">
                  <div className="flex items-center space-x-1">
                    {getVisibilityIcon()}
                    <span>{getVisibilityLabel()}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4" />
                      <span>Public</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="circle_only">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Circle Only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center space-x-2">
                      <Lock className="h-4 w-4" />
                      <span>Only Me</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Post Type Selection */}
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs">
            <Tag className="h-3 w-3 mr-1" />
            Post Type
          </Badge>
          <Select value={postType} onValueChange={(value: 'story' | 'routine' | 'project' | 'note') => setPostType(value)}>
            <SelectTrigger className="w-auto h-auto p-1 border-0 bg-transparent text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="routine">Routine</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="note">Note</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Editor */}
        <div className="space-y-3">
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            placeholder="What's on your mind?"
            className="min-h-[120px] border-0 p-0 focus-visible:ring-0"
          />
        </div>

        {/* Media Upload */}
        <MediaUploader
          onMediaUploaded={handleMediaUploaded}
          existingMedia={media}
          maxFiles={4}
        />

        {/* Tags */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Tag className="h-4 w-4" />
            <span>Tags</span>
          </div>
          <TagInput
            tags={tags}
            onTagsChange={setTags}
            placeholder="Add tags..."
            maxTags={10}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (postToEdit ? 'Updating...' : 'Posting...') : (postToEdit ? 'Update' : 'Post')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModernCreatePostForm;
