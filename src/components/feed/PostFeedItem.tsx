
import React, { useState, useEffect } from 'react';
import { PostFeedItem as Post } from '@/hooks/feed/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Heart, MessageSquare, Bookmark } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { EntityDisplay } from './EntityDisplay';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';

interface PostFeedItemProps {
  post: Post;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
  onDelete?: (id: string) => void;
  refreshFeed?: () => void;
}

export default function PostFeedItem({ post, onLike, onSave, onComment, onDelete, refreshFeed }: PostFeedItemProps) {
  const { user } = useAuth();
  const [linkedEntity, setLinkedEntity] = useState<Entity | null>(null);
  
  useEffect(() => {
    const fetchLinkedEntity = async () => {
      const { data: postEntities } = await supabase
        .from('post_entities')
        .select('entity_id')
        .eq('post_id', post.id)
        .maybeSingle();
        
      if (postEntities) {
        const { data: entity } = await supabase
          .from('entities')
          .select('*')
          .eq('id', postEntities.entity_id)
          .maybeSingle();
          
        if (entity) {
          setLinkedEntity(entity);
        }
      }
    };
    
    fetchLinkedEntity();
  }, [post.id]);

  const formatTimeAgo = (dateString: string) => {
    return `${formatDistanceToNow(new Date(dateString))} ago`;
  };

  return (
    <div className="border rounded-lg bg-card p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={post.avatar_url || undefined} alt="User" />
            <AvatarFallback>{post.username?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{post.username || post.user_id}</div>
            <div className="text-sm text-muted-foreground">
              {formatTimeAgo(post.created_at)}
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {user?.id === post.user_id && (
              <DropdownMenuItem
                onClick={() => {
                  if (onDelete) {
                    onDelete(post.id);
                  }
                }}
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {linkedEntity && (
        <EntityDisplay entity={linkedEntity} className="mt-4" />
      )}

      <div className="text-sm">
        {post.content && post.content.startsWith('{') ? (
          <RichTextDisplay content={post.content} />
        ) : (
          <p>{post.content}</p>
        )}
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            className="px-2 flex items-center gap-1"
            onClick={() => {
              if (onLike) {
                onLike(post.id);
              }
            }}
          >
            <Heart className={`h-5 w-5 ${post.is_liked ? "fill-red-500 text-red-500" : ""}`} />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            className="px-2 flex items-center gap-1"
            onClick={() => {
              if (onComment) {
                onComment(post.id);
              }
            }}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm"
          className="px-2 flex items-center gap-1"
          onClick={() => {
            if (onSave) {
              onSave(post.id);
            }
          }}
        >
          <Bookmark className={`h-5 w-5 ${post.is_saved ? "fill-current" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
