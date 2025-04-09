
import React from 'react';
import { useComments } from '@/hooks/use-comments';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import CommentsList from '@/components/comments/CommentsList';
import { useAuth } from '@/contexts/AuthContext';

interface CommentsSectionProps {
  post_id?: string;
  recommendation_id?: string;
  commentCount: number;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  post_id,
  recommendation_id,
  commentCount = 0
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const { user } = useAuth();
  
  const {
    comments,
    loading,
    addComment,
    editComment,
    removeComment,
    likeComment,
    repliesMap,
    loadingReplies,
    loadReplies,
    hasLoadedReplies,
  } = useComments({
    post_id,
    recommendation_id
  });
  
  // Only fetch comments when the section is expanded
  const handleExpand = () => {
    setExpanded(!expanded);
  };
  
  return (
    <div className="pt-2">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1"
        onClick={handleExpand}
      >
        <MessageCircle size={18} />
        {commentCount > 0 && (
          <span>{commentCount}</span>
        )}
        {expanded ? 'Hide Comments' : 'Show Comments'}
      </Button>
      
      {expanded && (
        <div className="mt-4">
          <CommentsList
            comments={comments}
            repliesMap={repliesMap}
            loading={loading}
            loadingReplies={loadingReplies}
            hasLoadedReplies={hasLoadedReplies}
            onAddComment={addComment}
            onEditComment={editComment}
            onDeleteComment={removeComment}
            onLikeComment={likeComment}
            onLoadReplies={loadReplies}
          />
        </div>
      )}
    </div>
  );
};

export default CommentsSection;
