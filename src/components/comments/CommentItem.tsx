
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { format } from 'date-fns';
import { MoreVertical, MessageCircle, Trash, Edit, Reply } from 'lucide-react';
import { Comment } from '@/hooks/comments/types';
import { cn } from '@/lib/utils';

interface CommentItemProps {
  comment: Comment;
  onReply: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onViewReplies?: (commentId: string) => void;
  isReply?: boolean;
  className?: string;
}

export const CommentItem = ({
  comment,
  onReply,
  onEdit,
  onDelete,
  onViewReplies,
  isReply = false,
  className
}: CommentItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  
  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(comment.content);
  };
  
  const handleSaveEdit = () => {
    onEdit(comment.id, editContent);
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const renderDate = () => {
    const date = new Date(comment.created_at);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    return format(date, 'MMM d, yyyy');
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className={cn("flex space-x-3", className)}>
      <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
        <AvatarImage src={comment.avatar_url || undefined} />
        <AvatarFallback>{getInitials(comment.username)}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <span className="font-medium text-sm mr-2">{comment.username || 'Anonymous'}</span>
              <span className="text-muted-foreground text-xs">{renderDate()}</span>
            </div>
            
            {comment.is_own_comment && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit size={14} className="mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete(comment.id)}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash size={14} className="mr-2" />
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
                className="w-full min-h-[80px]"
              />
              <div className="flex justify-end space-x-2">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
          )}
        </div>
        
        <div className="flex items-center mt-1 pl-1 space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-muted-foreground text-xs flex items-center"
            onClick={() => onReply(comment.id)}
          >
            <Reply size={14} className="mr-1" />
            Reply
          </Button>
          
          {!isReply && comment.replies_count && comment.replies_count > 0 && onViewReplies && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-muted-foreground text-xs flex items-center"
              onClick={() => onViewReplies(comment.id)}
            >
              <MessageCircle size={14} className="mr-1" />
              {comment.replies_count} {comment.replies_count === 1 ? 'reply' : 'replies'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
