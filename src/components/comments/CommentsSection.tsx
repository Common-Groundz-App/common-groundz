
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useComments } from '@/hooks/use-comments';
import CommentsList from './CommentsList';

interface CommentsSectionProps {
  postId?: string;
  recommendationId?: string;
  commentCount: number;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({
  postId,
  recommendationId,
  commentCount = 0
}) => {
  const [expanded, setExpanded] = useState(false);
  const {
    comments,
    replies,
    isLoading,
    addComment,
    updateComment,
    deleteComment,
    toggleReplies,
    setCommentEditMode
  } = useComments({
    postId,
    recommendationId
  });

  const handleAddComment = async (content: string, parentId?: string) => {
    return await addComment({
      content,
      post_id: postId,
      recommendation_id: recommendationId,
      parent_id: parentId
    });
  };

  const handleEditComment = async (id: string, content: string) => {
    return await updateComment({ id, content });
  };
  
  if (commentCount === 0 && comments.length === 0 && !expanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1 text-muted-foreground"
        onClick={() => setExpanded(true)}
      >
        <MessageSquare size={16} />
        Add comment
      </Button>
    );
  }

  return (
    <div className="mt-4">
      {!expanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 text-muted-foreground"
          onClick={() => setExpanded(true)}
        >
          <MessageSquare size={16} />
          <span>
            {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
          </span>
          <ChevronDown size={16} />
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              Comments ({commentCount})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
            >
              <ChevronUp size={16} className="mr-1" />
              Hide comments
            </Button>
          </div>
          
          <div className="border-t pt-4">
            <CommentsList
              comments={comments}
              replies={replies}
              onAddComment={handleAddComment}
              onEditComment={handleEditComment}
              onDeleteComment={deleteComment}
              onToggleReplies={toggleReplies}
              setEditMode={setCommentEditMode}
              isLoading={isLoading}
              postId={postId}
              recommendationId={recommendationId}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentsSection;
