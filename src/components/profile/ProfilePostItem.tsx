
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';

interface Post {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  created_at: string;
  updated_at: string;
  tagged_entities?: Entity[];
  media?: MediaItem[];
}

interface ProfilePostItemProps {
  post: Post;
}

const ProfilePostItem = ({ post }: ProfilePostItemProps) => {
  const getPostTypeLabel = (type: string) => {
    switch(type) {
      case 'story': return 'Story';
      case 'routine': return 'Routine';
      case 'project': return 'Project';
      case 'note': return 'Note';
      default: return type;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch(visibility) {
      case 'public': return 'Public';
      case 'circle_only': return 'Circle Only';
      case 'private': return 'Private';
      default: return visibility;
    }
  };
  
  const getEntityTypeColor = (type: string): string => {
    switch(type) {
      case 'book': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'movie': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'place': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'product': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'food': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return '';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold">{post.title}</h3>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{getPostTypeLabel(post.post_type)}</Badge>
              <Badge variant="outline" className={post.visibility !== 'public' ? 'bg-muted' : ''}>
                {getVisibilityLabel(post.visibility)}
              </Badge>
            </div>
          </div>
          <div className="flex items-center text-muted-foreground text-sm">
            <Clock size={14} className="mr-1" />
            <span>{format(new Date(post.created_at), 'MMM d, yyyy')}</span>
          </div>
        </div>
        
        <div className="text-muted-foreground">
          <RichTextDisplay content={post.content} />
        </div>
        
        {/* Display media items if available */}
        {post.media && post.media.length > 0 && (
          <div className="mt-4">
            <PostMediaDisplay 
              media={post.media}
              displayType={post.media.length > 1 ? 'carousel' : 'grid'} 
            />
          </div>
        )}
        
        {/* Display tagged entities */}
        {post.tagged_entities && post.tagged_entities.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <Tag size={14} />
              <span>Tagged:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {post.tagged_entities.map(entity => (
                <Badge
                  key={entity.id}
                  className={cn("font-normal", getEntityTypeColor(entity.type))}
                  variant="outline"
                >
                  {entity.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfilePostItem;
