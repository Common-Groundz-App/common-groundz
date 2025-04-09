
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CommentWithUser } from '@/hooks/comments/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CommentItemProps {
  comment: CommentWithUser;
  onLike: () => void;
  onEdit: (content: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onViewReplies: () => void;
  isReply: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onLike,
  onEdit,
  onDelete,
  onViewReplies,
  isReply
}) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isOwner = user?.id === comment.user_id;
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) {
        return 'Just now';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
      } else if (diffInMinutes < 60 * 24) {
        return `${Math.floor(diffInMinutes / 60)}h ago`;
      } else if (diffInMinutes < 60 * 24 * 7) {
        return `${Math.floor(diffInMinutes / (60 * 24))}d ago`;
      } else {
        return format(date, 'MMM d, yyyy');
      }
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  const handleSubmitEdit = async () => {
    if (editContent.trim() === comment.content) {
      setIsEditing(false);
      return;
    }
    
    if (editContent.trim() === '') {
      return;
    }
    
    setIsSubmitting(true);
    const success = await onEdit(editContent.trim());
    setIsSubmitting(false);
    
    if (success) {
      setIsEditing(false);
    }
  };
  
  const handleDeleteClick = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this comment?');
    if (confirmed) {
      await onDelete();
    }
  };
  
  return (
    <div className="flex gap-2">
      <Avatar className="h-8 w-8 mt-1">
        <AvatarImage src={comment.avatar_url || undefined} alt={comment.username || 'User'} />
        <AvatarFallback>{getInitials(comment.username)}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <div className="bg-muted p-3 rounded-lg">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{comment.username || 'Anonymous'}</span>
              <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
            </div>
            
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0">
                    <MoreVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil size={14} className="mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                    <Trash2 size={14} className="mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-2">
              <Textarea 
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px]"
              />
              <div className="flex justify-end gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSubmitEdit}
                  disabled={isSubmitting || editContent.trim() === ''}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4 mt-1 px-1 text-xs text-muted-foreground">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLike} 
            className={cn(
              "h-6 px-1 text-xs",
              comment.is_liked && "text-red-500"
            )}
          >
            <Heart 
              size={14} 
              className={cn(
                "mr-1", 
                comment.is_liked && "fill-red-500"
              )} 
            />
            {comment.like_count || 0} {comment.like_count === 1 ? 'Like' : 'Likes'}
          </Button>
          
          {!isReply && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onViewReplies}
              className="h-6 px-1 text-xs"
            >
              <MessageCircle size={14} className="mr-1" />
              {comment.reply_count || 0} {comment.reply_count === 1 ? 'Reply' : 'Replies'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentItem;
