
import React, { useState } from 'react';
import { format } from 'date-fns';
import { Heart, Reply, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { CommentWithUser } from '@/types/comments';
import { useAuth } from '@/contexts/AuthContext';
import CommentForm from './CommentForm';

interface CommentItemProps {
  comment: CommentWithUser;
  onReply: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string, isLiked: boolean) => void;
  onLoadReplies: (commentId: string) => void;
  isReplyOpen?: boolean;
  hasReplies: boolean;
  repliesLoaded: boolean;
  isLoadingReplies: boolean;
  showReplies: boolean;
  onToggleReplies: () => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onReply,
  onEdit,
  onDelete,
  onLike,
  onLoadReplies,
  isReplyOpen,
  hasReplies,
  repliesLoaded,
  isLoadingReplies,
  showReplies,
  onToggleReplies
}) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else {
        return format(date, 'MMM d, yyyy');
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };
  
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };
  
  const isOwner = user?.id === comment.user_id;
  
  const handleSaveEdit = async (content: string) => {
    await onEdit(comment.id, content);
    setIsEditing(false);
  };
  
  const handleToggleReplies = () => {
    if (!repliesLoaded && hasReplies) {
      onLoadReplies(comment.id);
    }
    onToggleReplies();
  };
  
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex space-x-3">
        <div className="flex-shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.avatar_url || undefined} alt={comment.username || 'User'} />
            <AvatarFallback>{getInitials(comment.username)}</AvatarFallback>
          </Avatar>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="bg-muted/50 px-3 py-2 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm">
                  {comment.username || 'Anonymous'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(comment.created_at)}
                </span>
                {comment.created_at !== comment.updated_at && (
                  <span className="text-xs text-muted-foreground italic">(edited)</span>
                )}
              </div>
              
              {isOwner && !isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(comment.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            {isEditing ? (
              <CommentForm
                initialContent={comment.content}
                onSubmit={handleSaveEdit}
                onCancel={() => setIsEditing(false)}
                isEditing
              />
            ) : (
              <div className="mt-1 text-sm">{comment.content}</div>
            )}
          </div>
          
          {!isEditing && (
            <div className="flex items-center space-x-4 mt-1 ml-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 p-0 text-xs flex items-center space-x-1",
                  comment.is_liked && "text-red-500"
                )}
                onClick={() => onLike(comment.id, comment.is_liked)}
              >
                <Heart 
                  className={cn(
                    "h-3.5 w-3.5", 
                    comment.is_liked && "fill-red-500"
                  )} 
                />
                <span>{comment.likes_count > 0 ? comment.likes_count : ''}</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-7 p-0 text-xs flex items-center space-x-1"
                onClick={() => onReply(comment.id)}
              >
                <Reply className="h-3.5 w-3.5" />
                <span>Reply</span>
              </Button>
              
              {hasReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 p-0 text-xs flex items-center space-x-1"
                  onClick={handleToggleReplies}
                  disabled={isLoadingReplies}
                >
                  {isLoadingReplies ? (
                    <span>Loading...</span>
                  ) : (
                    <>
                      {showReplies ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {showReplies ? 'Hide' : `View ${comment.replies_count}`} 
                        {comment.replies_count === 1 ? ' reply' : ' replies'}
                      </span>
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
          
          {isReplyOpen && (
            <div className="mt-3 ml-[-12px]">
              <CommentForm 
                parentId={comment.id}
                placeholder="Write a reply..."
                onSubmit={async (content) => {
                  await onEdit(comment.id, content);
                  onReply(''); // Close reply form
                }}
                onCancel={() => onReply('')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentItem;
