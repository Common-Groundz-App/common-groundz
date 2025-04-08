
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  Reply, 
  Edit2, 
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Comment } from '@/hooks/feed/types';
import { format, formatDistanceToNow } from 'date-fns';
import CommentForm from './CommentForm';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface CommentItemProps {
  comment: Comment;
  onEdit: (id: string, content: string) => Promise<any>;
  onDelete: (id: string) => Promise<boolean>;
  onReply: (content: string, parentId: string) => Promise<any>;
  onToggleReplies: (id: string) => void;
  setEditMode: (id: string, isEditing: boolean) => void;
  isReply?: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onEdit,
  onDelete,
  onReply,
  onToggleReplies,
  setEditMode,
  isReply = false
}) => {
  const { user } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const isAuthor = user?.id === comment.user_id;
  const isDeleted = comment.is_deleted;
  
  // Format date for display and tooltip
  const formattedDate = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
  const fullDate = format(new Date(comment.created_at), 'PPpp');
  
  // If comment is deleted and has no replies, it could be hidden completely
  if (isDeleted && (!comment.replyCount || comment.replyCount === 0)) {
    return null;
  }
  
  const handleEdit = async (data: any) => {
    const result = await onEdit(comment.id, data.content);
    if (result) {
      setEditMode(comment.id, false);
    }
    return result;
  };
  
  const handleReply = async (data: any) => {
    const result = await onReply(data.content, comment.id);
    if (result) {
      setIsReplying(false);
    }
    return result;
  };
  
  const handleDelete = async () => {
    await onDelete(comment.id);
  };

  return (
    <div className={`group ${isReply ? 'pl-4 border-l border-muted' : ''}`}>
      <div className="flex items-start space-x-3 mb-3">
        {!isDeleted && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.avatar_url || undefined} alt={comment.username || 'User'} />
            <AvatarFallback>
              {comment.username ? comment.username.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex-1 space-y-1">
          {!isDeleted ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{comment.username || 'Anonymous'}</span>
                  <span 
                    className="text-xs text-muted-foreground ml-2" 
                    title={fullDate}
                  >
                    {formattedDate}
                  </span>
                </div>
                
                {isAuthor && !isDeleted && !comment.isEditing && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal size={16} />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditMode(comment.id, true)}>
                        <Edit2 size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={handleDelete}
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              
              {comment.isEditing ? (
                <CommentForm
                  onSubmit={handleEdit}
                  initialContent={comment.content}
                  isEditing={true}
                  submitLabel="Save"
                  onCancel={() => setEditMode(comment.id, false)}
                />
              ) : (
                <div className="text-sm break-words">{comment.content}</div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground italic">
              This comment has been deleted
            </div>
          )}
          
          {!comment.isEditing && (
            <div className="flex items-center space-x-2 pt-1">
              {!isDeleted && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setIsReplying(!isReplying)}
                >
                  <Reply size={14} className="mr-1" />
                  Reply
                </Button>
              )}
              
              {(comment.replyCount && comment.replyCount > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onToggleReplies(comment.id)}
                >
                  {comment.showReplies ? (
                    <>
                      <ChevronUp size={14} className="mr-1" />
                      Hide replies
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} className="mr-1" />
                      View {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {isReplying && (
        <div className="pl-11 mb-4">
          <CommentForm
            onSubmit={handleReply}
            placeholder="Write a reply..."
            submitLabel="Reply"
            parentId={comment.id}
            postId={comment.post_id || undefined}
            recommendationId={comment.recommendation_id || undefined}
          />
        </div>
      )}
    </div>
  );
};

export default CommentItem;
