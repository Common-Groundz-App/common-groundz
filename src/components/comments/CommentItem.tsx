
import React, { useState } from 'react';
import { CommentWithUser } from '@/types/comments';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, MoreVertical, Trash, Pencil } from 'lucide-react';
import CommentForm from './CommentForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface CommentItemProps {
  comment: CommentWithUser;
  onEdit: (content: string) => Promise<any>;
  onDelete: () => Promise<void>;
  onLike: () => Promise<void>;
  onReply: () => void;
  isReplying: boolean;
  onCancelReply: () => void;
  onSubmitReply: (content: string) => Promise<any>;
  replies: CommentWithUser[];
  isLoadingReplies: boolean;
  hasLoadedReplies: boolean;
  onLoadReplies: () => Promise<void>;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onEdit,
  onDelete,
  onLike,
  onReply,
  isReplying,
  onCancelReply,
  onSubmitReply,
  replies = [],
  isLoadingReplies,
  hasLoadedReplies,
  onLoadReplies,
}) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  const isOwner = user?.id === comment.user_id;
  
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy • h:mm a');
  };
  
  const handleEditSubmit = async (content: string) => {
    await onEdit(content);
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.avatar_url || undefined} alt={comment.username || 'User'} />
          <AvatarFallback>{getInitials(comment.username)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{comment.username || 'Anonymous'}</span>
            <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
          </div>
          
          {isEditing ? (
            <CommentForm
              initialContent={comment.content}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditing(false)}
              isEditing={true}
            />
          ) : (
            <div className="text-sm">{comment.content}</div>
          )}
          
          {!isEditing && (
            <div className="flex items-center gap-4 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "p-0 h-auto text-xs font-medium flex items-center gap-1",
                  comment.is_liked && "text-red-500"
                )}
                onClick={onLike}
              >
                <Heart size={14} className={cn(comment.is_liked && "fill-red-500")} />
                {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
                {comment.is_liked ? "Liked" : "Like"}
              </Button>
              
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto text-xs font-medium"
                  onClick={onReply}
                >
                  <MessageCircle size={14} className="mr-1" />
                  Reply
                </Button>
              )}
              
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreVertical size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil size={14} className="mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDelete} className="text-red-500 focus:text-red-500">
                      <Trash size={14} className="mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
          
          {/* Reply form */}
          {isReplying && (
            <div className="mt-3">
              <CommentForm
                placeholder="Write a reply..."
                onSubmit={onSubmitReply}
                onCancel={onCancelReply}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Show replies or load replies button */}
      {comment.replies_count > 0 && !hasLoadedReplies && (
        <div className="ml-11">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground flex items-center"
            onClick={onLoadReplies}
            disabled={isLoadingReplies}
          >
            <MessageCircle size={14} className="mr-1" />
            {isLoadingReplies ? 'Loading...' : `Show ${comment.replies_count} ${comment.replies_count === 1 ? 'reply' : 'replies'}`}
          </Button>
        </div>
      )}
      
      {/* Loading replies skeleton */}
      {isLoadingReplies && (
        <div className="ml-11 space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-muted"></div>
              <div className="flex-1 space-y-1">
                <div className="h-3 w-20 bg-muted rounded"></div>
                <div className="h-2 w-full bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Replies list */}
      {replies.length > 0 && (
        <div className="ml-11 space-y-4">
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onEdit={(content) => onEdit(content)}
              onDelete={onDelete}
              onLike={() => onLike()}
              onReply={() => {}}
              isReplying={false}
              onCancelReply={() => {}}
              onSubmitReply={() => Promise.resolve()}
              replies={[]}
              isLoadingReplies={false}
              hasLoadedReplies={true}
              onLoadReplies={() => Promise.resolve()}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;
