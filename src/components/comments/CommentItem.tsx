
import { useState, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Edit, Trash, MessageSquareReply } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommentWithReplies } from '@/types/comment';
import { useAuth } from '@/contexts/AuthContext';
import CommentForm from './CommentForm';

interface CommentItemProps {
  comment: CommentWithReplies;
  onReply?: (commentId: string, content: string) => Promise<boolean>;
  onUpdate?: (commentId: string, content: string) => Promise<boolean>;
  onDelete?: (commentId: string) => Promise<boolean>;
}

const CommentItem = ({
  comment,
  onReply,
  onUpdate,
  onDelete
}: CommentItemProps) => {
  const { user } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isOwner = user && user.id === comment.user_id;
  const isDeleted = comment.is_deleted;
  
  // Format comment date
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    
    return format(date, 'MMM d, yyyy');
  }, []);

  const getAvatarInitial = (username: string | null) => {
    return username ? username.charAt(0).toUpperCase() : 'U';
  };
  
  const handleReply = async (content: string) => {
    if (!onReply) return false;
    
    try {
      console.log('Replying to comment:', comment.id, 'with content:', content);
      const success = await onReply(comment.id, content);
      if (success) {
        setIsReplying(false);
      }
      return success;
    } catch (error) {
      console.error('Error in handleReply:', error);
      return false;
    }
  };
  
  const handleUpdate = async (content: string) => {
    if (!onUpdate) return false;
    
    const success = await onUpdate(comment.id, content);
    if (success) {
      setIsEditing(false);
    }
    return success;
  };

  return (
    <div className="flex space-x-3 group" id={`comment-${comment.id}`}>
      <div className="flex-shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.avatar_url || undefined} alt={comment.username || 'User'} />
          <AvatarFallback>{getAvatarInitial(comment.username)}</AvatarFallback>
        </Avatar>
      </div>
      
      <div className="flex-grow space-y-1 min-w-0">
        <div className="bg-muted/40 rounded-lg px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">
                {comment.username || 'Anonymous'}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatDate(comment.created_at)}
              </span>
              {comment.updated_at !== comment.created_at && (
                <span className="text-muted-foreground text-xs">(edited)</span>
              )}
            </div>
            
            {isOwner && !isDeleted && !isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-red-500 focus:text-red-500"
                    onClick={() => onDelete && onDelete(comment.id)}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {isEditing ? (
            <div className="mt-2">
              <CommentForm
                onSubmit={handleUpdate}
                initialContent={comment.content}
                buttonText="Update"
                isEdit={true}
                onCancel={() => setIsEditing(false)}
              />
            </div>
          ) : (
            <div className="mt-1 text-sm whitespace-pre-wrap break-words">
              {isDeleted ? (
                <span className="italic text-muted-foreground">
                  This comment has been deleted.
                </span>
              ) : (
                comment.content
              )}
            </div>
          )}
        </div>
        
        {!isDeleted && onReply && (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setIsReplying(!isReplying)}
            >
              <MessageSquareReply className="mr-1 h-3 w-3" />
              Reply
            </Button>
          </div>
        )}
        
        {isReplying && (
          <div className="mt-2">
            <CommentForm
              onSubmit={handleReply}
              placeholder="Write a reply..."
              buttonText="Reply"
              onCancel={() => setIsReplying(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentItem;
