import React, { useState, useEffect } from 'react';
import { Post } from '@/hooks/feed/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Heart, MessageSquare, Bookmark, Trash2, HeartOff } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { EntityDisplay } from './EntityDisplay';

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
        .single();
        
      if (postEntities) {
        const { data: entity } = await supabase
          .from('entities')
          .select('*')
          .eq('id', postEntities.entity_id)
          .single();
          
        if (entity) {
          setLinkedEntity(entity);
        }
      }
    };
    
    fetchLinkedEntity();
  }, [post.id]);

  return (
    <div className="border rounded-lg bg-card p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{post.user_id}</div>
            <div className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>
        {user?.id === post.user_id && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (onDelete) {
                    onDelete(post.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {linkedEntity && (
        <EntityDisplay entity={linkedEntity} className="mt-4" />
      )}

      <div className="text-sm">{post.content}</div>
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              if (onLike) {
                onLike(post.id);
              }
            }}
          >
            {post.is_liked ? (
              <Heart className="h-5 w-5 text-red-500" fill="red" />
            ) : (
              <HeartOff className="h-5 w-5" />
            )}
          </Button>
          <Button variant="ghost" size="icon">
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => {
            if (onSave) {
              onSave(post.id);
            }
          }}
        >
          <Bookmark className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
