
import React, { useState, useRef, useEffect } from 'react';
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

interface EnhancedCreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type VisibilityOption = 'public' | 'private' | 'circle';

export function EnhancedCreatePostForm({ onSuccess, onCancel }: EnhancedCreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitySelectorVisible, setEntitySelectorVisible] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityOption>('public');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionId = useRef(uuidv4()).current;

  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleMediaUpload = (mediaItem: MediaItem) => {
    if (media.length < 4) {
      setMedia((prev) => [...prev, { ...mediaItem, order: prev.length }]);
    } else {
      toast({
        title: 'Media limit reached',
        description: 'You can only upload up to 4 media items',
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

      // Prepare post data
      const postData = {
        content,
        media,
        entities: entities.map(entity => entity.id),
        visibility,
        location: location || null,
      };

      // Here we would normally submit the post data
      console.log('Submitting post:', postData);
      
      // Mock submission delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Post created',
        description: 'Your post has been published successfully',
      });

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

  const getVisibilityIcon = () => {
    switch (visibility) {
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'circle':
        return <Users className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'place':
        return <MapPin className="h-3 w-3" />;
      case 'food':
        return <span className="text-xs">🍟</span>;
      case 'movie':
        return <span className="text-xs">🎬</span>;
      case 'book':
        return <span className="text-xs">📚</span>;
      case 'product':
        return <span className="text-xs">💄</span>;
      default:
        return <Tag className="h-3 w-3" />;
    }
  };

  const isPostButtonDisabled = (!content.trim() && media.length === 0) || isSubmitting;

  return (
    <div className="bg-background rounded-2xl shadow-md p-4 space-y-4">
      {/* Section 1: User Info + Text Input */}
      <div className="flex gap-3">
        <UserAvatar 
          username={user?.username} 
          imageUrl={user?.avatar_url}
          className="h-10 w-10"
        />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{user?.username || 'User'}</p>
          <Textarea
            ref={textareaRef}
            placeholder="What do you want to share today?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] resize-none border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* Section 2: Media Upload Preview */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {media.map((item) => (
            <div 
              key={item.url} 
              className="relative rounded-lg overflow-hidden aspect-video bg-muted"
            >
              {item.type === 'image' ? (
                <img 
                  src={item.url} 
                  alt={item.alt || 'Uploaded media'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <video 
                  src={item.url} 
                  controls={false} 
                  className="w-full h-full object-cover"
                />
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-80 hover:opacity-100"
                onClick={() => removeMedia(item)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Section 3: Entity Tags */}
      {entities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entities.map((entity) => (
            <Badge 
              key={entity.id} 
              variant="outline" 
              className="gap-1 pl-2 pr-1 py-1 flex items-center text-xs"
            >
              {getEntityIcon(entity.type)}
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
        <div className="mt-2 p-3 border rounded-lg bg-background">
          <SimpleEntitySelector 
            onEntitiesChange={handleEntitiesChange}
            initialEntities={entities}
          />
        </div>
      )}

      {/* Location Input (only shown when location button is clicked) */}
      {showLocationInput && (
        <div className="flex items-center gap-2">
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

      {/* Section 4 & 5 & 6: Bottom Toolbar + Visibility + Post Actions */}
      <div className="flex items-center justify-between border-t pt-3">
        {/* Left: Toolbar */}
        <div className="flex items-center gap-1">
          <MediaUploader
            sessionId={sessionId}
            onMediaUploaded={handleMediaUpload}
            initialMedia={media}
            customButton={
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full p-2 hover:bg-accent hover:text-accent-foreground",
                  media.length >= 4 && "opacity-50 cursor-not-allowed"
                )}
                disabled={media.length >= 4}
              >
                <Image className="h-5 w-5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full p-2 hover:bg-accent hover:text-accent-foreground"
          >
            <Smile className="h-5 w-5" />
          </Button>
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
          
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          
          <Button 
            className="bg-brand-orange hover:bg-brand-orange/90"
            onClick={handleSubmit} 
            disabled={isPostButtonDisabled}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin" /> 
                Posting...
              </div>
            ) : 'Post'}
          </Button>
        </div>
      </div>
    </div>
  );
}
