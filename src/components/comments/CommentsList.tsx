
import { useAuth } from '@/contexts/AuthContext';
import { Comment } from '@/hooks/feed/types';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import CommentRepliesList from './CommentRepliesList';

interface CommentsListProps {
  comments: Comment[];
  replies: Record<string, Comment[]>;
  onAddComment: (content: string, parentId?: string) => Promise<any>;
  onEditComment: (id: string, content: string) => Promise<any>;
  onDeleteComment: (id: string) => Promise<boolean>;
  onToggleReplies: (id: string) => void;
  setEditMode: (id: string, isEditing: boolean) => void;
  isLoading: boolean;
  postId?: string;
  recommendationId?: string;
}

const CommentsList: React.FC<CommentsListProps> = ({
  comments,
  replies,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onToggleReplies,
  setEditMode,
  isLoading,
  postId,
  recommendationId
}) => {
  const { user } = useAuth();

  const handleAddRootComment = async (data: any) => {
    return await onAddComment(data.content);
  };
  
  const handleReply = async (content: string, parentId: string) => {
    return await onAddComment(content, parentId);
  };
  
  if (isLoading) {
    return <div className="text-center py-4 text-muted-foreground">Loading comments...</div>;
  }

  return (
    <div className="space-y-6">
      {user && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Add a comment</h3>
          <CommentForm
            onSubmit={handleAddRootComment}
            postId={postId}
            recommendationId={recommendationId}
          />
        </div>
      )}
      
      {comments.length > 0 ? (
        <div className="space-y-6">
          {comments.map(comment => (
            <div key={comment.id} className="space-y-3">
              <CommentItem
                comment={comment}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
                onReply={handleReply}
                onToggleReplies={onToggleReplies}
                setEditMode={setEditMode}
              />
              
              {comment.showReplies && replies[comment.id] && (
                <CommentRepliesList
                  replies={replies[comment.id]}
                  onEdit={onEditComment}
                  onDelete={onDeleteComment}
                  onReply={handleReply}
                  onToggleReplies={onToggleReplies}
                  setEditMode={setEditMode}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          No comments yet. Be the first to comment!
        </div>
      )}
    </div>
  );
};

export default CommentsList;
