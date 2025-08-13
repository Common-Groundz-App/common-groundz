
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PostFeedItem } from '@/hooks/feed/types';
import { formatDistanceToNow } from 'date-fns';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';

interface PostCardProps {
  post: PostFeedItem;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.user?.avatar_url || ''} alt={post.user?.username} />
            <AvatarFallback>
              {post.user?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{post.user?.username}</span>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
            </div>
            
            {post.content && (
              <div className="text-sm">
                <RichTextDisplay content={post.content} />
              </div>
            )}
            
            {post.media && post.media.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {post.media.slice(0, 4).map((mediaItem, index) => (
                  <img
                    key={index}
                    src={mediaItem.url}
                    alt={mediaItem.alt || 'Post media'}
                    className="rounded-md object-cover aspect-square"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
